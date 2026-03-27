from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import dependencies
from app.core.seed_data import seed_vfs, seed_datasets
from app.routers import session, filesystem, datasets, terminal, spool


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Seed the VFS and dataset catalog on startup
    seed_vfs(dependencies.vfs_engine)
    seed_datasets(dependencies.dataset_engine)
    yield


app = FastAPI(
    title="Hercules Mainframe Simulator API",
    description="z/OS USS + MVS Dataset simulation backend",
    version="1.0.0",
    lifespan=lifespan,
)

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


@app.get("/healthz")
def healthz():
    return {"status": "ok", "system": "MVS38J"}
