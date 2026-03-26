import React, { useState, useEffect, useRef, useCallback } from 'react'
import { ISPFScreen } from '../ISPFScreen'
import { catFile, writeFile } from '../../../api/filesystem'
import { getMember, writeMember } from '../../../api/datasets'

interface Props {
  ussPath?: string
  dsn?: string
  member?: string
  sessionId: string
  onBack: () => void
}

const VISIBLE_LINES = 20

export function EditPanel({ ussPath, dsn, member, sessionId, onBack }: Props) {
  const [lines, setLines] = useState<string[]>([])
  const [modified, setModified] = useState(false)
  const [cmd, setCmd] = useState('')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'ok' | 'err' | 'info'>('info')
  const [loading, setLoading] = useState(true)
  const [topLine, setTopLine] = useState(0)
  const [exitConfirm, setExitConfirm] = useState(false)
  const prefixCmdsRef = useRef<Record<number, string>>({})
  const lastFind = useRef('')

  const fileLabel = ussPath
    ? ussPath
    : `${dsn}(${member})`

  const title = `EDIT - ${fileLabel}${modified ? ' *' : ''}`

  useEffect(() => {
    setLoading(true)
    const load = async () => {
      try {
        let content = ''
        if (ussPath) {
          content = await catFile(ussPath, sessionId)
        } else if (dsn && member) {
          const result = await getMember(dsn, member)
          content = result.content
        }
        setLines(content.split('\n'))
        setMsg('EDIT MODE  —  SAVE to save  |  CANCEL to exit without saving')
        setMsgType('info')
      } catch {
        setMsg('ERROR LOADING FILE')
        setMsgType('err')
        setLines([''])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [ussPath, dsn, member, sessionId])

  const save = useCallback(async () => {
    const content = lines.join('\n')
    try {
      if (ussPath) {
        await writeFile(ussPath, content, sessionId)
      } else if (dsn && member) {
        await writeMember(dsn, member, content)
      }
      setModified(false)
      setMsg('FILE SAVED')
      setMsgType('ok')
    } catch {
      setMsg('SAVE FAILED — CHECK PERMISSIONS')
      setMsgType('err')
    }
  }, [lines, ussPath, dsn, member, sessionId])

  const handleLineChange = (idx: number, value: string) => {
    setLines(prev => {
      const next = [...prev]
      next[idx] = value
      return next
    })
    setModified(true)
  }

  const applyPrefixCmds = () => {
    const cmds = prefixCmdsRef.current
    const indices = Object.keys(cmds).map(Number).sort((a, b) => a - b)
    if (indices.length === 0) return

    let newLines = [...lines]
    let offset = 0

    // Handle DD block-delete first
    const ddLines = indices.filter(i => cmds[i]?.trim().toUpperCase() === 'DD')
    if (ddLines.length >= 2) {
      const start = ddLines[0] + offset
      const end = ddLines[ddLines.length - 1] + offset
      newLines.splice(start, end - start + 1)
      offset -= (end - start + 1)
      ddLines.forEach(i => { delete cmds[i] })
    }

    for (const i of indices) {
      const c = (cmds[i] || '').trim().toUpperCase()
      if (!c) continue
      const adj = i + offset
      if (c === 'D') {
        newLines.splice(adj, 1)
        offset -= 1
      } else if (c === 'I') {
        newLines.splice(adj + 1, 0, '')
        offset += 1
      } else if (/^R(\d*)$/.test(c)) {
        const count = parseInt(c.slice(1) || '1', 10) || 1
        const copies = Array(count).fill(newLines[adj])
        newLines.splice(adj + 1, 0, ...copies)
        offset += count
      }
    }

    prefixCmdsRef.current = {}

    if (newLines.join('\n') !== lines.join('\n')) {
      setLines(newLines)
      setModified(true)
    }
  }

  const handleSubmit = async (val: string) => {
    const v = val.trim().toUpperCase()

    if (!v) {
      applyPrefixCmds()
      return
    }

    if (v === 'SAVE') {
      await save()
      return
    }

    if (v === 'CANCEL' || v === 'QUIT' || v === 'Q') {
      if (modified) {
        setExitConfirm(true)
        setMsg('FILE NOT SAVED.  TYPE YES TO EXIT  OR  NO TO CANCEL.')
        setMsgType('err')
      } else {
        onBack()
      }
      return
    }

    if (exitConfirm) {
      if (v === 'YES') { onBack(); return }
      if (v === 'NO') { setExitConfirm(false); setMsg(''); return }
    }

    if (v === 'TOP') {
      setTopLine(0)
      setMsg('TOP OF DATA')
      setMsgType('info')
      return
    }

    if (v === 'BOTTOM' || v === 'BOT') {
      setTopLine(Math.max(0, lines.length - VISIBLE_LINES))
      setMsg('BOTTOM OF DATA')
      setMsgType('info')
      return
    }

    if (v.startsWith('UP')) {
      const n = parseInt(v.slice(2).trim() || String(VISIBLE_LINES), 10) || VISIBLE_LINES
      setTopLine(prev => Math.max(0, prev - n))
      return
    }

    if (v.startsWith('DOWN')) {
      const n = parseInt(v.slice(4).trim() || String(VISIBLE_LINES), 10) || VISIBLE_LINES
      setTopLine(prev => Math.min(Math.max(0, lines.length - VISIBLE_LINES), prev + n))
      return
    }

    if (v === 'RFIND') {
      if (!lastFind.current) { setMsg('NO PREVIOUS FIND'); setMsgType('err'); return }
      const pattern = lastFind.current
      const foundIdx = lines.findIndex((l, i) => i > topLine && l.includes(pattern))
      if (foundIdx >= 0) {
        setTopLine(foundIdx)
        setMsg(`FOUND: "${pattern}" AT LINE ${foundIdx + 1}`)
        setMsgType('ok')
      } else {
        setMsg(`STRING NOT FOUND: "${pattern}"`)
        setMsgType('err')
      }
      return
    }

    if (v.startsWith('FIND ') || v.startsWith('F ')) {
      const pattern = val.trim().slice(val.trim().indexOf(' ') + 1)
      lastFind.current = pattern
      const foundIdx = lines.findIndex((l, i) => i >= topLine && l.includes(pattern))
      if (foundIdx >= 0) {
        setTopLine(foundIdx)
        setMsg(`FOUND: "${pattern}" AT LINE ${foundIdx + 1}`)
        setMsgType('ok')
      } else {
        setMsg(`STRING NOT FOUND: "${pattern}"`)
        setMsgType('err')
      }
      return
    }

    // CHANGE <old> <new> [ALL]
    if (v.startsWith('CHANGE ') || v.startsWith('C ')) {
      const parts = val.trim().split(/\s+/)
      if (parts.length < 3) { setMsg('USAGE: CHANGE <old> <new> [ALL]'); setMsgType('err'); return }
      const from = parts[1]
      const to = parts[2]
      const all = parts[3]?.toUpperCase() === 'ALL'
      if (all) {
        let count = 0
        setLines(prev => prev.map(l => {
          if (l.includes(from)) { count++; return l.split(from).join(to) }
          return l
        }))
        setModified(true)
        setMsg(`${count} OCCURRENCE(S) CHANGED`)
        setMsgType('ok')
      } else {
        const idx = lines.findIndex((l, i) => i >= topLine && l.includes(from))
        if (idx >= 0) {
          setLines(prev => {
            const next = [...prev]
            next[idx] = next[idx].replace(from, to)
            return next
          })
          setModified(true)
          setTopLine(idx)
          setMsg(`CHANGED AT LINE ${idx + 1}`)
          setMsgType('ok')
        } else {
          setMsg(`STRING NOT FOUND: "${from}"`)
          setMsgType('err')
        }
      }
      return
    }

    setMsg(`UNKNOWN COMMAND: ${v}`)
    setMsgType('err')
  }

  const handleF3 = () => {
    if (modified) {
      setExitConfirm(true)
      setMsg('FILE NOT SAVED.  TYPE YES TO EXIT  OR  NO TO CANCEL.')
      setMsgType('err')
    } else {
      onBack()
    }
  }

  const pfKeys = [
    { label: 'F1', action: 'Help' },
    { label: 'F2', action: 'Save', handler: () => { save() } },
    { label: 'F3', action: 'Exit', handler: handleF3 },
    { label: 'F5', action: 'Rfind', handler: () => handleSubmit('RFIND') },
    { label: 'F7', action: 'Up', handler: () => setTopLine(p => Math.max(0, p - VISIBLE_LINES)) },
    { label: 'F8', action: 'Down', handler: () => setTopLine(p => Math.min(Math.max(0, lines.length - VISIBLE_LINES), p + VISIBLE_LINES)) },
    { label: 'F12', action: 'Cancel', handler: handleF3 },
  ]

  const visibleLines = lines.slice(topLine, topLine + VISIBLE_LINES)

  return (
    <ISPFScreen
      panelTitle={title}
      rowInfo={`Line ${topLine + 1} of ${lines.length}`}
      shortMsg={msg || undefined}
      shortMsgType={msgType}
      commandValue={cmd}
      onCommandChange={setCmd}
      onCommandSubmit={handleSubmit}
      scrollValue="CSR"
      pfKeys={pfKeys}
      longMsg="Prefix cmds: I=Insert D=Delete R=Repeat DD=Delete block. Commands: SAVE FIND CHANGE TOP BOTTOM"
    >
      {loading && <div className="ispf-loading"> Loading file...</div>}

      {!loading && visibleLines.map((line, relIdx) => {
        const absIdx = topLine + relIdx
        const lineNum = String(absIdx + 1).padStart(6, '0')
        return (
          <div
            key={absIdx}
            style={{ display: 'flex', alignItems: 'center', minHeight: '1.2em' }}
          >
            <input
              className="edit-prefix"
              maxLength={6}
              defaultValue=""
              placeholder={lineNum}
              onChange={e => { prefixCmdsRef.current[absIdx] = e.target.value }}
              spellCheck={false}
              style={{
                width: '7ch',
                background: 'transparent',
                border: 'none',
                borderRight: '1px solid var(--z-cyan)',
                color: 'var(--z-cyan)',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                paddingRight: '0.5ch',
                outline: 'none',
                flexShrink: 0,
                textAlign: 'right',
              }}
            />
            <input
              className="edit-line"
              value={line}
              onChange={e => handleLineChange(absIdx, e.target.value)}
              spellCheck={false}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: 'var(--z-green)',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                paddingLeft: '1ch',
                outline: 'none',
              }}
            />
          </div>
        )
      })}
    </ISPFScreen>
  )
}
