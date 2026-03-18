import client from './client'

export interface FSNode {
  name: string
  node_type: 'file' | 'directory' | 'symlink'
  permissions: string
  owner: string
  group: string
  size: number
  modified: string
}

export async function lsDir(path: string, sessionId: string): Promise<FSNode[]> {
  const res = await client.get('/fs/ls', { params: { path, session_id: sessionId } })
  return res.data.data as FSNode[]
}
