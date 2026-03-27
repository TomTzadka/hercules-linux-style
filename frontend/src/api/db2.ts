import client from './client'

export interface SqlResult {
  columns: string[]
  rows: (string | number | null)[][]
  rowcount: number
  type: 'SELECT' | 'DML'
  elapsed_ms: number
}

export interface ColumnDef {
  name: string
  type: string
  nullable: boolean
  default: string | null
}

export async function executeSQL(sql: string, maxRows = 500): Promise<SqlResult> {
  const res = await client.post('/db2/sql', { sql, max_rows: maxRows })
  if (!res.data.ok) throw new Error(res.data.error ?? 'Unknown DB2 error')
  return res.data.data as SqlResult
}

export async function listTables(): Promise<string[]> {
  const res = await client.get('/db2/tables')
  if (!res.data.ok) throw new Error(res.data.error ?? 'Unknown DB2 error')
  return res.data.data as string[]
}

export async function describeTable(table: string): Promise<ColumnDef[]> {
  const res = await client.get(`/db2/describe/${table}`)
  if (!res.data.ok) throw new Error(res.data.error ?? 'Unknown DB2 error')
  return res.data.data as ColumnDef[]
}
