import client from './client'

export interface ExecResult {
  output: string
  new_cwd: string
  exit_code: number
}

export async function execCommand(command: string, sessionId: string): Promise<ExecResult> {
  const res = await client.post('/terminal/exec', { command, session_id: sessionId })
  return res.data.data as ExecResult
}
