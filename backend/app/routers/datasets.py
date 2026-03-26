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


def _estimate_tracks(d) -> int:
    """Estimate DASD tracks used (3390: ~56664 bytes/track)."""
    if d.dsorg == DSOrg.PO:
        size = sum(len((m.content or "").encode()) for m in d.members.values())
        size += max(len(d.members) * 256, 1)  # directory blocks
    else:
        size = len((d.content or "").encode())
    return max(1, (size + 56663) // 56664)


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
        "restricted": d.restricted,
        "tracks_used": _estimate_tracks(d),
        "extents": 1,
    } for d in datasets])


@router.get("/{dsn:path}/members/{member}", response_model=APIResponse)
def get_member(dsn: str, member: str, ds: DatasetEngine = Depends(get_datasets)):
    try:
        m = ds.get_member(dsn.upper(), member.upper())
        return ok({"name": m.name, "content": m.content, "size": m.size, "changed": m.changed, "userid": m.userid, "vv": m.vv, "mm": m.mm})
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
                {"name": m.name, "size": m.size, "changed": m.changed, "userid": m.userid, "vv": m.vv, "mm": m.mm}
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


@router.get("/{dsn:path}/search", response_model=APIResponse)
def search_dataset(dsn: str, q: str = Query(...), anyc: bool = Query(False), ds: DatasetEngine = Depends(get_datasets)):
    """Search for string q across all members of a PDS. anyc=True for case-insensitive."""
    try:
        d = ds.get_dataset(dsn.upper())
    except DatasetError as e:
        return err(str(e))
    if d.dsorg != DSOrg.PO:
        return err(f"{dsn} is not a PDS")
    results = []
    pattern = q.lower() if anyc else q
    for m in sorted(d.members.values(), key=lambda x: x.name):
        content_lines = m.content.split('\n')
        matches = []
        for lineno, line in enumerate(content_lines, start=1):
            haystack = line.lower() if anyc else line
            if pattern in haystack:
                matches.append({"line": lineno, "content": line})
        if matches:
            results.append({"member": m.name, "matches": matches})
    return ok({"dsn": dsn.upper(), "query": q, "result_count": sum(len(r["matches"]) for r in results), "results": results})


@router.delete("/{dsn:path}", response_model=APIResponse)
def delete_dataset(dsn: str, ds: DatasetEngine = Depends(get_datasets)):
    try:
        ds.delete_dataset(dsn.upper())
        return ok({"deleted": True})
    except DatasetError as e:
        return err(str(e))
