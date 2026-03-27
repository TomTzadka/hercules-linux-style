from fastapi import APIRouter, Depends
from pydantic import BaseModel, validator
from app.dependencies import get_jobs, JobEngine
from app.models.responses import ok, err, APIResponse

router = APIRouter(prefix="/api/spool", tags=["spool"])

_JCL_MAX_BYTES = 64_000


class SubmitBody(BaseModel):
    jcl: str
    owner: str = "TOMTZ"

    @validator('jcl')
    def jcl_max_size(cls, v: str) -> str:
        if len(v.encode()) > _JCL_MAX_BYTES:
            raise ValueError("JCL exceeds maximum size of 64KB")
        return v


def _job_meta(job):
    return {
        "jobid": job.jobid,
        "jobname": job.jobname,
        "owner": job.owner,
        "status": job.status,
        "submitted": job.submitted,
        "queue": job.queue,
        "prty": job.prty,
        "job_class": job.job_class,
    }


@router.get("/jobs", response_model=APIResponse)
def list_jobs(jobs: JobEngine = Depends(get_jobs)):
    return ok([_job_meta(j) for j in jobs.list_jobs()])


@router.get("/jobs/{jobid}", response_model=APIResponse)
def get_job(jobid: str, jobs: JobEngine = Depends(get_jobs)):
    job = jobs.get_job(jobid)
    if job is None:
        return err(f"Job {jobid} not found in spool")
    return ok({**_job_meta(job), "output": job.output, "jcl": job.jcl})


@router.delete("/jobs/{jobid}", response_model=APIResponse)
def delete_job(jobid: str, jobs: JobEngine = Depends(get_jobs)):
    if jobs.delete_job(jobid):
        return ok({"deleted": jobid})
    return err(f"Job {jobid} not found in spool")


@router.post("/jobs/{jobid}/cancel", response_model=APIResponse)
def cancel_job(jobid: str, jobs: JobEngine = Depends(get_jobs)):
    if jobs.cancel_job(jobid):
        return ok({"cancelled": jobid})
    return err(f"Job {jobid} not found in spool")


@router.post("/submit", response_model=APIResponse)
def submit_jcl(body: SubmitBody, jobs: JobEngine = Depends(get_jobs)):
    try:
        job = jobs.submit(body.jcl, body.owner)
        return ok(_job_meta(job))
    except ValueError as e:
        return err(str(e))
