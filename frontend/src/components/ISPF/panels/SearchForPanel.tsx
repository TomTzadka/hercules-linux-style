import React, { useState } from 'react'
import { ISPFScreen } from '../ISPFScreen'
import client from '../../../api/client'

interface Props {
  initialDsn?: string
  onBack: () => void
}

interface MatchLine {
  line: number
  content: string
}

interface MemberResult {
  member: string
  matches: MatchLine[]
}

interface SearchResult {
  dsn: string
  query: string
  result_count: number
  results: MemberResult[]
}

export function SearchForPanel({ initialDsn = '', onBack }: Props) {
  const [cmd, setCmd] = useState('')
  const [msg, setMsg] = useState('ENTER SEARCH STRING AND DSN, THEN PRESS ENTER')
  const [msgType, setMsgType] = useState<'ok' | 'err' | 'info'>('info')

  const [searchStr, setSearchStr] = useState('')
  const [dsn, setDsn] = useState(initialDsn)
  const [anyc, setAnyc] = useState(false)
  const [results, setResults] = useState<SearchResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const runSearch = async (srchStr: string, srchDsn: string, caseFlag: boolean) => {
    if (!srchStr.trim()) { setMsg('ENTER A SEARCH STRING'); setMsgType('err'); return }
    if (!srchDsn.trim()) { setMsg('ENTER A DATASET NAME'); setMsgType('err'); return }
    setSearching(true)
    setMsg('SEARCHING...')
    setMsgType('info')
    try {
      const res = await client.get(`/datasets/${srchDsn.toUpperCase()}/search`, {
        params: { q: srchStr, anyc: caseFlag },
      })
      if (!res.data.ok) {
        setMsg(res.data.error ?? 'SEARCH FAILED')
        setMsgType('err')
        setResults(null)
      } else {
        const r = res.data.data as SearchResult
        setResults(r)
        setExpanded(new Set(r.results.map((m: MemberResult) => m.member)))
        if (r.result_count === 0) {
          setMsg(`NO MATCHES FOUND FOR '${srchStr}' IN ${r.dsn}`)
          setMsgType('info')
        } else {
          setMsg(`${r.result_count} MATCH${r.result_count === 1 ? '' : 'ES'} IN ${r.results.length} MEMBER${r.results.length === 1 ? '' : 'S'} — ANYC: ${caseFlag ? 'YES' : 'NO'}`)
          setMsgType('ok')
        }
      }
    } catch {
      setMsg('ERROR CONTACTING SERVER')
      setMsgType('err')
      setResults(null)
    } finally {
      setSearching(false)
    }
  }

  const handleSubmit = (val: string) => {
    const v = val.trim().toUpperCase()
    if (!v) {
      // Enter with no command: run search with current fields
      runSearch(searchStr, dsn, anyc)
      return
    }
    if (v === 'END' || v === 'EXIT' || v === 'CANCEL') { onBack(); return }
    if (v === 'ANYC' || v === 'ANYC ON') { setAnyc(true); setMsg('ANYCASE: ON — CASE-INSENSITIVE SEARCH'); setMsgType('info'); return }
    if (v === 'ANYC OFF') { setAnyc(false); setMsg('ANYCASE: OFF — CASE-SENSITIVE SEARCH'); setMsgType('info'); return }
    if (v.startsWith('SRCHFOR ') || v.startsWith('FIND ')) {
      const rest = val.trim().slice(v.startsWith('SRCHFOR ') ? 8 : 5).trim()
      // Strip surrounding quotes if present
      const stripped = rest.startsWith("'") && rest.endsWith("'") ? rest.slice(1, -1)
        : rest.startsWith('"') && rest.endsWith('"') ? rest.slice(1, -1) : rest
      setSearchStr(stripped)
      runSearch(stripped, dsn, anyc)
      return
    }
    if (v.startsWith('DSN ') || v.startsWith('DSN(')) {
      // DSN(MY.PDS) or DSN MY.PDS
      const raw = val.trim().slice(3).trim()
      const stripped = raw.startsWith('(') && raw.endsWith(')') ? raw.slice(1, -1) : raw
      setDsn(stripped.toUpperCase())
      setMsg(`DSN SET TO ${stripped.toUpperCase()} — PRESS ENTER TO SEARCH`)
      setMsgType('info')
      return
    }
    setMsg(`UNKNOWN COMMAND: ${v}`)
    setMsgType('err')
  }

  const toggleMember = (member: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(member)) next.delete(member)
      else next.add(member)
      return next
    })
  }

  const pfKeys = [
    { label: 'F1', action: 'Help' },
    { label: 'F3', action: 'Exit', handler: onBack },
    { label: 'F5', action: 'RFind', handler: () => runSearch(searchStr, dsn, anyc) },
    { label: 'F12', action: 'Cancel', handler: onBack },
  ]

  return (
    <ISPFScreen
      panelTitle="ISPF Search-For Utility — Option 3.13"
      rowInfo="SRCHFOR"
      shortMsg={msg}
      shortMsgType={msgType}
      commandValue={cmd}
      onCommandChange={setCmd}
      onCommandSubmit={handleSubmit}
      pfKeys={pfKeys}
      longMsg="Type SRCHFOR 'str' to search, DSN(name) to set dataset, ANYC for case-insensitive. ENTER to run."
    >
      <div style={{ padding: '0.5em 2ch', color: 'var(--z-white)', fontFamily: 'inherit' }}>

        {/* Input fields */}
        <div style={{ marginBottom: '0.8em', borderBottom: '1px solid var(--z-green)', paddingBottom: '0.5em' }}>
          <div style={{ display: 'flex', gap: '2ch', marginBottom: '0.3em' }}>
            <span style={{ color: 'var(--z-cyan)', width: '22ch', flexShrink: 0 }}>  Search string  . . . :</span>
            <span
              style={{
                color: 'var(--z-yellow)',
                flex: 1,
                background: 'rgba(170,170,0,0.08)',
                padding: '0 4px',
                cursor: 'text',
                minWidth: '30ch',
              }}
              onClick={() => {
                const v = window.prompt('Search string:', searchStr) ?? searchStr
                setSearchStr(v)
              }}
            >
              {searchStr || '(click to set or type SRCHFOR \'str\')'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '2ch', marginBottom: '0.3em' }}>
            <span style={{ color: 'var(--z-cyan)', width: '22ch', flexShrink: 0 }}>  Dataset name  . . . :</span>
            <span
              style={{
                color: 'var(--z-yellow)',
                flex: 1,
                background: 'rgba(170,170,0,0.08)',
                padding: '0 4px',
                cursor: 'text',
                minWidth: '30ch',
              }}
              onClick={() => {
                const v = window.prompt('Dataset name (PDS):', dsn) ?? dsn
                setDsn(v.toUpperCase())
              }}
            >
              {dsn || '(click to set or type DSN(name))'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '2ch' }}>
            <span style={{ color: 'var(--z-cyan)', width: '22ch', flexShrink: 0 }}>  Case-insensitive  . :</span>
            <span
              style={{ color: anyc ? 'var(--z-yellow)' : 'var(--z-green)', cursor: 'pointer' }}
              onClick={() => { setAnyc(a => !a) }}
            >
              {anyc ? 'YES (ANYC)' : 'NO'}
            </span>
            <span style={{ color: 'var(--z-green)', fontSize: 11 }}>(click to toggle)</span>
          </div>
        </div>

        {/* Search button row */}
        <div style={{ marginBottom: '1em' }}>
          <span
            style={{
              color: 'var(--z-yellow)', cursor: 'pointer',
              border: '1px solid var(--z-green)', padding: '1px 8px',
              marginRight: '2ch',
            }}
            onClick={() => runSearch(searchStr, dsn, anyc)}
          >
            {searching ? 'SEARCHING...' : 'SEARCH (ENTER)'}
          </span>
          <span style={{ color: 'var(--z-green)', fontSize: 11 }}>or press ENTER with no command</span>
        </div>

        {/* Results */}
        {results && (
          <div>
            <div style={{ color: 'var(--z-cyan)', marginBottom: '0.5em' }}>
              {'─'.repeat(60)}<br/>
              {`  RESULTS: ${results.result_count} match${results.result_count === 1 ? '' : 'es'} in ${results.results.length} member${results.results.length === 1 ? '' : 's'} of ${results.dsn}`}
            </div>
            {results.results.length === 0 && (
              <div style={{ color: 'var(--z-white)', paddingLeft: '4ch' }}>
                - - -  NO MATCHES FOUND  - - -
              </div>
            )}
            {results.results.map(mr => (
              <div key={mr.member} style={{ marginBottom: '0.5em' }}>
                <div
                  style={{ color: 'var(--z-yellow)', cursor: 'pointer', paddingLeft: '2ch' }}
                  onClick={() => toggleMember(mr.member)}
                >
                  {expanded.has(mr.member) ? '▼' : '▶'} {results.dsn}({mr.member})  —  {mr.matches.length} match{mr.matches.length === 1 ? '' : 'es'}
                </div>
                {expanded.has(mr.member) && (
                  <div style={{ paddingLeft: '6ch', borderLeft: '2px solid var(--z-green)', marginLeft: '4ch' }}>
                    {mr.matches.map(ml => (
                      <div key={ml.line} style={{ display: 'flex', gap: '2ch', marginBottom: '1px' }}>
                        <span style={{ color: 'var(--z-cyan)', width: '6ch', flexShrink: 0, textAlign: 'right' }}>
                          {String(ml.line).padStart(4)}
                        </span>
                        <span style={{ color: 'var(--z-white)', fontFamily: 'inherit' }}>
                          {highlightMatch(ml.content, results.query, anyc)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </ISPFScreen>
  )
}

function highlightMatch(line: string, query: string, caseInsensitive: boolean): React.ReactNode {
  if (!query) return line
  const idx = caseInsensitive
    ? line.toLowerCase().indexOf(query.toLowerCase())
    : line.indexOf(query)
  if (idx < 0) return line
  const before = line.slice(0, idx)
  const match = line.slice(idx, idx + query.length)
  const after = line.slice(idx + query.length)
  return (
    <>
      {before}
      <span style={{ color: 'var(--z-yellow)', background: 'rgba(170,170,0,0.2)' }}>{match}</span>
      {after}
    </>
  )
}
