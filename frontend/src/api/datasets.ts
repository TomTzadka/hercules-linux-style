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
  members: { name: string; size: number; changed: string; userid: string }[]
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
