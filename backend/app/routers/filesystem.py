from fastapi import APIRouter, Depends, Header, Query
from pydantic import BaseModel, validator
from app.dependencies import get_vfs, VFSEngine
from app.core.vfs_engine import VFSError
from app.models.responses import ok, err, APIResponse
from app.routers.session import get_session_username

router = APIRouter(prefix="/api/fs", tags=["filesystem"])

_FILE_MAX_BYTES = 64_000


class WriteBody(BaseModel):
    path: str
    content: str
    session_id: str = ""

    @validator('content')
    def content_max_size(cls, v: str) -> str:
        if len(v.encode()) > _FILE_MAX_BYTES:
            raise ValueError("File content exceeds maximum size of 64KB")
        return v


class MkdirBody(BaseModel):
    path: str
    session_id: str = ""
    parents: bool = False


class TouchBody(BaseModel):
    path: str
    session_id: str = ""


@router.get("/ls", response_model=APIResponse)
def ls(path: str = Query("/"), session_id: str = Query(""), vfs: VFSEngine = Depends(get_vfs)):
    try:
        nodes = vfs.listdir(path)
        return ok([{
            "name": n.name,
            "node_type": n.node_type,
            "permissions": n.permissions,
            "owner": n.owner,
            "group": n.group,
            "size": n.size,
            "modified": n.modified.isoformat(),
        } for n in nodes])
    except VFSError as e:
        return err(str(e))


@router.get("/cat", response_model=APIResponse)
def cat(
    path: str = Query(...),
    x_session_id: str = Header(default="", alias="X-Session-Id"),
    vfs: VFSEngine = Depends(get_vfs),
):
    try:
        username = get_session_username(x_session_id) if x_session_id else ""
        content = vfs.readfile(path, username=username)
        return ok({"path": path, "content": content, "size": len(content)})
    except VFSError as e:
        return err(str(e))


@router.get("/stat", response_model=APIResponse)
def stat(path: str = Query(...), session_id: str = Query(""), vfs: VFSEngine = Depends(get_vfs)):
    try:
        return ok(vfs.stat(path))
    except VFSError as e:
        return err(str(e))


@router.post("/mkdir", response_model=APIResponse)
def mkdir(body: MkdirBody, vfs: VFSEngine = Depends(get_vfs)):
    try:
        node = vfs.mkdir(body.path, parents=body.parents)
        return ok({"name": node.name, "node_type": node.node_type})
    except VFSError as e:
        return err(str(e))


@router.post("/touch", response_model=APIResponse)
def touch(body: TouchBody, vfs: VFSEngine = Depends(get_vfs)):
    try:
        node = vfs.touch(body.path)
        return ok({"name": node.name, "node_type": node.node_type})
    except VFSError as e:
        return err(str(e))


@router.post("/write", response_model=APIResponse)
def write_file(body: WriteBody, vfs: VFSEngine = Depends(get_vfs)):
    try:
        username = get_session_username(body.session_id) if body.session_id else ""
        node = vfs.write(body.path, body.content, username=username)
        return ok({"name": node.name, "size": node.size})
    except VFSError as e:
        return err(str(e))


@router.delete("/rm", response_model=APIResponse)
def rm(path: str = Query(...), recursive: bool = Query(False), vfs: VFSEngine = Depends(get_vfs)):
    try:
        vfs.remove(path, recursive=recursive)
        return ok({"deleted": True})
    except VFSError as e:
        return err(str(e))
