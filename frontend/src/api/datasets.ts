import client from './client'

export interface DatasetInfo {
  dsn: string
  dsorg: string
  recfm: string
  lrecl: number
  volser: string
  created: string
  changed: string
  member_count: number | null
  migrated: boolean
  restricted?: boolean
  tracks_used?: number
  extents?: number
}

export interface DatasetDetail {
  dsn: string
  dsorg: string
  recfm: string
  lrecl: number
  volser: string
  created: string
  changed: string
  content: string | null
  members: { name: string; size: number; changed: string; userid: string; vv?: number; mm?: number }[]
}

export async function listDatasets(filter?: string): Promise<DatasetInfo[]> {
  const res = await client.get('/datasets', { params: filter ? { filter } : {} })
  return res.data.data as DatasetInfo[]
}

export async function getDataset(dsn: string): Promise<DatasetDetail> {
  const res = await client.get(`/datasets/${dsn}`)
  return res.data.data as DatasetDetail
}

export async function getMember(dsn: string, member: string): Promise<{ content: string }> {
  const res = await client.get(`/datasets/${dsn}/members/${member}`)
  return res.data.data
}

export async function writeMember(dsn: string, member: string, content: string): Promise<void> {
  await client.post(`/datasets/${dsn}/members/${member}`, { content })
}

export async function deleteMember(dsn: string, member: string): Promise<void> {
  await client.delete(`/datasets/${dsn}/members/${member}`)
}

export async function deleteDataset(dsn: string): Promise<void> {
  await client.delete(`/datasets/${dsn}`)
}

export async function searchDataset(
  dsn: string,
  q: string,
  anyc = false,
): Promise<{ dsn: string; query: string; result_count: number; results: { member: string; matches: { line: number; content: string }[] }[] }> {
  const res = await client.get(`/datasets/${dsn}/search`, { params: { q, anyc } })
  if (!res.data.ok) throw new Error(res.data.error)
  return res.data.data
}

export async function allocateDataset(
  dsn: string,
  dsorg: string = 'PS',
  recfm: string = 'FB',
  lrecl: number = 80,
  blksize: number = 3200,
  volser: string = 'USR001',
): Promise<{ dsn: string; dsorg: string }> {
  const res = await client.post('/datasets', { dsn, dsorg, recfm, lrecl, blksize, volser })
  if (!res.data.ok) throw new Error(res.data.error)
  return res.data.data
}
