import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_vfs, VFSEngine
from app.models.responses import ok, err, APIResponse

router = APIRouter(prefix="/api/session", tags=["session"])

# In-memory session store: session_id -> {username, cwd, created}
_sessions: dict = {}

SESSION_TTL = timedelta(hours=8)


@router.post("/new", response_model=APIResponse)
def new_session(vfs: VFSEngine = Depends(get_vfs)):
    session_id = str(uuid.uuid4())
    username = "TOMTZ"
    cwd = "/u/tomtz"
    vfs.set_cwd(session_id, cwd)
    _sessions[session_id] = {"username": username, "cwd": cwd, "created": datetime.now()}
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
    s = _sessions.get(session_id)
    if not s:
        return "TOMTZ"
    if datetime.now() - s["created"] > SESSION_TTL:
        del _sessions[session_id]
        raise HTTPException(status_code=401, detail="Session expired")
    return s["username"]
