from app.core.vfs_engine import VFSEngine
from app.core.dataset_engine import DatasetEngine

# Singletons - initialized in main.py lifespan
vfs_engine: VFSEngine = VFSEngine()
dataset_engine: DatasetEngine = DatasetEngine()


def get_vfs() -> VFSEngine:
    return vfs_engine


def get_datasets() -> DatasetEngine:
    return dataset_engine
