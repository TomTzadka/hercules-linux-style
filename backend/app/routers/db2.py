"""
SPUFI / IBM Db2 REST endpoints.

Endpoints:
  POST /api/db2/sql          — execute a SELECT / DML statement
  GET  /api/db2/tables       — list HERC.* tables
  GET  /api/db2/describe/{t} — describe columns of a table
"""

from typing import Optional

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, validator

from app.core.db2_engine import Db2Engine
from app.dependencies import get_db2, limiter
from app.models.responses import APIResponse
from app.models.responses import err as api_err
from app.models.responses import ok as api_ok

router = APIRouter(prefix="/api/db2", tags=["db2"])

_SQL_MAX_BYTES = 8_000


class SqlBody(BaseModel):
    sql: str
    max_rows: Optional[int] = 500

    @validator("sql")
    def sql_max_size(cls, v: str) -> str:
        if len(v.encode()) > _SQL_MAX_BYTES:
            raise ValueError("SQL statement exceeds maximum size of 8 KB")
        return v


# ------------------------------------------------------------------ #
# Endpoints                                                           #
# ------------------------------------------------------------------ #

@router.post("/sql", response_model=APIResponse)
@limiter.limit("20/minute")
def execute_sql(
    request: Request,
    body: SqlBody,
    db2: Optional[Db2Engine] = Depends(get_db2),
) -> APIResponse:
    if db2 is None:
        return api_err("DB2 not configured — set DB2_HOST env var")

    validation_error = db2.validate_sql(body.sql)
    if validation_error:
        return api_err(validation_error)

    try:
        result = db2.execute_sql(body.sql, max_rows=body.max_rows or 500)
        return api_ok(result)
    except Exception as exc:
        return api_err(f"DSQL0500E: {exc}")


@router.get("/tables", response_model=APIResponse)
def list_tables(db2: Optional[Db2Engine] = Depends(get_db2)) -> APIResponse:
    if db2 is None:
        return api_err("DB2 not configured — set DB2_HOST env var")
    try:
        return api_ok(db2.list_tables())
    except Exception as exc:
        return api_err(f"DSQL0500E: {exc}")


@router.get("/describe/{table}", response_model=APIResponse)
def describe_table(
    table: str,
    db2: Optional[Db2Engine] = Depends(get_db2),
) -> APIResponse:
    if db2 is None:
        return api_err("DB2 not configured — set DB2_HOST env var")
    try:
        return api_ok(db2.describe_table(table))
    except Exception as exc:
        return api_err(f"DSQL0500E: {exc}")
