from __future__ import annotations
from enum import Enum
from typing import Optional, Dict
from pydantic import BaseModel, Field
from datetime import datetime


class DSOrg(str, Enum):
    PS = "PS"    # Physical Sequential
    PO = "PO"    # Partitioned (PDS)
    VSAM = "VSAM"


class RecFM(str, Enum):
    FB = "FB"    # Fixed Blocked
    VB = "VB"    # Variable Blocked
    U = "U"      # Undefined


class DatasetMember(BaseModel):
    name: str
    content: str = ""
    size: int = 0
    changed: str = Field(default_factory=lambda: datetime.utcnow().strftime("%Y/%m/%d %H:%M"))
    userid: str = "HERC01"
    version: int = 1
    vv: int = 1   # major version (ISPF VV.MM)
    mm: int = 0   # minor version (increments each save)

    def update_size(self) -> None:
        self.size = len(self.content.encode("utf-8"))

    @property
    def vv_mm(self) -> str:
        return f"{self.vv:02d}.{self.mm:02d}"


class Dataset(BaseModel):
    dsn: str
    dsorg: DSOrg
    recfm: RecFM = RecFM.FB
    lrecl: int = 80
    blksize: int = 3200
    volser: str = "MVSRES"
    created: str = Field(default_factory=lambda: datetime.utcnow().strftime("%Y/%m/%d"))
    changed: str = Field(default_factory=lambda: datetime.utcnow().strftime("%Y/%m/%d %H:%M"))
    members: Dict[str, DatasetMember] = Field(default_factory=dict)
    content: Optional[str] = None   # For PS sequential datasets
    encrypted: bool = False
    migrated: bool = False
    restricted: bool = False        # RACF-protected dataset
