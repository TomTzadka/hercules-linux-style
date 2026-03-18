import uuid
from fastapi import APIRouter, Depends
from app.dependencies import get_vfs, VFSEngine
from app.models.responses import ok, err, APIResponse

router = APIRouter(prefix="/api/session", tags=["session"])

# In-memory session store: session_id -> {username, cwd}
_sessions: dict = {}


@router.post("/new", response_model=APIResponse)
def new_session(vfs: VFSEngine = Depends(get_vfs)):
    session_id = str(uuid.uuid4())
    username = "HERC01"
    cwd = "/u/herc01"
    vfs.set_cwd(session_id, cwd)
    _sessions[session_id] = {"username": username, "cwd": cwd}
    return ok({"session_id": session_id, "cwd": cwd, "username": username})


@router.get("/{session_id}", response_model=APIResponse)
def get_session(session_id: str, vfs: VFSEngine = Depends(get_vfs)):
    if session_id not in _sessions:
        return err("Session not found")
    cwd = vfs.get_cwd(session_id)
    data = dict(_sessions[session_id])
    data["cwd"] = cwd
    return ok(data)


@router.delete("/{session_id}", response_model=APIResponse)
def delete_session(session_id: str, vfs: VFSEngine = Depends(get_vfs)):
    _sessions.pop(session_id, None)
    vfs.delete_session(session_id)
    return ok({"deleted": True})


def get_session_username(session_id: str) -> str:
    return _sessions.get(session_id, {}).get("username", "HERC01")
