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
  const res = await client.get('/fs/ls', { params: { path } })
  return res.data.data as FSNode[]
}

export async function catFile(path: string, sessionId: string): Promise<string> {
  const res = await client.get('/fs/cat', { params: { path } })
  return res.data.data.content as string
}

export async function writeFile(path: string, content: string, sessionId: string): Promise<void> {
  await client.post('/fs/write', { path, content, session_id: sessionId })
}
