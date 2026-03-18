import React, { useState, useEffect } from 'react'
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

  const handleSubmit = (val: string) => {
    const v = val.trim().toUpperCase()
    if (!v) return
    if (v === 'TOP') { setTopLine(0); return }
    if (v === 'BOTTOM' || v === 'BOT') { setTopLine(Math.max(0, lines.length - PAGE)); return }
    if (v === 'UP' || v === 'U') { setTopLine(Math.max(0, topLine - PAGE)); return }
    if (v === 'DOWN' || v === 'D') { setTopLine(Math.min(lines.length - 1, topLine + PAGE)); return }
    if (/^\d+$/.test(v)) { setTopLine(Math.min(Number(v) - 1, lines.length - 1)); return }
    setMsg(`UNKNOWN COMMAND: ${v}`)
    setMsgType('err')
  }

  const pfKeys = [
    { label: 'F1', action: 'Help' },
    { label: 'F2', action: 'Print' },
    { label: 'F3', action: 'Exit', handler: onBack },
    { label: 'F5', action: 'Rfind' },
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
      rowInfo={`Line ${String(topLine + 1).padStart(5, '0')} Col 001 080`}
      shortMsg={msg || undefined}
      shortMsgType={msgType}
      commandValue={cmd}
      onCommandChange={setCmd}
      onCommandSubmit={handleSubmit}
      scrollValue="CSR"
      pfKeys={pfKeys}
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
            const lineNum = String(topLine + i + 1).padStart(6, '0')
            return (
              <div key={topLine + i} className="browse-line">
                <span className="browse-linenum">{lineNum} </span>
                <span className={lineClass(line, fileType)}>{line}</span>
              </div>
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
