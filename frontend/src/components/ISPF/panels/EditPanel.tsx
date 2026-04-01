import React, { useState, useEffect, useRef, useCallback } from 'react'
import { ISPFScreen } from '../ISPFScreen'
import { catFile, writeFile } from '../../../api/filesystem'
import { getMember, writeMember } from '../../../api/datasets'
import { submitJcl } from '../../../api/spool'

interface Props {
  ussPath?: string
  dsn?: string
  member?: string
  sessionId: string
  onBack: () => void
}

const VISIBLE_LINES = 20

// ---------------------------------------------------------------------------
// JCL syntax tokenizer
// ---------------------------------------------------------------------------
type Token = { text: string; color: string }

const G = 'var(--z-green)'
const C = 'var(--z-cyan)'
const Y = 'var(--z-yellow)'
const R = 'var(--z-red)'

const JCL_VERBS = new Set([
  'JOB', 'EXEC', 'DD', 'PROC', 'PEND', 'IF', 'ELSE', 'ENDIF',
  'INCLUDE', 'JCLLIB', 'SET', 'OUTPUT',
])

function tokenizeJclLine(line: string): Token[] {
  if (!line) return [{ text: '\u00a0', color: G }]

  if (line.startsWith('//*')) return [{ text: line, color: C }]

  if (line.startsWith('//')) {
    const rest = line.slice(2)
    if (!rest.trim()) return [{ text: line, color: G }]
    const m = rest.match(/^(\S*)(\s+)(\S+)(.*)$/)
    if (!m) return [{ text: line, color: G }]
    const [, name, spaces, verb, tail] = m
    const verbColor = JCL_VERBS.has(verb.toUpperCase()) ? R : G
    return [
      { text: '//', color: G },
      { text: name, color: Y },
      { text: spaces, color: G },
      { text: verb, color: verbColor },
      { text: tail, color: G },
    ]
  }

  return [{ text: line, color: G }]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function EditPanel({ ussPath, dsn, member, sessionId, onBack }: Props) {
  const [lines, setLines] = useState<string[]>([])
  const [modified, setModified] = useState(false)
  const [cmd, setCmd] = useState('')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'ok' | 'err' | 'info'>('info')
  const [loading, setLoading] = useState(true)
  const [topLine, setTopLine] = useState(0)
  const [exitConfirm, setExitConfirm] = useState(false)
  const [showCols, setShowCols] = useState(false)
  const [focusedLine, setFocusedLine] = useState<number | null>(null)
  const [excludedLines, setExcludedLines] = useState<Set<number>>(new Set())
  const [undoHistory, setUndoHistory] = useState<string[][]>([])
  const [capsMode, setCapsMode] = useState(false)
  const [numberMode, setNumberMode] = useState(false)
  const [hexMode, setHexMode] = useState(false)
  const [recoveryAvail, setRecoveryAvail] = useState(false)
  const prefixCmdsRef = useRef<Record<number, string>>({})
  const prefixRefs = useRef<(HTMLInputElement | null)[]>([])
  const lastFind = useRef('')

  const fileLabel = ussPath ? ussPath : `${dsn}(${member})`
  const title = `EDIT - ${fileLabel}${modified ? ' *' : ''}`
  const recoveryKey = `ispf-recovery:${fileLabel}`

  // Auto-detect edit profile from filename
  const detectProfile = (label: string) => {
    const l = label.toUpperCase()
    if (l.includes('.CNTL') || l.includes('JCL') || l.endsWith('.JCL')) {
      setCapsMode(true)
    } else if (l.includes('.COBOL') || l.includes('.CBL') || l.includes('.COB') || l.includes('COBOL')) {
      setCapsMode(false)
    } else if (l.includes('.ASM') || l.includes('.MAC')) {
      setCapsMode(false)
    }
  }

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
        // Check for recovery data
        const saved = localStorage.getItem(recoveryKey)
        if (saved && saved !== content) {
          setLines(saved.split('\n'))
          setRecoveryAvail(true)
          setMsg('EDIT RECOVERY AVAILABLE — TYPE RECOVER TO RESTORE, OR CONTINUE TO DISCARD')
          setMsgType('err')
        } else {
          setLines(content.split('\n'))
          setMsg('EDIT MODE  —  SAVE to save  |  CANCEL to exit without saving')
          setMsgType('info')
        }
        detectProfile(fileLabel)
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
      localStorage.removeItem(recoveryKey)
      setRecoveryAvail(false)
      setMsg('FILE SAVED')
      setMsgType('ok')
    } catch {
      setMsg('SAVE FAILED — CHECK PERMISSIONS')
      setMsgType('err')
    }
  }, [lines, ussPath, dsn, member, sessionId, recoveryKey])

  const pushUndo = useCallback((currentLines: string[]) => {
    setUndoHistory(h => [...h.slice(-19), currentLines])
  }, [])

  const handleLineChange = (idx: number, value: string) => {
    const finalValue = capsMode ? value.toUpperCase() : value
    setLines(prev => {
      const next = [...prev]
      next[idx] = finalValue
      // Save recovery data to localStorage (debounced via render cycle)
      try { localStorage.setItem(recoveryKey, next.join('\n')) } catch { /* ignore */ }
      return next
    })
    setModified(true)
  }

  // ---------------------------------------------------------------------------
  // Prefix command processor
  // ---------------------------------------------------------------------------
  const applyPrefixCmds = () => {
    const cmds = prefixCmdsRef.current
    const allIdx = Object.keys(cmds).map(Number)
    if (allIdx.length === 0) return

    const normalized: Record<number, string> = {}
    for (const i of allIdx) {
      const c = (cmds[i] || '').trim().toUpperCase()
      if (c) normalized[i] = c
    }

    let newLines = [...lines]
    const newExcluded = new Set(excludedLines)
    let changed = false
    let offset = 0

    // Helper: expand block commands to individual line markers
    const expandBlock = (marker: string, expandedMarker: string) => {
      const matching = Object.keys(normalized)
        .map(Number)
        .filter(i => normalized[i] === marker)
        .sort((a, b) => a - b)
      if (matching.length >= 2) {
        const [s, e] = [matching[0], matching[matching.length - 1]]
        for (let i = s; i <= e; i++) normalized[i] = expandedMarker
        matching.forEach(i => delete normalized[i])
      }
    }

    // Expand block commands
    expandBlock('DD', '__D__')
    expandBlock('XX', '__X__')
    expandBlock('>>', '__>__')
    expandBlock('<<', '__<__')

    // Collect CC/MM ranges (handled separately after simple ops)
    const ccIdx = Object.keys(normalized).map(Number).filter(i => normalized[i] === 'CC').sort((a, b) => a - b)
    const mmIdx = Object.keys(normalized).map(Number).filter(i => normalized[i] === 'MM').sort((a, b) => a - b)
    const ccRange = ccIdx.length >= 2 ? [ccIdx[0], ccIdx[ccIdx.length - 1]] : null
    const mmRange = mmIdx.length >= 2 ? [mmIdx[0], mmIdx[mmIdx.length - 1]] : null
    ccIdx.forEach(i => delete normalized[i])
    mmIdx.forEach(i => delete normalized[i])

    // Find destination markers
    const aOrigIdx = Object.keys(normalized).map(Number).find(i => normalized[i] === 'A')
    const bOrigIdx = Object.keys(normalized).map(Number).find(i => normalized[i] === 'B')
    if (aOrigIdx !== undefined) delete normalized[aOrigIdx]
    if (bOrigIdx !== undefined) delete normalized[bOrigIdx]
    const destOrig = aOrigIdx ?? bOrigIdx
    const isAfter = aOrigIdx !== undefined

    // Find single C/M
    const cOrigIdx = Object.keys(normalized).map(Number).find(i => normalized[i] === 'C')
    const mOrigIdx = Object.keys(normalized).map(Number).find(i => normalized[i] === 'M')
    if (cOrigIdx !== undefined) delete normalized[cOrigIdx]
    if (mOrigIdx !== undefined) delete normalized[mOrigIdx]

    // Process simple per-line commands in sorted order
    const sortedIdx = Object.keys(normalized).map(Number).sort((a, b) => a - b)
    for (const i of sortedIdx) {
      const c = normalized[i]
      const adj = i + offset
      if (adj < 0 || adj >= newLines.length) continue

      if (c === 'D' || c === '__D__') {
        newLines.splice(adj, 1); offset--; changed = true
      } else if (c === 'I') {
        newLines.splice(adj + 1, 0, ''); offset++; changed = true
      } else if (/^R(\d*)$/.test(c)) {
        const count = parseInt(c.slice(1) || '1', 10) || 1
        const copies = Array(count).fill(newLines[adj])
        newLines.splice(adj + 1, 0, ...copies); offset += count; changed = true
      } else if (c === 'UC' || c === 'UCUC') {
        newLines[adj] = newLines[adj].toUpperCase(); changed = true
      } else if (c === 'LC' || c === 'LCLC') {
        newLines[adj] = newLines[adj].toLowerCase(); changed = true
      } else if (c === '>' || c === '__>__') {
        newLines[adj] = '        ' + newLines[adj]; changed = true
      } else if (c === '<' || c === '__<__') {
        newLines[adj] = newLines[adj].startsWith('        ')
          ? newLines[adj].slice(8)
          : newLines[adj].replace(/^\s+/, '')
        changed = true
      } else if (c === 'X' || c === '__X__') {
        newExcluded.add(i); changed = true
      }
    }

    // Handle copy/move with destination
    if (destOrig !== undefined) {
      const adjDest = destOrig + offset

      if (cOrigIdx !== undefined) {
        const adjSrc = cOrigIdx + offset
        if (adjSrc >= 0 && adjSrc < newLines.length) {
          const lineToCopy = newLines[adjSrc]
          const insertAt = Math.max(0, Math.min(isAfter ? adjDest + 1 : adjDest, newLines.length))
          newLines.splice(insertAt, 0, lineToCopy)
          offset++; changed = true
        }
      }

      if (ccRange) {
        const adjStart = ccRange[0] + offset
        const adjEnd = ccRange[1] + offset
        if (adjStart >= 0 && adjEnd < newLines.length) {
          const linesToCopy = newLines.slice(adjStart, adjEnd + 1)
          const insertAt = Math.max(0, Math.min(isAfter ? adjDest + 1 : adjDest, newLines.length))
          newLines.splice(insertAt, 0, ...linesToCopy)
          offset += linesToCopy.length; changed = true
        }
      }

      if (mOrigIdx !== undefined) {
        const adjSrc = mOrigIdx + offset
        if (adjSrc >= 0 && adjSrc < newLines.length) {
          const [lineToMove] = newLines.splice(adjSrc, 1)
          offset--
          const newAdjDest = destOrig + offset + (isAfter ? 1 : 0)
          const insertAt = Math.max(0, Math.min(newAdjDest, newLines.length))
          newLines.splice(insertAt, 0, lineToMove)
          offset++; changed = true
        }
      }

      if (mmRange) {
        const adjStart = mmRange[0] + offset
        const adjEnd = mmRange[1] + offset
        if (adjStart >= 0 && adjEnd < newLines.length) {
          const linesToMove = newLines.splice(adjStart, adjEnd - adjStart + 1)
          offset -= linesToMove.length
          const newAdjDest = destOrig + offset + (isAfter ? 1 : 0)
          const insertAt = Math.max(0, Math.min(newAdjDest, newLines.length))
          newLines.splice(insertAt, 0, ...linesToMove)
          offset += linesToMove.length; changed = true
        }
      }
    }

    prefixCmdsRef.current = {}

    if (changed) {
      const linesChanged = newLines.join('\n') !== lines.join('\n')
      if (linesChanged) {
        pushUndo(lines)
        setLines(newLines)
        setModified(true)
      }
      setExcludedLines(newExcluded)
    }
  }

  // ---------------------------------------------------------------------------
  // Primary command handler
  // ---------------------------------------------------------------------------
  const handleSubmit = async (val: string) => {
    const v = val.trim().toUpperCase()

    if (!v) {
      applyPrefixCmds()
      return
    }

    if (v === 'SUBMIT' || v === 'SUB') {
      const content = lines.join('\n')
      if (!content.trim().startsWith('//')) {
        setMsg('NOT A JCL FILE — first line must start with //')
        setMsgType('err')
        return
      }
      // JCL line-length check
      const longLines = lines.filter((l, i) => l.startsWith('//') && l.length > 71)
      if (longLines.length > 0) {
        const firstLong = lines.findIndex(l => l.startsWith('//') && l.length > 71)
        setMsg(`IEF204I JCL ERROR AT LINE ${firstLong + 1} — STATEMENT EXCEEDS 71 CHARACTERS`)
        setMsgType('err')
        return
      }
      try {
        const owner = dsn ? dsn.split('.')[0] : 'TOMTZ'
        const job = await submitJcl(content, owner)
        setMsg(`${job.jobid} SUBMITTED — JOBNAME=${job.jobname} — CHECK SDSF (option S from menu)`)
        setMsgType('ok')
      } catch {
        setMsg('SUBMIT FAILED — CHECK JCL SYNTAX')
        setMsgType('err')
      }
      return
    }

    if (v === 'END') {
      localStorage.removeItem(recoveryKey)
      onBack()
      return
    }

    if (v === 'EXIT') {
      await save()
      onBack()
      return
    }

    if (v === 'SAVE') {
      await save()
      return
    }

    if (v === 'COLS') {
      setShowCols(p => !p)
      setMsg(showCols ? 'COLS OFF' : 'COLS ON')
      setMsgType('ok')
      return
    }

    if (v === 'CANCEL' || v === 'QUIT' || v === 'Q') {
      if (modified) {
        setExitConfirm(true)
        setMsg('FILE NOT SAVED.  TYPE YES TO EXIT  OR  NO TO CANCEL.')
        setMsgType('err')
      } else {
        localStorage.removeItem(recoveryKey)
        onBack()
      }
      return
    }

    if (exitConfirm) {
      if (v === 'YES') { localStorage.removeItem(recoveryKey); onBack(); return }
      if (v === 'NO') { setExitConfirm(false); setMsg(''); return }
    }

    if (v === 'TOP') {
      setTopLine(0); setMsg('TOP OF DATA'); setMsgType('info'); return
    }

    if (v === 'BOTTOM' || v === 'BOT') {
      setTopLine(Math.max(0, lines.length - VISIBLE_LINES))
      setMsg('BOTTOM OF DATA'); setMsgType('info'); return
    }

    if (v.startsWith('UP')) {
      const n = parseInt(v.slice(2).trim() || String(VISIBLE_LINES), 10) || VISIBLE_LINES
      setTopLine(prev => Math.max(0, prev - n)); return
    }

    if (v.startsWith('DOWN')) {
      const n = parseInt(v.slice(4).trim() || String(VISIBLE_LINES), 10) || VISIBLE_LINES
      setTopLine(prev => Math.min(Math.max(0, lines.length - VISIBLE_LINES), prev + n)); return
    }

    // UNDO
    if (v === 'UNDO') {
      if (undoHistory.length === 0) {
        setMsg('NOTHING TO UNDO'); setMsgType('err')
      } else {
        const prev = undoHistory[undoHistory.length - 1]
        setUndoHistory(h => h.slice(0, -1))
        setLines(prev)
        setModified(true)
        setMsg('UNDO COMPLETE'); setMsgType('ok')
      }
      return
    }

    // RESET — show all excluded lines
    if (v === 'RESET') {
      setExcludedLines(new Set())
      setMsg('ALL LINES DISPLAYED'); setMsgType('ok'); return
    }

    // CAPS ON/OFF
    if (v === 'CAPS ON' || v === 'CAPS') {
      setCapsMode(true); setMsg('CAPS ON — NEW INPUT WILL BE UPPERCASED'); setMsgType('ok'); return
    }
    if (v === 'CAPS OFF') {
      setCapsMode(false); setMsg('CAPS OFF'); setMsgType('ok'); return
    }

    // SORT [col1 col2] [D]
    if (v === 'SORT' || v.startsWith('SORT ')) {
      const parts = v.split(/\s+/)
      let col1 = 1, col2 = 72, descending = false
      if (parts.length >= 2 && /^\d+$/.test(parts[1])) col1 = parseInt(parts[1])
      if (parts.length >= 3 && /^\d+$/.test(parts[2])) col2 = parseInt(parts[2])
      if (parts[parts.length - 1] === 'D') descending = true
      pushUndo(lines)
      setLines(prev => [...prev].sort((a, b) => {
        const ka = a.slice(col1 - 1, col2)
        const kb = b.slice(col1 - 1, col2)
        return descending ? kb.localeCompare(ka) : ka.localeCompare(kb)
      }))
      setModified(true)
      setMsg(`SORTED BY COL ${col1}-${col2}${descending ? ' DESCENDING' : ' ASCENDING'}`)
      setMsgType('ok'); return
    }

    // RFIND
    if (v === 'RFIND') {
      if (!lastFind.current) { setMsg('NO PREVIOUS FIND STRING'); setMsgType('err'); return }
      const pattern = lastFind.current
      const foundIdx = lines.findIndex((l, i) => i > topLine && l.includes(pattern))
      if (foundIdx >= 0) {
        setTopLine(foundIdx)
        setMsg(`CHARS '${pattern}' FOUND AT LINE ${foundIdx + 1}`); setMsgType('ok')
      } else {
        setMsg(`STRING NOT FOUND: '${pattern}'`); setMsgType('err')
      }
      return
    }

    // FIND / F
    if (v.startsWith('FIND ') || v.startsWith('F ')) {
      const rawPattern = val.trim().slice(val.trim().indexOf(' ') + 1).trim()
      const upper = rawPattern.toUpperCase()
      let pattern = rawPattern
      let direction: 'NEXT' | 'PREV' | 'FIRST' | 'LAST' = 'NEXT'
      if (upper.endsWith(' PREV')) { pattern = rawPattern.slice(0, -5).trim(); direction = 'PREV' }
      else if (upper.endsWith(' FIRST')) { pattern = rawPattern.slice(0, -6).trim(); direction = 'FIRST' }
      else if (upper.endsWith(' LAST')) { pattern = rawPattern.slice(0, -5).trim(); direction = 'LAST' }
      if ((pattern.startsWith("'") && pattern.endsWith("'")) ||
          (pattern.startsWith('"') && pattern.endsWith('"'))) {
        pattern = pattern.slice(1, -1)
      }
      lastFind.current = pattern

      let foundIdx = -1
      if (direction === 'FIRST') {
        foundIdx = lines.findIndex(l => l.includes(pattern))
      } else if (direction === 'LAST') {
        for (let i = lines.length - 1; i >= 0; i--) { if (lines[i].includes(pattern)) { foundIdx = i; break } }
      } else if (direction === 'PREV') {
        for (let i = topLine - 1; i >= 0; i--) { if (lines[i].includes(pattern)) { foundIdx = i; break } }
      } else {
        foundIdx = lines.findIndex((l, i) => i >= topLine && l.includes(pattern))
      }

      if (foundIdx >= 0) {
        setTopLine(foundIdx)
        setMsg(`CHARS '${pattern}' FOUND AT LINE ${foundIdx + 1}`); setMsgType('ok')
      } else {
        setMsg(`STRING NOT FOUND: '${pattern}'`); setMsgType('err')
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
        pushUndo(lines)
        setLines(prev => prev.map(l => {
          if (l.includes(from)) { count++; return l.split(from).join(to) }
          return l
        }))
        setModified(true)
        setMsg(`${count} OCCURRENCE(S) CHANGED`); setMsgType('ok')
      } else {
        const idx = lines.findIndex((l, i) => i >= topLine && l.includes(from))
        if (idx >= 0) {
          pushUndo(lines)
          setLines(prev => {
            const next = [...prev]
            next[idx] = next[idx].replace(from, to)
            return next
          })
          setModified(true)
          setTopLine(idx)
          setMsg(`CHANGED AT LINE ${idx + 1}`); setMsgType('ok')
        } else {
          setMsg(`STRING NOT FOUND: "${from}"`); setMsgType('err')
        }
      }
      return
    }

    // NUMBER ON/OFF — add/strip sequence numbers in columns 73-80
    if (v === 'NUMBER ON' || v === 'NUM ON' || v === 'NUMBER') {
      setNumberMode(true)
      // Add sequence numbers: pad line to 72 chars, append 8-char seq num
      pushUndo(lines)
      setLines(prev => prev.map((l, i) => {
        const base = l.length > 72 ? l.slice(0, 72) : l.padEnd(72)
        const seq = String((i + 1) * 10).padStart(8, '0')
        return base + seq
      }))
      setModified(true)
      setMsg('NUMBER ON — SEQUENCE NUMBERS ADDED IN COLS 73-80'); setMsgType('ok'); return
    }
    if (v === 'NUMBER OFF' || v === 'NUM OFF' || v === 'UNNUM' || v === 'UNNUMBER') {
      setNumberMode(false)
      // Strip columns 73-80 if they look like sequence numbers
      pushUndo(lines)
      setLines(prev => prev.map(l => {
        if (l.length === 80) {
          const seqField = l.slice(72)
          if (/^\d{8}$/.test(seqField)) return l.slice(0, 72).trimEnd()
        }
        return l.trimEnd()
      }))
      setModified(true)
      setMsg('NUMBER OFF — SEQUENCE NUMBERS REMOVED'); setMsgType('ok'); return
    }

    // HEX ON/OFF
    if (v === 'HEX ON' || v === 'HEX') {
      setHexMode(true); setMsg('HEX ON — HEXADECIMAL DISPLAY ACTIVE'); setMsgType('ok'); return
    }
    if (v === 'HEX OFF') {
      setHexMode(false); setMsg('HEX OFF'); setMsgType('ok'); return
    }

    // RECOVER — restore from edit recovery
    if (v === 'RECOVER') {
      const saved = localStorage.getItem(recoveryKey)
      if (saved) {
        pushUndo(lines)
        setLines(saved.split('\n'))
        setModified(true)
        setRecoveryAvail(false)
        setMsg('RECOVERY COMPLETE — FILE RESTORED FROM LAST EDIT SESSION'); setMsgType('ok')
      } else {
        setMsg('NO RECOVERY DATA AVAILABLE'); setMsgType('err')
      }
      return
    }

    // PROFILE (stub)
    if (v === 'PROFILE' || v === 'PROF') {
      setMsg('PROFILE: CAPS=' + (capsMode ? 'ON' : 'OFF') + '  NUMBER=' + (numberMode ? 'ON' : 'OFF') + '  HEX=' + (hexMode ? 'ON' : 'OFF') + '  NULLS=OFF'); setMsgType('info'); return
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
      localStorage.removeItem(recoveryKey)
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

  // ---------------------------------------------------------------------------
  // Hex helper
  // ---------------------------------------------------------------------------
  const toHexRow = (s: string) =>
    Array.from(s).map(c => c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')).join(' ')

  // ---------------------------------------------------------------------------
  // Render lines (with excluded line support)
  // ---------------------------------------------------------------------------
  const renderLines = () => {
    const rendered: React.ReactNode[] = []
    let i = topLine
    const end = Math.min(topLine + VISIBLE_LINES, lines.length)
    let relIdx = 0

    while (i < end) {
      if (excludedLines.has(i)) {
        // Count consecutive excluded lines
        let j = i
        while (j < end && excludedLines.has(j)) j++
        const count = j - i
        rendered.push(
          <div key={`excl-${i}`} style={{
            color: 'var(--z-cyan)',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            paddingLeft: '8ch',
          }}>
            {`- - - - - ${count} LINE${count !== 1 ? 'S' : ''} NOT DISPLAYED - - - - -`}
          </div>
        )
        i = j
        continue
      }

      const absIdx = i
      const lineNum = String(absIdx + 1).padStart(6, '0')
      const line = lines[absIdx] ?? ''
      const tokens = tokenizeJclLine(line)
      const isEditing = focusedLine === absIdx
      const currentRelIdx = relIdx

      rendered.push(
        <div
          key={absIdx}
          style={{ display: 'flex', alignItems: 'center', minHeight: '1.2em' }}
        >
          {/* Prefix input */}
          <input
            ref={el => { prefixRefs.current[currentRelIdx] = el }}
            className="edit-prefix"
            maxLength={6}
            defaultValue=""
            placeholder={lineNum}
            onChange={e => { prefixCmdsRef.current[absIdx] = e.target.value }}
            onKeyDown={e => {
              if (e.key === 'ArrowUp') { e.preventDefault(); prefixRefs.current[currentRelIdx - 1]?.focus() }
              if (e.key === 'ArrowDown') { e.preventDefault(); prefixRefs.current[currentRelIdx + 1]?.focus() }
            }}
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

          {/* Content: highlighted display or active input */}
          {isEditing ? (
            <input
              autoFocus
              className="edit-line"
              value={line}
              onChange={e => handleLineChange(absIdx, e.target.value)}
              onBlur={() => setFocusedLine(null)}
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
          ) : (
            <div
              onClick={() => setFocusedLine(absIdx)}
              style={{
                flex: 1,
                paddingLeft: '1ch',
                cursor: 'text',
                whiteSpace: 'pre',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                lineHeight: 'inherit',
                minHeight: '1.2em',
                userSelect: 'none',
              }}
            >
              {tokens.map((tok, ti) => (
                <span key={ti} style={{ color: tok.color }}>{tok.text}</span>
              ))}
            </div>
          )}
        </div>
      )

      // Hex row below content line
      if (hexMode && !excludedLines.has(absIdx)) {
        rendered.push(
          <div key={`hex-${absIdx}`} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              width: '7ch', flexShrink: 0,
              color: 'var(--z-cyan)', borderRight: '1px solid var(--z-cyan)',
              paddingRight: '0.5ch', textAlign: 'right', userSelect: 'none',
            }}>{'......'}</div>
            <div style={{
              paddingLeft: '1ch', color: 'var(--z-cyan)', fontFamily: 'inherit',
              fontSize: '0.85em', whiteSpace: 'pre', opacity: 0.8,
            }}>{toHexRow(line)}</div>
          </div>
        )
      }

      i++
      relIdx++
    }

    return rendered
  }

  return (
    <ISPFScreen
      panelTitle={title}
      rowInfo={`Line ${topLine + 1} of ${lines.length}${capsMode ? '  CAPS' : ''}${hexMode ? '  HEX' : ''}${recoveryAvail ? '  REC' : ''}`}
      shortMsg={msg || undefined}
      shortMsgType={msgType}
      commandValue={cmd}
      onCommandChange={setCmd}
      onCommandSubmit={handleSubmit}
      scrollValue="CSR"
      pfKeys={pfKeys}
      longMsg={recoveryAvail ? 'EDIT RECOVERY: Type RECOVER to restore last session, or continue editing to discard recovery' : 'Prefix: I D R DD C/CC+A/B M/MM+A/B X/XX > < UC LC | SAVE  CANCEL  FIND  CHANGE  UNDO  RESET  SORT  CAPS  HEX  NUMBER'}
      longMsgHighlight={recoveryAvail}
    >
      {loading && <div className="ispf-loading"> Loading file...</div>}

      {!loading && (
        <>
          {/* Mobile quick-action toolbar */}
          <div className="edit-mobile-toolbar">
            {[
              { label: 'SAVE', cmd: 'SAVE' },
              { label: 'FIND', cmd: 'FIND ' },
              { label: 'UNDO', cmd: 'UNDO' },
              { label: 'COLS', cmd: 'COLS' },
            ].map(({ label, cmd: c }) => (
              <button
                key={label}
                className="edit-mobile-tool-btn"
                onClick={(e) => { e.stopPropagation(); handleSubmit(c) }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* COLS ruler */}
          {showCols && (
            <div className="edit-cols-ruler">
              {'----+----1----+----2----+----3----+----4----+----5----+----6----+----7----+----8'}
            </div>
          )}

          {renderLines()}
        </>
      )}
    </ISPFScreen>
  )
}
