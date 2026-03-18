from __future__ import annotations
import fnmatch
from datetime import datetime
from typing import Dict, List, Optional
from app.models.dataset import Dataset, DatasetMember, DSOrg, RecFM


class DatasetError(Exception):
    pass


class DatasetEngine:
    def __init__(self) -> None:
        self._catalog: Dict[str, Dataset] = {}

    # ------------------------------------------------------------------
    # Query
    # ------------------------------------------------------------------

    def list_datasets(self, pattern: Optional[str] = None) -> List[Dataset]:
        datasets = list(self._catalog.values())
        if pattern:
            # Convert MVS glob (* wildcard) to fnmatch
            pat = pattern.replace("*", "*")
            datasets = [d for d in datasets if fnmatch.fnmatch(d.dsn, pat)]
        return sorted(datasets, key=lambda d: d.dsn)

    def get_dataset(self, dsn: str) -> Dataset:
        dsn = dsn.upper()
        if dsn not in self._catalog:
            raise DatasetError(f"Dataset not found: {dsn}")
        return self._catalog[dsn]

    def get_member(self, dsn: str, member: str) -> DatasetMember:
        ds = self.get_dataset(dsn)
        if ds.dsorg != DSOrg.PO:
            raise DatasetError(f"{dsn} is not a PDS")
        member = member.upper()
        if member not in ds.members:
            raise DatasetError(f"Member not found: {dsn}({member})")
        return ds.members[member]

    # ------------------------------------------------------------------
    # Mutation
    # ------------------------------------------------------------------

    def allocate(
        self,
        dsn: str,
        dsorg: DSOrg = DSOrg.PS,
        recfm: RecFM = RecFM.FB,
        lrecl: int = 80,
        blksize: int = 3200,
        volser: str = "USR001",
    ) -> Dataset:
        dsn = dsn.upper()
        if dsn in self._catalog:
            raise DatasetError(f"Dataset already exists: {dsn}")
        ds = Dataset(dsn=dsn, dsorg=dsorg, recfm=recfm, lrecl=lrecl, blksize=blksize, volser=volser)
        self._catalog[dsn] = ds
        return ds

    def write_sequential(self, dsn: str, content: str) -> Dataset:
        ds = self.get_dataset(dsn)
        if ds.dsorg != DSOrg.PS:
            raise DatasetError(f"{dsn} is not a sequential dataset")
        ds.content = content
        ds.changed = datetime.utcnow().strftime("%Y/%m/%d %H:%M")
        return ds

    def write_member(self, dsn: str, member: str, content: str, userid: str = "HERC01") -> DatasetMember:
        ds = self.get_dataset(dsn)
        if ds.dsorg != DSOrg.PO:
            raise DatasetError(f"{dsn} is not a PDS")
        member = member.upper()
        if len(member) > 8:
            raise DatasetError(f"Member name too long: {member}")
        mbr = DatasetMember(name=member, content=content, userid=userid)
        mbr.update_size()
        ds.members[member] = mbr
        ds.changed = datetime.utcnow().strftime("%Y/%m/%d %H:%M")
        return mbr

    def delete_dataset(self, dsn: str) -> bool:
        dsn = dsn.upper()
        if dsn not in self._catalog:
            raise DatasetError(f"Dataset not found: {dsn}")
        del self._catalog[dsn]
        return True

    def delete_member(self, dsn: str, member: str) -> bool:
        ds = self.get_dataset(dsn)
        member = member.upper()
        if member not in ds.members:
            raise DatasetError(f"Member not found: {dsn}({member})")
        del ds.members[member]
        return True

    # ------------------------------------------------------------------
    # Seed helper
    # ------------------------------------------------------------------

    def seed_pds(self, dsn: str, volser: str = "MVSRES", lrecl: int = 80) -> Dataset:
        dsn = dsn.upper()
        ds = Dataset(dsn=dsn, dsorg=DSOrg.PO, recfm=RecFM.FB, lrecl=lrecl, blksize=3200, volser=volser)
        self._catalog[dsn] = ds
        return ds

    def seed_ps(self, dsn: str, content: str, volser: str = "MVSRES", lrecl: int = 80) -> Dataset:
        dsn = dsn.upper()
        ds = Dataset(dsn=dsn, dsorg=DSOrg.PS, recfm=RecFM.FB, lrecl=lrecl, blksize=3200, volser=volser, content=content)
        self._catalog[dsn] = ds
        return ds

    def seed_member(self, dsn: str, member: str, content: str, userid: str = "IBMUSER") -> None:
        ds = self._catalog.get(dsn.upper())
        if ds is None:
            return
        member = member.upper()
        mbr = DatasetMember(name=member, content=content, userid=userid)
        mbr.update_size()
        ds.members[member] = mbr
