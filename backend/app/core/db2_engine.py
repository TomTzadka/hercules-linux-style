"""
IBM Db2 engine — connection manager, DDL init, and query execution.

Gracefully degrades when ibm_db/SQLAlchemy are not installed or when
DB2_HOST env var is not set. All other panels continue working normally.
"""

import os
import re
import time
from typing import Any, Dict, List, Optional

# Graceful import — ibm_db requires IBM Db2 client libraries
try:
    import ibm_db_sa  # noqa — registers 'db2+ibm_db' dialect
    from sqlalchemy import create_engine, inspect, text
    _DEPS_AVAILABLE = True
except ImportError:
    _DEPS_AVAILABLE = False

# Only SELECT/INSERT/UPDATE/DELETE are permitted
_ALLOWED_RE = re.compile(r'^\s*(SELECT|INSERT|UPDATE|DELETE)\b', re.IGNORECASE)
# Block dangerous keywords even inside allowed statements
_BLOCKED_RE = re.compile(
    r'\b(DROP|CREATE|ALTER|GRANT|REVOKE|TRUNCATE|EXECUTE|EXEC|CALL|DECLARE|SET\s+CURRENT)\b|--|;',
    re.IGNORECASE,
)

_DDL_STATEMENTS = [
    "CREATE SCHEMA HERC",
    """CREATE TABLE HERC.DATASETS (
        DSN         VARCHAR(44)  NOT NULL PRIMARY KEY,
        DSORG       CHAR(2)      NOT NULL,
        RECFM       CHAR(2)      NOT NULL WITH DEFAULT 'FB',
        LRECL       SMALLINT     NOT NULL WITH DEFAULT 80,
        BLKSIZE     INTEGER      NOT NULL WITH DEFAULT 3200,
        VOLSER      CHAR(6)      NOT NULL WITH DEFAULT 'MVSRES',
        CREATED_TS  DATE         NOT NULL WITH DEFAULT CURRENT DATE,
        CHANGED_TS  TIMESTAMP    NOT NULL WITH DEFAULT CURRENT TIMESTAMP,
        ENCRYPTED   CHAR(1)      NOT NULL WITH DEFAULT 'N',
        MIGRATED    CHAR(1)      NOT NULL WITH DEFAULT 'N',
        RESTRICTED  CHAR(1)      NOT NULL WITH DEFAULT 'N'
    )""",
    """CREATE TABLE HERC.PDS_MEMBERS (
        DSN         VARCHAR(44)  NOT NULL,
        MEMBER_NAME CHAR(8)      NOT NULL,
        CONTENT     CLOB(1M),
        SIZE_BYTES  INTEGER      NOT NULL WITH DEFAULT 0,
        CHANGED_TS  TIMESTAMP    NOT NULL WITH DEFAULT CURRENT TIMESTAMP,
        USERID      CHAR(8)      NOT NULL WITH DEFAULT 'HERC01',
        VV          SMALLINT     NOT NULL WITH DEFAULT 1,
        MM          SMALLINT     NOT NULL WITH DEFAULT 0,
        PRIMARY KEY (DSN, MEMBER_NAME),
        FOREIGN KEY (DSN) REFERENCES HERC.DATASETS(DSN) ON DELETE CASCADE
    )""",
    """CREATE TABLE HERC.SPOOL_JOBS (
        JOBID       CHAR(8)      NOT NULL PRIMARY KEY,
        JOBNAME     CHAR(8)      NOT NULL,
        OWNER       CHAR(8)      NOT NULL,
        STATUS      CHAR(8)      NOT NULL,
        SUBMITTED   TIMESTAMP    NOT NULL WITH DEFAULT CURRENT TIMESTAMP,
        OUTPUT      CLOB(64K),
        JCL         CLOB(64K),
        QUEUE       CHAR(8)      NOT NULL WITH DEFAULT 'OUTPUT',
        PRTY        SMALLINT     NOT NULL WITH DEFAULT 5,
        JOB_CLASS   CHAR(1)      NOT NULL WITH DEFAULT 'A'
    )""",
]


class Db2Engine:
    """Wraps a SQLAlchemy engine connected to IBM Db2."""

    def __init__(self) -> None:
        self._engine: Any = None

    @property
    def connected(self) -> bool:
        return self._engine is not None

    def connect(self) -> None:
        """Build the engine and initialise the HERC schema."""
        if not _DEPS_AVAILABLE:
            raise RuntimeError(
                "ibm_db / ibm_db_sa / sqlalchemy are not installed. "
                "Add them to requirements.txt and rebuild."
            )

        user = os.environ["DB2_USER"]
        password = os.environ["DB2_PASSWORD"]
        host = os.environ["DB2_HOST"]
        port = os.environ.get("DB2_PORT", "50000")
        database = os.environ.get("DB2_DATABASE", "HERCDB")
        use_ssl = os.environ.get("DB2_SSL", "false").lower() == "true"

        dsn = f"db2+ibm_db://{user}:{password}@{host}:{port}/{database}"
        if use_ssl:
            dsn += ";Security=SSL"

        self._engine = create_engine(dsn, pool_pre_ping=True)
        self._init_schema()

    def _init_schema(self) -> None:
        """Create HERC schema + tables if they don't already exist."""
        with self._engine.connect() as conn:
            # Quick check — if HERC.DATASETS exists, schema is initialised
            try:
                conn.execute(text("SELECT 1 FROM HERC.DATASETS FETCH FIRST 1 ROWS ONLY"))
                return
            except Exception:
                pass

            for stmt in _DDL_STATEMENTS:
                try:
                    conn.execute(text(stmt))
                    conn.commit()
                except Exception:
                    # Silently ignore "already exists" errors
                    pass

    def seed_from_catalog(self, dataset_engine: Any) -> int:
        """
        Mirror the in-memory DatasetEngine catalog into HERC.DATASETS and
        HERC.PDS_MEMBERS.  Only runs when the tables are empty (idempotent).
        Returns the number of datasets inserted.
        """
        if not self._engine:
            return 0

        with self._engine.connect() as conn:
            row = conn.execute(
                text("SELECT COUNT(*) FROM HERC.DATASETS")
            ).scalar()
            if row and int(row) > 0:
                return 0          # already seeded

            inserted = 0
            for ds in dataset_engine.list_datasets():
                dsorg = ds.dsorg.value if hasattr(ds.dsorg, "value") else str(ds.dsorg)
                recfm = ds.recfm.value if hasattr(ds.recfm, "value") else str(ds.recfm)
                restricted = "Y" if ds.restricted else "N"
                conn.execute(
                    text(
                        "INSERT INTO HERC.DATASETS "
                        "(DSN, DSORG, RECFM, LRECL, BLKSIZE, VOLSER, RESTRICTED) "
                        "VALUES (:dsn, :dsorg, :recfm, :lrecl, :blksize, :volser, :restricted)"
                    ),
                    {
                        "dsn": ds.dsn,
                        "dsorg": dsorg,
                        "recfm": recfm,
                        "lrecl": ds.lrecl,
                        "blksize": ds.blksize,
                        "volser": ds.volser,
                        "restricted": restricted,
                    },
                )
                inserted += 1

                for member_name, member in getattr(ds, "members", {}).items():
                    conn.execute(
                        text(
                            "INSERT INTO HERC.PDS_MEMBERS "
                            "(DSN, MEMBER_NAME, CONTENT, SIZE_BYTES, USERID, VV, MM) "
                            "VALUES (:dsn, :name, :content, :size, :userid, :vv, :mm)"
                        ),
                        {
                            "dsn": ds.dsn,
                            "name": member_name[:8],
                            "content": member.content or "",
                            "size": len((member.content or "").encode()),
                            "userid": (member.userid or "HERC01")[:8],
                            "vv": member.vv if hasattr(member, "vv") else 1,
                            "mm": member.mm if hasattr(member, "mm") else 0,
                        },
                    )

            conn.commit()
            return inserted

    # ------------------------------------------------------------------ #
    # SQL validation                                                       #
    # ------------------------------------------------------------------ #

    def validate_sql(self, sql: str) -> Optional[str]:
        """Return an ISPF-style error string if SQL is not permitted, else None."""
        stripped = sql.strip()
        if not stripped:
            return "DSQL0001E: EMPTY SQL STATEMENT"
        if not _ALLOWED_RE.match(stripped):
            return "DSQL0100E: ONLY SELECT/INSERT/UPDATE/DELETE ARE PERMITTED"
        if _BLOCKED_RE.search(stripped):
            return "DSQL0200E: STATEMENT CONTAINS PROHIBITED KEYWORDS"
        return None

    # ------------------------------------------------------------------ #
    # Query execution                                                      #
    # ------------------------------------------------------------------ #

    def execute_sql(self, sql: str, max_rows: int = 500) -> Dict[str, Any]:
        """
        Execute a validated SQL statement.

        Returns:
            {
                "columns": [str, ...],
                "rows":    [[value, ...], ...],
                "rowcount": int,
                "type":    "SELECT" | "DML",
                "elapsed_ms": int,
            }
        """
        if not self._engine:
            raise RuntimeError("DB2 engine not connected")

        t0 = time.monotonic()
        with self._engine.connect() as conn:
            result = conn.execute(text(sql))
            elapsed_ms = int((time.monotonic() - t0) * 1000)

            if result.returns_rows:
                cols = list(result.keys())
                rows = [list(row) for row in result.fetchmany(max_rows)]
                return {
                    "columns": cols,
                    "rows": rows,
                    "rowcount": len(rows),
                    "type": "SELECT",
                    "elapsed_ms": elapsed_ms,
                }
            else:
                conn.commit()
                return {
                    "columns": [],
                    "rows": [],
                    "rowcount": result.rowcount if result.rowcount >= 0 else 0,
                    "type": "DML",
                    "elapsed_ms": elapsed_ms,
                }

    # ------------------------------------------------------------------ #
    # Schema introspection                                                 #
    # ------------------------------------------------------------------ #

    def list_tables(self) -> List[str]:
        """Return all table names in the HERC schema."""
        if not self._engine:
            raise RuntimeError("DB2 engine not connected")
        insp = inspect(self._engine)
        return [f"HERC.{t.upper()}" for t in insp.get_table_names(schema="HERC")]

    def describe_table(self, table: str) -> List[Dict[str, Any]]:
        """
        Return column metadata for a given table.

        ``table`` may be ``"HERC.DATASETS"`` or just ``"DATASETS"``.
        """
        if not self._engine:
            raise RuntimeError("DB2 engine not connected")

        parts = table.upper().split(".")
        schema = parts[0] if len(parts) > 1 else "HERC"
        tname = parts[-1]

        insp = inspect(self._engine)
        cols = insp.get_columns(tname, schema=schema)
        return [
            {
                "name": c["name"],
                "type": str(c["type"]),
                "nullable": c.get("nullable", True),
                "default": c.get("default"),
            }
            for c in cols
        ]
