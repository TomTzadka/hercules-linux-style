"""
Vercel serverless entry point for the FastAPI backend.
Adds backend/ to sys.path so the 'app' package is importable,
then seeds the VFS and dataset catalog on cold start.
"""
import sys
import os

# Make 'app' package importable from backend/
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

from app.main import app  # noqa: E402 — must come after sys.path modification
from app import dependencies
from app.core.seed_data import seed_vfs, seed_datasets

# Seed on cold start (lifespan may not fire in serverless runtime)
seed_vfs(dependencies.vfs_engine)
seed_datasets(dependencies.dataset_engine)
