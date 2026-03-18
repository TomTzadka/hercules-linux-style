from typing import Any, Optional
from pydantic import BaseModel


class APIResponse(BaseModel):
    ok: bool = True
    data: Any = None
    error: Optional[str] = None


def ok(data: Any = None) -> APIResponse:
    return APIResponse(ok=True, data=data)


def err(message: str) -> APIResponse:
    return APIResponse(ok=False, error=message)
