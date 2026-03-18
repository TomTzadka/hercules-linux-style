from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import Optional
from app.dependencies import get_datasets, DatasetEngine
from app.core.dataset_engine import DatasetError
from app.models.dataset import DSOrg, RecFM
from app.models.responses import ok, err, APIResponse

router = APIRouter(prefix="/api/datasets", tags=["datasets"])


class AllocateBody(BaseModel):
    dsn: str
    dsorg: DSOrg = DSOrg.PS
    recfm: RecFM = RecFM.FB
    lrecl: int = 80
    blksize: int = 3200
    volser: str = "USR001"


class WriteMemberBody(BaseModel):
    content: str
    userid: str = "HERC01"


@router.get("", response_model=APIResponse)
def list_datasets(filter: Optional[str] = Query(None), ds: DatasetEngine = Depends(get_datasets)):
    datasets = ds.list_datasets(filter)
    return ok([{
        "dsn": d.dsn,
        "dsorg": d.dsorg,
        "recfm": d.recfm,
        "lrecl": d.lrecl,
        "blksize": d.blksize,
        "volser": d.volser,
        "created": d.created,
        "changed": d.changed,
        "member_count": len(d.members) if d.dsorg == DSOrg.PO else None,
        "migrated": d.migrated,
    } for d in datasets])


@router.get("/{dsn:path}/members/{member}", response_model=APIResponse)
def get_member(dsn: str, member: str, ds: DatasetEngine = Depends(get_datasets)):
    try:
        m = ds.get_member(dsn.upper(), member.upper())
        return ok({"name": m.name, "content": m.content, "size": m.size, "changed": m.changed, "userid": m.userid})
    except DatasetError as e:
        return err(str(e))


@router.get("/{dsn:path}", response_model=APIResponse)
def get_dataset(dsn: str, ds: DatasetEngine = Depends(get_datasets)):
    try:
        d = ds.get_dataset(dsn.upper())
        return ok({
            "dsn": d.dsn,
            "dsorg": d.dsorg,
            "recfm": d.recfm,
            "lrecl": d.lrecl,
            "volser": d.volser,
            "created": d.created,
            "changed": d.changed,
            "content": d.content,
            "members": [
                {"name": m.name, "size": m.size, "changed": m.changed, "userid": m.userid}
                for m in sorted(d.members.values(), key=lambda x: x.name)
            ] if d.dsorg == DSOrg.PO else [],
        })
    except DatasetError as e:
        return err(str(e))


@router.post("", response_model=APIResponse)
def allocate_dataset(body: AllocateBody, ds: DatasetEngine = Depends(get_datasets)):
    try:
        d = ds.allocate(body.dsn, body.dsorg, body.recfm, body.lrecl, body.blksize, body.volser)
        return ok({"dsn": d.dsn, "dsorg": d.dsorg})
    except DatasetError as e:
        return err(str(e))


@router.post("/{dsn:path}/members/{member}", response_model=APIResponse)
def write_member(dsn: str, member: str, body: WriteMemberBody, ds: DatasetEngine = Depends(get_datasets)):
    try:
        m = ds.write_member(dsn.upper(), member.upper(), body.content, body.userid)
        return ok({"name": m.name, "size": m.size})
    except DatasetError as e:
        return err(str(e))


@router.delete("/{dsn:path}/members/{member}", response_model=APIResponse)
def delete_member(dsn: str, member: str, ds: DatasetEngine = Depends(get_datasets)):
    try:
        ds.delete_member(dsn.upper(), member.upper())
        return ok({"deleted": True})
    except DatasetError as e:
        return err(str(e))


@router.delete("/{dsn:path}", response_model=APIResponse)
def delete_dataset(dsn: str, ds: DatasetEngine = Depends(get_datasets)):
    try:
        ds.delete_dataset(dsn.upper())
        return ok({"deleted": True})
    except DatasetError as e:
        return err(str(e))
