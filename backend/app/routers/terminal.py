from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from app.dependencies import get_vfs, get_datasets, VFSEngine, DatasetEngine, limiter
from app.core.command_parser import execute_command
from app.routers.session import get_session_username
from app.models.responses import ok, APIResponse

router = APIRouter(prefix="/api/terminal", tags=["terminal"])


class ExecRequest(BaseModel):
    command: str
    session_id: str


@router.post("/exec", response_model=APIResponse)
@limiter.limit("30/minute")
def exec_command(
    request: Request,
    body: ExecRequest,
    vfs: VFSEngine = Depends(get_vfs),
    datasets: DatasetEngine = Depends(get_datasets),
):
    username = get_session_username(body.session_id)
    output, new_cwd, exit_code = execute_command(
        raw=body.command,
        session_id=body.session_id,
        username=username,
        vfs=vfs,
        datasets=datasets,
    )
    return ok({
        "output": output,
        "new_cwd": new_cwd,
        "exit_code": exit_code,
    })
