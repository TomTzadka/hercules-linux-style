from __future__ import annotations
from enum import Enum
from typing import Optional, Dict
from datetime import datetime
from pydantic import BaseModel, Field


class NodeType(str, Enum):
    FILE = "file"
    DIRECTORY = "directory"
    SYMLINK = "symlink"


class VFSNode(BaseModel):
    name: str
    node_type: NodeType
    content: Optional[str] = None
    permissions: str = "rwxr-xr-x"
    owner: str = "root"
    group: str = "SYS1"
    size: int = 0
    modified: datetime = Field(default_factory=datetime.utcnow)
    children: Dict[str, "VFSNode"] = Field(default_factory=dict)
    symlink_target: Optional[str] = None

    def update_size(self) -> None:
        if self.node_type == NodeType.FILE and self.content is not None:
            self.size = len(self.content.encode("utf-8"))

    model_config = {"arbitrary_types_allowed": True}


VFSNode.model_rebuild()
