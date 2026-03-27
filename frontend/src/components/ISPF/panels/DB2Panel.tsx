import React, { useState, useCallback, useRef, useEffect, KeyboardEvent } from 'react'
import { ISPFScreen } from '../ISPFScreen'
import { executeSQL, listTables, describeTable } from '../../../api/db2'
import type { SqlResult, ColumnDef } from '../../../api/db2'

interface Props {
  onBack: () => void
}

type SchemaView = 'tables' | 'columns'

interface SchemaState {
  tables: string[]
  selectedTable: string | null
  columns: ColumnDef[]
  view: SchemaView
  loading: boolean
}

const SEP = '─'.repeat(72)

// Fixed-width column formatter for tabular result display
function formatRow(values: (string | number | null)[], widths: number[]): string {
  return values
    .map((v, i) => {
      const s = v === null ? 'NULL' : String(v)
      return s.length > widths[i] ? s.slice(0, widths[i] - 1) + '…' : s.padEnd(widths[i])
    })
    .join('  ')
}

function computeWidths(columns: string[], rows: (string | number | null)[][]): number[] {
  return columns.map((col, ci) => {
    const maxData = rows.reduce((m, row) => {
      const s = row[ci] === null ? 'NULL' : String(row[ci])
      return Math.max(m, s.length)
    }, 0)
    return Math.min(Math.max(col.length, maxData), 30)
  })
}

export function DB2Panel({ onBack }: Props) {
  const [cmd, setCmd] = useState('')
  const [sql, setSql] = useState(
    'SELECT DSN, DSORG, LRECL, VOLSER\n  FROM HERC.DATASETS\n ORDER BY DSN'
  )
  const [result, setResult] = useState<SqlResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [scrollOffset, setScrollOffset] = useState(0)
  const [showSchema, setShowSchema] = useState(false)
  const [schema, setSchema] = useState<SchemaState>({
    tables: [],
    selectedTable: null,
    columns: [],
    view: 'tables',
    loading: false,
  })
  const sqlRef = useRef<HTMLTextAreaElement>(null)
  // Keep a ref to result so the global keydown handler always sees latest value
  const resultRef = useRef<SqlResult | null>(null)
  resultRef.current = result

  const PAGE_SIZE = 12

  // ------------------------------------------------------------------ //
  // SQL execution                                                        //
  // ------------------------------------------------------------------ //

  const runSQL = useCallback(async () => {
    const trimmed = sql.trim()
    if (!trimmed) return
    setLoading(true)
    setError(null)
    setResult(null)
    setScrollOffset(0)
    try {
      const res = await executeSQL(trimmed)
      setResult(res)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [sql])

  // ------------------------------------------------------------------ //
  // Schema browser                                                       //
  // ------------------------------------------------------------------ //

  const openSchema = useCallback(async () => {
    setShowSchema(true)
    setSchema(s => ({ ...s, loading: true, view: 'tables' }))
    try {
      const tables = await listTables()
      setSchema(s => ({ ...s, tables, loading: false }))
    } catch (e: unknown) {
      setSchema(s => ({ ...s, loading: false }))
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const selectTable = useCallback(async (table: string) => {
    setSchema(s => ({ ...s, selectedTable: table, loading: true, view: 'columns' }))
    try {
      const columns = await describeTable(table)
      setSchema(s => ({ ...s, columns, loading: false }))
    } catch (e: unknown) {
      setSchema(s => ({ ...s, loading: false }))
    }
  }, [])

  // Global F-key handler — prevents browser defaults (F5=refresh, etc.)
  // and works regardless of which element is focused
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'F5') { e.preventDefault(); runSQL() }
      if (e.key === 'F6') { e.preventDefault(); setSql(''); setResult(null); setError(null) }
      if (e.key === 'F9') { e.preventDefault(); setShowSchema(s => !s) }
      if (e.key === 'F7') { e.preventDefault(); setScrollOffset(o => Math.max(0, o - PAGE_SIZE)) }
      if (e.key === 'F8') {
        e.preventDefault()
        if (resultRef.current) {
          setScrollOffset(o => Math.min(resultRef.current!.rows.length - 1, o + PAGE_SIZE))
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [runSQL])

  // Focus textarea on mount so user can type immediately (without needing to click)
  useEffect(() => {
    const t = setTimeout(() => sqlRef.current?.focus(), 80)
    return () => clearTimeout(t)
  }, [])

  // ------------------------------------------------------------------ //
  // Command line handler                                                 //
  // ------------------------------------------------------------------ //

  const handleCommand = (val: string) => {
    const v = val.trim().toUpperCase()
    if (!v) return
    if (v === 'CLEAR' || v === 'CL') { setSql(''); setResult(null); setError(null); return }
    if (v === 'RUN' || v === 'R') { runSQL(); return }
    if (v === 'TABLES' || v === 'T') { openSchema(); return }
    if (v === 'BACK') { if (showSchema && schema.view === 'columns') {
      setSchema(s => ({ ...s, view: 'tables', selectedTable: null, columns: [] }))
    } else { setShowSchema(false) } }
  }

  const handleSqlKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'F5') { e.preventDefault(); runSQL() }
    if (e.key === 'F6') { e.preventDefault(); setSql(''); setResult(null); setError(null) }
    if (e.key === 'F9') { e.preventDefault(); showSchema ? setShowSchema(false) : openSchema() }
    if (e.key === 'F7') { e.preventDefault(); setScrollOffset(o => Math.max(0, o - PAGE_SIZE)) }
    if (e.key === 'F8') { e.preventDefault()
      if (result) setScrollOffset(o => Math.min(result.rows.length - 1, o + PAGE_SIZE))
    }
  }

  const pfKeys = [
    { label: 'F3',  action: 'Exit',   handler: onBack },
    { label: 'F5',  action: 'Run SQL', handler: runSQL },
    { label: 'F6',  action: 'Clear',  handler: () => { setSql(''); setResult(null); setError(null) } },
    { label: 'F7',  action: 'Up',     handler: () => setScrollOffset(o => Math.max(0, o - PAGE_SIZE)) },
    { label: 'F8',  action: 'Down',   handler: () => { if (result) setScrollOffset(o => Math.min(result.rows.length - 1, o + PAGE_SIZE)) } },
    { label: 'F9',  action: showSchema ? 'HideSchema' : 'Tables', handler: () => showSchema ? setShowSchema(false) : openSchema() },
    { label: 'F12', action: 'Cancel', handler: onBack },
  ]

  // ------------------------------------------------------------------ //
  // Styles (ISPF terminal look)                                         //
  // ------------------------------------------------------------------ //

  const monoBlock: React.CSSProperties = {
    fontFamily: 'inherit',
    fontSize: 'inherit',
    background: 'transparent',
    color: 'var(--z-yellow)',
    border: '1px solid var(--z-cyan)',
    outline: 'none',
    resize: 'vertical',
    width: '100%',
    boxSizing: 'border-box',
    padding: '2px 4px',
  }

  const labelStyle: React.CSSProperties = {
    color: 'var(--z-green)',
  }

  // ------------------------------------------------------------------ //
  // Result rendering                                                     //
  // ------------------------------------------------------------------ //

  const renderResults = () => {
    if (loading) return <div style={{ color: 'var(--z-cyan)', marginTop: 6 }}>{'DSQL0000I: EXECUTING SQL...'}</div>
    if (error)   return <div style={{ color: 'var(--z-red)', marginTop: 6 }}>{`DSQL ERROR: ${error}`}</div>
    if (!result) return null

    if (result.type === 'DML') {
      return (
        <div style={{ color: 'var(--z-green)', marginTop: 6 }}>
          {`DSQL0100I: ${result.rowcount} ROW(S) AFFECTED — ${result.elapsed_ms}MS`}
        </div>
      )
    }

    if (result.rows.length === 0) {
      return (
        <div style={{ color: 'var(--z-cyan)', marginTop: 6 }}>
          {'DSQL0200I: RESULT SET EMPTY — 0 ROWS FETCHED'}
        </div>
      )
    }

    const widths = computeWidths(result.columns, result.rows)
    const header = result.columns.map((c, i) => c.padEnd(widths[i])).join('  ')
    const underline = widths.map(w => '-'.repeat(w)).join('  ')
    const visibleRows = result.rows.slice(scrollOffset, scrollOffset + PAGE_SIZE)
    const rowEnd = Math.min(scrollOffset + PAGE_SIZE, result.rows.length)

    return (
      <div style={{ marginTop: 6 }}>
        <div style={{ color: 'var(--z-cyan)', marginBottom: 2 }}>
          {`${SEP}`}
        </div>
        <div style={{ color: 'var(--z-cyan)', marginBottom: 4 }}>
          {`DSQL0000I: ${result.rowcount} ROW(S) FETCHED — ${result.elapsed_ms}MS  (ROWS ${scrollOffset + 1}–${rowEnd} OF ${result.rows.length})`}
        </div>
        <pre style={{ margin: 0, color: 'var(--z-yellow)' }}>{header}</pre>
        <pre style={{ margin: 0, color: 'var(--z-green)' }}>{underline}</pre>
        {visibleRows.map((row, ri) => (
          <pre key={ri} style={{ margin: 0, color: 'var(--z-white)' }}>
            {formatRow(row, widths)}
          </pre>
        ))}
      </div>
    )
  }

  // ------------------------------------------------------------------ //
  // Schema sidebar rendering                                             //
  // ------------------------------------------------------------------ //

  const renderSchema = () => {
    if (!showSchema) return null

    return (
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 280,
        background: '#000', border: '1px solid var(--z-cyan)',
        padding: '4px 8px', zIndex: 10, overflowY: 'auto', maxHeight: '80vh',
      }}>
        <div style={{ color: 'var(--z-yellow)', marginBottom: 4 }}>
          {'─── HERC SCHEMA BROWSER ───'}
        </div>
        {schema.loading && <div style={{ color: 'var(--z-cyan)' }}>{'Loading...'}</div>}

        {schema.view === 'tables' && !schema.loading && (
          <>
            <div style={{ color: 'var(--z-green)', marginBottom: 4, fontSize: 11 }}>
              {'SELECT TABLE NAME TO DESCRIBE:'}
            </div>
            {schema.tables.length === 0
              ? <div style={{ color: 'var(--z-red)', fontSize: 11 }}>{'NO TABLES FOUND'}</div>
              : schema.tables.map(t => (
                <div
                  key={t}
                  style={{ color: 'var(--z-cyan)', cursor: 'pointer', padding: '1px 0' }}
                  onClick={() => selectTable(t)}
                >
                  {`  ${t}`}
                </div>
              ))
            }
          </>
        )}

        {schema.view === 'columns' && !schema.loading && (
          <>
            <div
              style={{ color: 'var(--z-green)', marginBottom: 4, fontSize: 11, cursor: 'pointer' }}
              onClick={() => setSchema(s => ({ ...s, view: 'tables', selectedTable: null, columns: [] }))}
            >
              {`◀ ${schema.selectedTable}`}
            </div>
            {schema.columns.map(col => (
              <div key={col.name} style={{ fontSize: 11, marginBottom: 2 }}>
                <span style={{ color: 'var(--z-yellow)' }}>{col.name.padEnd(16)}</span>
                <span style={{ color: 'var(--z-white)' }}>{col.type}</span>
                {col.nullable && <span style={{ color: 'var(--z-green)', marginLeft: 4 }}>{'NULL'}</span>}
              </div>
            ))}
          </>
        )}

        <div
          style={{ color: 'var(--z-red)', marginTop: 8, cursor: 'pointer', fontSize: 11 }}
          onClick={() => setShowSchema(false)}
        >
          {'[F9=CLOSE]'}
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------ //
  // Short message for header                                             //
  // ------------------------------------------------------------------ //

  const shortMsg = loading
    ? 'PROCESSING...'
    : error
    ? error.slice(0, 60)
    : result
    ? result.type === 'DML'
      ? `${result.rowcount} ROW(S) AFFECTED`
      : `${result.rowcount} ROW(S) FETCHED — ${result.elapsed_ms}MS`
    : 'ENTER SQL BELOW AND PRESS F5 TO EXECUTE'

  const shortMsgType = error ? 'err' : result ? 'ok' : 'info'

  // ------------------------------------------------------------------ //
  // Render                                                               //
  // ------------------------------------------------------------------ //

  return (
    <ISPFScreen
      panelTitle="SPUFI (SQL PROCESSOR USING FILE INPUT)"
      rowInfo="DB2 Interactive"
      shortMsg={shortMsg}
      shortMsgType={shortMsgType}
      commandValue={cmd}
      onCommandChange={setCmd}
      onCommandSubmit={handleCommand}
      pfKeys={pfKeys}
      longMsg="F5=Run SQL  F6=Clear  F9=Tables  F7/F8=Scroll results  F3=Exit"
    >
      <div style={{ position: 'relative' }}>
        {/* SQL input area */}
        <div style={{ ...labelStyle, marginBottom: 2 }}>
          {'SQL STATEMENT:'}
        </div>
        <textarea
          ref={sqlRef}
          value={sql}
          onChange={e => setSql(e.target.value)}
          onKeyDown={handleSqlKeyDown}
          onClick={e => e.stopPropagation()}   // prevent ISPFScreen stealing focus
          rows={5}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          style={monoBlock}
        />

        <div style={{ color: 'var(--z-cyan)', marginTop: 2, fontSize: 11 }}>
          {SEP}
        </div>

        {/* Results area */}
        {renderResults()}

        {/* Schema sidebar (absolute positioned) */}
        {renderSchema()}
      </div>
    </ISPFScreen>
  )
}
