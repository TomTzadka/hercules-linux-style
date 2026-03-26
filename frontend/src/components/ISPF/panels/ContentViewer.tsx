import React, { useState, useEffect, useRef } from 'react'
import { ISPFScreen } from '../ISPFScreen'
import { getMember } from '../../../api/datasets'
import client from '../../../api/client'

interface Props {
  dsn?: string
  member?: string
  ussPath?: string
  label?: string        // display label in header
  content?: string      // pre-loaded content (skip fetch)
  onBack: () => void
}

function detectType(label: string): 'jcl' | 'cobol' | 'asm' | 'generic' {
  const l = label.toUpperCase()
  if (l.includes('JCL') || l.includes('.CNTL')) return 'jcl'
  if (l.includes('COBOL') || l.includes('.SRC') || l.includes('.CBL')) return 'cobol'
  if (l.includes('ASM') || l.includes('.MAC')) return 'asm'
  return 'generic'
}

function lineClass(line: string, type: string): string {
  if (type === 'jcl') {
    if (line.startsWith('//') || line.startsWith('//*')) return 'browse-content--jcl'
    if (line.startsWith('/*')) return 'browse-content--jcl'
    return 'browse-content'
  }
  if (type === 'cobol') {
    if (line.trimStart().startsWith('*')) return 'browse-content--comment'
    return 'browse-content--cobol'
  }
  return 'browse-content'
}

export function ContentViewer({ dsn, member, ussPath, label, content: initContent, onBack }: Props) {
  const [lines, setLines] = useState<string[]>([])
  const [cmd, setCmd] = useState('')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'ok'|'err'|'info'>('ok')
  const [loading, setLoading] = useState(!initContent)
  const [topLine, setTopLine] = useState(0)
  const [findMatch, setFindMatch] = useState<number | null>(null)
  const [hexMode, setHexMode] = useState(false)
  const lastFind = useRef('')

  const toHexRow = (s: string) =>
    Array.from(s).map(c => c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')).join(' ')

  const displayLabel = label ?? dsn ?? ussPath ?? 'UNKNOWN'
  const fileType = detectType(displayLabel)

  useEffect(() => {
    if (initContent) {
      setLines(initContent.split('\n'))
      return
    }
    setLoading(true)
    const load = async () => {
      try {
        let text = ''
        if (dsn && member) {
          const m = await getMember(dsn, member)
          text = m.content
        } else if (ussPath) {
          const res = await client.get('/fs/cat', { params: { path: ussPath } })
          text = res.data.data?.content ?? ''
        }
        setLines(text.split('\n'))
        setMsg('BROWSE')
        setMsgType('ok')
      } catch {
        setMsg('MEMBER NOT FOUND')
        setMsgType('err')
        setLines(['** ERROR: COULD NOT LOAD CONTENT **'])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [dsn, member, ussPath, initContent])

  const PAGE = 20
  const visibleLines = lines.slice(topLine, topLine + 200)
  const atTop = topLine === 0
  const atBottom = topLine + PAGE >= lines.length

  const doFind = (pattern: string, direction: 'NEXT' | 'PREV' | 'FIRST' | 'LAST') => {
    lastFind.current = pattern
    let foundIdx = -1
    if (direction === 'FIRST') {
      foundIdx = lines.findIndex(l => l.includes(pattern))
    } else if (direction === 'LAST') {
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].includes(pattern)) { foundIdx = i; break }
      }
    } else if (direction === 'PREV') {
      for (let i = topLine - 1; i >= 0; i--) {
        if (lines[i].includes(pattern)) { foundIdx = i; break }
      }
    } else {
      // NEXT: search from current position + 1
      foundIdx = lines.findIndex((l, i) => i > topLine && l.includes(pattern))
      // If not found forward, also check current line
      if (foundIdx < 0) foundIdx = lines.findIndex((l, i) => i >= topLine && l.includes(pattern))
    }

    if (foundIdx >= 0) {
      setTopLine(foundIdx)
      setFindMatch(foundIdx)
      setMsg(`CHARS '${pattern}' FOUND AT LINE ${foundIdx + 1}`)
      setMsgType('ok')
    } else {
      setFindMatch(null)
      setMsg(`STRING NOT FOUND: '${pattern}'`)
      setMsgType('err')
    }
  }

  const handleSubmit = (val: string) => {
    const v = val.trim().toUpperCase()
    if (!v) return
    if (v === 'TOP') { setTopLine(0); setMsg('TOP OF DATA'); setMsgType('info'); return }
    if (v === 'BOTTOM' || v === 'BOT') { setTopLine(Math.max(0, lines.length - PAGE)); setMsg('BOTTOM OF DATA'); setMsgType('info'); return }
    if (v === 'UP' || v === 'U') { setTopLine(Math.max(0, topLine - PAGE)); return }
    if (v === 'DOWN' || v === 'D') { setTopLine(Math.min(lines.length - 1, topLine + PAGE)); return }
    if (/^\d+$/.test(v)) { setTopLine(Math.min(Number(v) - 1, lines.length - 1)); return }

    // FIND / F
    if (v.startsWith('FIND ') || v.startsWith('F ')) {
      const rest = val.trim().slice(val.trim().indexOf(' ') + 1).trim()
      const upper = rest.toUpperCase()
      let pattern = rest
      let direction: 'NEXT' | 'PREV' | 'FIRST' | 'LAST' = 'NEXT'
      if (upper.endsWith(' PREV')) { pattern = rest.slice(0, -5).trim(); direction = 'PREV' }
      else if (upper.endsWith(' FIRST')) { pattern = rest.slice(0, -6).trim(); direction = 'FIRST' }
      else if (upper.endsWith(' LAST')) { pattern = rest.slice(0, -5).trim(); direction = 'LAST' }
      // Strip surrounding quotes
      if ((pattern.startsWith("'") && pattern.endsWith("'")) ||
          (pattern.startsWith('"') && pattern.endsWith('"'))) {
        pattern = pattern.slice(1, -1)
      }
      doFind(pattern, direction)
      return
    }

    // RFIND
    if (v === 'RFIND') {
      if (!lastFind.current) { setMsg('NO PREVIOUS FIND STRING'); setMsgType('err'); return }
      doFind(lastFind.current, 'NEXT')
      return
    }

    if (v === 'HEX ON' || v === 'HEX') { setHexMode(true); setMsg('HEX ON'); setMsgType('ok'); return }
    if (v === 'HEX OFF') { setHexMode(false); setMsg('HEX OFF'); setMsgType('ok'); return }

    setMsg(`UNKNOWN COMMAND: ${v}`)
    setMsgType('err')
  }

  const pfKeys = [
    { label: 'F1', action: 'Help' },
    { label: 'F2', action: 'Print' },
    { label: 'F3', action: 'Exit', handler: onBack },
    { label: 'F5', action: 'Rfind', handler: () => {
      if (!lastFind.current) { setMsg('NO PREVIOUS FIND STRING'); setMsgType('err'); return }
      doFind(lastFind.current, 'NEXT')
    }},
    { label: 'F6', action: 'Rchange' },
    { label: 'F7', action: 'Up', handler: () => setTopLine(Math.max(0, topLine - PAGE)) },
    { label: 'F8', action: 'Down', handler: () => setTopLine(Math.min(lines.length - 1, topLine + PAGE)) },
    { label: 'F9', action: 'Swap' },
    { label: 'F10', action: 'Left' },
    { label: 'F11', action: 'Right' },
    { label: 'F12', action: 'Cancel', handler: onBack },
  ]

  return (
    <ISPFScreen
      panelTitle={`BROWSE   ${displayLabel}`}
      rowInfo={`Line ${String(topLine + 1).padStart(5, '0')} Col 001 080${hexMode ? '  HEX' : ''}`}
      shortMsg={msg || undefined}
      shortMsgType={msgType}
      commandValue={cmd}
      onCommandChange={setCmd}
      onCommandSubmit={handleSubmit}
      scrollValue="CSR"
      pfKeys={pfKeys}
      longMsg="Commands: TOP  BOTTOM  UP  DOWN  FIND str  RFIND (F5)  HEX ON/OFF"
    >
      {/* Column ruler */}
      <div className="browse-col-header">
        {' COLUMNS 001 through 072                                                    '}
      </div>

      {loading && <div className="ispf-loading"> Loading content...</div>}

      {!loading && (
        <>
          {/* Top of Data marker */}
          {atTop && (
            <div className="browse-line">
              <span className="browse-linenum browse-linenum--marker">{'****** '}</span>
              <span className="browse-content--marker">
                {'***************************** Top of Data ******************************'}
              </span>
            </div>
          )}

          {visibleLines.map((line, i) => {
            const absIdx = topLine + i
            const lineNum = String(absIdx + 1).padStart(6, '0')
            const isMatch = absIdx === findMatch
            return (
              <React.Fragment key={topLine + i}>
                <div
                  className="browse-line"
                  style={isMatch ? { background: 'var(--z-cyan)', color: '#000' } : undefined}
                >
                  <span className="browse-linenum" style={isMatch ? { color: '#000' } : undefined}>{lineNum} </span>
                  <span className={lineClass(line, fileType)} style={isMatch ? { color: '#000' } : undefined}>{line}</span>
                </div>
                {hexMode && (
                  <div className="browse-line" style={{ opacity: 0.75 }}>
                    <span className="browse-linenum" style={{ color: 'var(--z-cyan)' }}>{'...... '}</span>
                    <span style={{ color: 'var(--z-cyan)', fontSize: '0.85em', whiteSpace: 'pre' }}>{toHexRow(line)}</span>
                  </div>
                )}
              </React.Fragment>
            )
          })}

          {/* Bottom of Data marker */}
          {atBottom && (
            <div className="browse-line">
              <span className="browse-linenum browse-linenum--marker">{'****** '}</span>
              <span className="browse-content--marker">
                {'**************************** Bottom of Data ****************************'}
              </span>
            </div>
          )}
        </>
      )}
    </ISPFScreen>
  )
}
