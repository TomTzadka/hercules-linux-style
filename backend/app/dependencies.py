import os
from typing import Optional

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.vfs_engine import VFSEngine
from app.core.dataset_engine import DatasetEngine
from app.core.job_engine import JobEngine
from app.core.db2_engine import Db2Engine

limiter = Limiter(key_func=get_remote_address)

# Singletons - initialized in main.py lifespan
vfs_engine: VFSEngine = VFSEngine()
dataset_engine: DatasetEngine = DatasetEngine()
job_engine: JobEngine = JobEngine()

# DB2 is optional — None when DB2_HOST env var is not configured
db2_engine: Optional[Db2Engine] = None


def get_vfs() -> VFSEngine:
    return vfs_engine


def get_datasets() -> DatasetEngine:
    return dataset_engine


def get_jobs() -> JobEngine:
    return job_engine


def get_db2() -> Optional[Db2Engine]:
    return db2_engine
