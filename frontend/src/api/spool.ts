import client from './client'

export interface SpoolJobInfo {
  jobid: string
  jobname: string
  owner: string
  status: string
  submitted: string
  queue: string
  prty: number
  job_class: string
}

export interface SpoolJobDetail extends SpoolJobInfo {
  output: string
}

export async function listSpoolJobs(): Promise<SpoolJobInfo[]> {
  const res = await client.get('/spool/jobs')
  return res.data.data as SpoolJobInfo[]
}

export async function getSpoolJob(jobid: string): Promise<SpoolJobDetail> {
  const res = await client.get(`/spool/jobs/${jobid}`)
  return res.data.data as SpoolJobDetail
}

export async function submitJcl(jcl: string, owner: string): Promise<SpoolJobInfo> {
  const res = await client.post('/spool/submit', { jcl, owner })
  return res.data.data as SpoolJobInfo
}

export async function deleteSpoolJob(jobid: string): Promise<void> {
  await client.delete(`/spool/jobs/${jobid}`)
}

export async function cancelSpoolJob(jobid: string): Promise<void> {
  await client.post(`/spool/jobs/${jobid}/cancel`)
}
