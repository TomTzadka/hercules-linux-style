import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app import dependencies
from app.core.seed_data import seed_vfs, seed_datasets
from app.routers import session, filesystem, datasets, terminal, spool
from app.routers import db2 as db2_router

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Seed the VFS and dataset catalog on startup
    seed_vfs(dependencies.vfs_engine)
    seed_datasets(dependencies.dataset_engine)

    # Optionally connect IBM Db2 — requires DB2_HOST env var
    if os.environ.get("DB2_HOST"):
        try:
            engine = dependencies.Db2Engine()
            engine.connect()
            dependencies.db2_engine = engine
            seeded = engine.seed_from_catalog(dependencies.dataset_engine)
            print(f"IBM Db2 connected — {seeded} datasets seeded into HERC schema")
        except Exception as exc:
            log.warning("IBM Db2 connection failed (DB2 features disabled): %s", exc)

    yield


app = FastAPI(
    title="Hercules Mainframe Simulator API",
    description="z/OS USS + MVS Dataset simulation backend",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = dependencies.limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://hercules-linux-style.vercel.app"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type"],
)

app.include_router(session.router)
app.include_router(filesystem.router)
app.include_router(datasets.router)
app.include_router(terminal.router)
app.include_router(spool.router)
app.include_router(db2_router.router)


@app.get("/healthz")
def healthz():
    return {"status": "ok", "system": "MVS38J"}
