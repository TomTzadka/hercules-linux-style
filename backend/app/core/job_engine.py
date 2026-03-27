"""
In-memory JES2 spool / job queue engine.
Stores submitted JCL jobs and their output for display in SDSF.
"""
from __future__ import annotations
import random
import re
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class SpoolJob:
    jobid: str
    jobname: str
    owner: str
    status: str        # CC0000 | CC0004 | CC0008 | ACTIVE | INPUT
    submitted: str     # HH.MM.SS
    output: str        # Full JES2 spool text
    queue: str = "OUTPUT"
    prty: int = 5
    job_class: str = "A"
    jcl: str = ""      # Original JCL submitted


def _parse_jobname(jcl: str) -> tuple[str, str]:
    """Return (jobname, class) from the //JOBNAME JOB ... line."""
    for line in jcl.splitlines():
        stripped = line.strip()
        if stripped.startswith("//") and not stripped.startswith("//*"):
            rest = stripped[2:]
            parts = rest.split()
            if len(parts) >= 2 and parts[1].upper() == "JOB":
                jobname = parts[0] or "UNKNOWN"
                # Extract CLASS=x
                m = re.search(r"CLASS=([A-Z])", rest, re.IGNORECASE)
                job_class = m.group(1).upper() if m else "A"
                return jobname[:8].upper(), job_class
    return "UNKNOWN", "A"


def _generate_output(jobid: str, jobname: str, job_class: str,
                     submitted: str, jcl: str) -> str:
    """Build a realistic JES2 spool listing."""
    jcl_lines = [l for l in jcl.splitlines() if l.strip()]
    input_tail = "\n".join(f"      {i+1:>3}  {l}" for i, l in enumerate(jcl_lines[:8]))
    n_stmts = len([l for l in jcl_lines if l.strip().startswith("//")])

    return (
        f"J E S 2  J O B  L O G  --  S Y S T E M  M V S 3 8 J  --  NODE  MVS38J\n"
        f"{'─'*70}\n"
        f"                   J E S 2  I N P U T  T A I L\n"
        f"{'─'*70}\n"
        f"{input_tail}\n"
        f"{'─'*70}\n"
        f"                   J E S 2  J O B  L O G\n"
        f"{'─'*70}\n"
        f"{jobid}  $HASP373 {jobname:<8} STARTED - INIT  1 - CLASS {job_class} - SYS MVS38J\n"
        f"{jobid}  IEF236I ALLOC. FOR {jobname} STEP1\n"
        f"{jobid}  IEF285I   SYS1.LINKLIB                               KEPT\n"
        f"{jobid}  IEF285I   SYS1.PARMLIB                               KEPT\n"
        f"{jobid}  IEF142I {jobname} STEP1 - STEP WAS EXECUTED - COND CODE 0000\n"
        f"{jobid}  IEF374I STEP      /STEP1   / START {submitted.replace('.','')[:6]}\n"
        f"{jobid}  IEF375I JOB  /{jobname:<8}/ STOP  {submitted.replace('.','')[:6]} CPU  0MIN 00.01SEC\n"
        f"{jobid}  IEF404I {jobname} - ENDED - TIME={submitted}  MVS38J\n"
        f"{jobid}  $HASP395 {jobname:<8} ENDED\n"
        f"{'─'*70}\n"
        f"                   J E S 2  J O B  S T A T I S T I C S\n"
        f"{'─'*70}\n"
        f"        {n_stmts:>3} JCL STATEMENTS\n"
        f"          0 RECORDS READ FROM SYSIN\n"
        f"          1 RECORDS WRITTEN TO SYSOUT\n"
        f"          0 SYSOUT DATA SETS ALLOCATED\n"
        f"{'─'*70}\n"
        f"  ------ JES2 JOB STATISTICS ------\n"
        f"  {datetime.now().strftime('%d %b %Y')} JOB EXECUTION DATE\n"
        f"  RETURN CODE = 0000\n"
    )


def _validate_jcl(jcl: str) -> None:
    """Raise ValueError with a JES2-style message if JCL is invalid."""
    lines = jcl.splitlines()

    # Check first non-blank line starts with //
    first = next((l for l in lines if l.strip()), "")
    if not first.startswith("//"):
        raise ValueError(
            "JCLC001E STATEMENT 1 — FIRST CHARACTER NOT '/' — RC=12"
        )

    # Check line lengths (content must fit in columns 1-72; 73-80 are sequence)
    for i, line in enumerate(lines, 1):
        if len(line) > 80:
            raise ValueError(
                f"JCLC002W STATEMENT {i} — LINE EXCEEDS 80 COLUMNS — RC=4\n"
                f"  '{line[:40]}...'"
            )

    # Extract non-comment JCL statements
    stmts = [l for l in lines if l.startswith("//") and not l.startswith("//*")]

    # Must have a JOB card
    has_job = any(
        len(l[2:].split()) >= 2 and l[2:].split()[1].upper() == "JOB"
        for l in stmts
    )
    if not has_job:
        raise ValueError(
            "JCLC003E NO JOB STATEMENT FOUND — A JOB CARD IS REQUIRED — RC=8\n"
            "  EXPECTED: //JOBNAME JOB ..."
        )

    # Must have at least one EXEC statement
    has_exec = any(
        len(l[2:].split()) >= 2 and l[2:].split()[1].upper().startswith("EXEC")
        for l in stmts
    )
    if not has_exec:
        raise ValueError(
            "JCLC004E NO EXEC STATEMENT FOUND — AT LEAST ONE STEP IS REQUIRED — RC=8\n"
            "  EXPECTED: //STEPNAME EXEC PGM=..."
        )


class JobEngine:
    def __init__(self) -> None:
        self._jobs: dict[str, SpoolJob] = {}

    def _new_jobid(self) -> str:
        while True:
            jid = f"JOB{random.randint(10000, 99999)}"
            if jid not in self._jobs:
                return jid

    def cancel_job(self, jobid: str) -> bool:
        """Set job status to CANCELLED without removing it from spool."""
        key = jobid.upper()
        if key in self._jobs:
            self._jobs[key].status = "CANCELLED"
            return True
        return False

    def submit(self, jcl: str, owner: str) -> SpoolJob:
        """Validate, store, and return a new spool job."""
        _validate_jcl(jcl)

        jobname, job_class = _parse_jobname(jcl)
        jobid = self._new_jobid()
        submitted = datetime.now().strftime("%H.%M.%S")
        output = _generate_output(jobid, jobname, job_class, submitted, jcl)

        job = SpoolJob(
            jobid=jobid,
            jobname=jobname,
            owner=owner.upper(),
            status="CC0000",
            submitted=submitted,
            output=output,
            queue="OUTPUT",
            prty=5,
            job_class=job_class,
            jcl=jcl,
        )
        self._jobs[jobid] = job
        return job

    def list_jobs(self) -> list[SpoolJob]:
        return list(self._jobs.values())

    def get_job(self, jobid: str) -> SpoolJob | None:
        return self._jobs.get(jobid.upper())

    def delete_job(self, jobid: str) -> bool:
        key = jobid.upper()
        if key in self._jobs:
            del self._jobs[key]
            return True
        return False
