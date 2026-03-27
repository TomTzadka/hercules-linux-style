from __future__ import annotations
import copy
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from app.models.vfs import VFSNode, NodeType


class VFSError(Exception):
    pass


class VFSEngine:
    def __init__(self) -> None:
        self.root = VFSNode(
            name="/",
            node_type=NodeType.DIRECTORY,
            permissions="rwxr-xr-x",
            owner="root",
            group="SYS1",
        )
        # session_id -> current working directory
        self._cwd_map: Dict[str, str] = {}

    # ------------------------------------------------------------------
    # Path utilities
    # ------------------------------------------------------------------

    def _normalize(self, path: str, cwd: str = "/", username: str = "herc01") -> str:
        """Resolve path to absolute, handling ~, .., ."""
        if path == "~" or path.startswith("~/"):
            path = f"/u/{username}" + path[1:]
        if not path.startswith("/"):
            path = cwd.rstrip("/") + "/" + path
        parts: List[str] = []
        for p in path.split("/"):
            if p == "" or p == ".":
                continue
            elif p == "..":
                if parts:
                    parts.pop()
            else:
                parts.append(p)
        return "/" + "/".join(parts)

    def _parts(self, path: str) -> List[str]:
        return [p for p in path.split("/") if p]

    def _traverse(self, path: str) -> Tuple[Optional[VFSNode], Optional[VFSNode], str]:
        """Return (parent_node, target_node, target_name). parent is None for root."""
        parts = self._parts(path)
        if not parts:
            return None, self.root, "/"
        node = self.root
        parent = None
        for i, part in enumerate(parts):
            if node.node_type != NodeType.DIRECTORY:
                return None, None, part
            parent = node
            child = node.children.get(part)
            if child is None:
                return parent, None, part
            node = child
        return parent, node, parts[-1]

    # ------------------------------------------------------------------
    # Read operations
    # ------------------------------------------------------------------

    def resolve(self, path: str) -> Optional[VFSNode]:
        _, node, _ = self._traverse(path)
        return node

    def listdir(self, path: str) -> List[VFSNode]:
        node = self.resolve(path)
        if node is None:
            raise VFSError(f"No such file or directory: {path}")
        if node.node_type != NodeType.DIRECTORY:
            raise VFSError(f"Not a directory: {path}")
        return list(node.children.values())

    def _can_read(self, node: VFSNode, username: str) -> bool:
        perms = (node.permissions or "rw-r--r--").ljust(9, "-")
        if username.upper() == (node.owner or "").upper():
            return perms[0] == 'r'
        return perms[6] == 'r'

    def _can_write(self, node: VFSNode, username: str) -> bool:
        perms = (node.permissions or "rw-r--r--").ljust(9, "-")
        if username.upper() == (node.owner or "").upper():
            return perms[1] == 'w'
        return perms[7] == 'w'

    def readfile(self, path: str, username: str = "") -> str:
        node = self.resolve(path)
        if node is None:
            raise VFSError(f"No such file or directory: {path}")
        if node.node_type != NodeType.FILE:
            raise VFSError(f"Is a directory: {path}")
        if username and not self._can_read(node, username):
            raise VFSError(f"Permission denied: {path}")
        return node.content or ""

    def stat(self, path: str) -> dict:
        node = self.resolve(path)
        if node is None:
            raise VFSError(f"No such file or directory: {path}")
        return {
            "name": node.name,
            "node_type": node.node_type,
            "permissions": node.permissions,
            "owner": node.owner,
            "group": node.group,
            "size": node.size,
            "modified": node.modified.isoformat(),
        }

    # ------------------------------------------------------------------
    # Write operations
    # ------------------------------------------------------------------

    def _make_node(
        self,
        path: str,
        node_type: NodeType,
        content: str = "",
        owner: str = "HERC01",
        permissions: str = "rw-r--r--",
    ) -> VFSNode:
        parts = self._parts(path)
        if not parts:
            raise VFSError("Cannot create root")
        name = parts[-1]
        parent_path = "/" + "/".join(parts[:-1])
        parent = self.resolve(parent_path) if len(parts) > 1 else self.root
        if parent is None:
            raise VFSError(f"No such directory: {parent_path}")
        if parent.node_type != NodeType.DIRECTORY:
            raise VFSError(f"Not a directory: {parent_path}")
        node = VFSNode(
            name=name,
            node_type=node_type,
            content=content if node_type == NodeType.FILE else None,
            owner=owner,
            group="SYS1",
            permissions=permissions,
            modified=datetime.utcnow(),
        )
        if node_type == NodeType.FILE:
            node.update_size()
        parent.children[name] = node
        return node

    def mkdir(self, path: str, owner: str = "HERC01", parents: bool = False) -> VFSNode:
        if parents:
            parts = self._parts(path)
            current = ""
            last = None
            for part in parts:
                current += "/" + part
                existing = self.resolve(current)
                if existing is None:
                    last = self._make_node(current, NodeType.DIRECTORY, owner=owner, permissions="rwxr-xr-x")
                elif existing.node_type != NodeType.DIRECTORY:
                    raise VFSError(f"Not a directory: {current}")
                else:
                    last = existing
            return last
        return self._make_node(path, NodeType.DIRECTORY, owner=owner, permissions="rwxr-xr-x")

    def touch(self, path: str, owner: str = "HERC01") -> VFSNode:
        existing = self.resolve(path)
        if existing is not None:
            existing.modified = datetime.utcnow()
            return existing
        return self._make_node(path, NodeType.FILE, owner=owner)

    def write(self, path: str, content: str, owner: str = "HERC01", username: str = "") -> VFSNode:
        existing = self.resolve(path)
        if existing is not None:
            if existing.node_type != NodeType.FILE:
                raise VFSError(f"Is a directory: {path}")
            if username and not self._can_write(existing, username):
                raise VFSError(f"Permission denied: {path}")
            existing.content = content
            existing.update_size()
            existing.modified = datetime.utcnow()
            return existing
        return self._make_node(path, NodeType.FILE, content=content, owner=owner)

    def remove(self, path: str, recursive: bool = False) -> bool:
        if path == "/":
            raise VFSError("Cannot remove root")
        parent, node, name = self._traverse(path)
        if node is None:
            raise VFSError(f"No such file or directory: {path}")
        if node.node_type == NodeType.DIRECTORY and node.children and not recursive:
            raise VFSError(f"Directory not empty: {path}")
        if parent is None:
            raise VFSError("Cannot remove root")
        del parent.children[name]
        return True

    def copy(self, src: str, dst: str) -> VFSNode:
        src_node = self.resolve(src)
        if src_node is None:
            raise VFSError(f"No such file or directory: {src}")
        if src_node.node_type != NodeType.FILE:
            raise VFSError(f"cp: {src}: Is a directory")
        return self.write(dst, src_node.content or "")

    def move(self, src: str, dst: str) -> VFSNode:
        src_node = self.resolve(src)
        if src_node is None:
            raise VFSError(f"No such file or directory: {src}")
        # Check if dst is a directory
        dst_node = self.resolve(dst)
        if dst_node is not None and dst_node.node_type == NodeType.DIRECTORY:
            dst = dst.rstrip("/") + "/" + src_node.name
        cloned = copy.deepcopy(src_node)
        parts = self._parts(dst)
        if not parts:
            raise VFSError("Invalid destination")
        parent_path = "/" + "/".join(parts[:-1]) if len(parts) > 1 else "/"
        new_name = parts[-1]
        parent = self.resolve(parent_path) if parent_path != "/" else self.root
        if parent is None:
            raise VFSError(f"No such directory: {parent_path}")
        cloned.name = new_name
        parent.children[new_name] = cloned
        # Remove source
        self.remove(src, recursive=True)
        return cloned

    # ------------------------------------------------------------------
    # Session / CWD
    # ------------------------------------------------------------------

    def get_cwd(self, session_id: str) -> str:
        return self._cwd_map.get(session_id, "/u/herc01")

    def set_cwd(self, session_id: str, path: str) -> None:
        self._cwd_map[session_id] = path

    def delete_session(self, session_id: str) -> None:
        self._cwd_map.pop(session_id, None)

    # ------------------------------------------------------------------
    # Seed helper: quickly populate without permission checks
    # ------------------------------------------------------------------

    def seed_file(self, path: str, content: str, owner: str = "root", permissions: str = "rw-r--r--") -> None:
        """Called during startup to populate the VFS."""
        try:
            parts = self._parts(path)
            # Ensure all parent dirs exist
            for i in range(1, len(parts)):
                dir_path = "/" + "/".join(parts[:i])
                if self.resolve(dir_path) is None:
                    self._make_node(dir_path, NodeType.DIRECTORY, owner=owner, permissions="rwxr-xr-x")
            self._make_node(path, NodeType.FILE, content=content, owner=owner, permissions=permissions)
        except VFSError:
            pass  # node already exists, skip

    def seed_dir(self, path: str, owner: str = "root") -> None:
        try:
            parts = self._parts(path)
            for i in range(1, len(parts) + 1):
                dir_path = "/" + "/".join(parts[:i])
                if self.resolve(dir_path) is None:
                    self._make_node(dir_path, NodeType.DIRECTORY, owner=owner, permissions="rwxr-xr-x")
        except VFSError:
            pass
