import React, { useState, useEffect, useRef } from 'react'
import { ISPFScreen } from '../ISPFScreen'
import { execCommand } from '../../../api/terminal'
import { useCommandHistory } from '../../../hooks/useCommandHistory'

interface Props {
  sessionId: string
  cwd: string
  username: string
  updateCwd: (c: string) => void
  onBack: () => void
}

interface OutputLine {
  id: number
  text: string
  type: 'output' | 'error' | 'cmd' | 'ready' | 'system'
}

let idSeq = 0

export function CommandShell({ sessionId, cwd, username, updateCwd, onBack }: Props) {
  const [lines, setLines] = useState<OutputLine[]>([
    { id: idSeq++, text: `ISPF Command Shell — TSO/E READY`, type: 'system' },
    { id: idSeq++, text: `Type USS shell commands. F3=Exit  F12=Retrieve last command.`, type: 'system' },
    { id: idSeq++, text: '', type: 'system' },
  ])
  const [cmd, setCmd] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [msg, setMsg] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const history = useCommandHistory()
  const cwdRef = useRef(cwd)

  useEffect(() => { cwdRef.current = cwd }, [cwd])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [lines])

  const run = async (raw: string) => {
    if (!raw.trim()) return
    history.push(raw)
    const promptLine: OutputLine = {
      id: idSeq++, text: `${cwdRef.current} $ ${raw}`, type: 'cmd'
    }
    setLines((p) => [...p, promptLine])
    setIsRunning(true)
    try {
      const result = await execCommand(raw, sessionId)
      if (result.output === '__CLEAR__') {
        setLines([{ id: idSeq++, text: 'READY', type: 'ready' }])
        setIsRunning(false)
        return
      }
      const type: OutputLine['type'] = result.exit_code !== 0 ? 'error' : 'output'
      const outLines: OutputLine[] = result.output
        .split('\n')
        .filter((l, i, arr) => !(i === arr.length - 1 && l === ''))
        .map((text) => ({ id: idSeq++, text, type }))
      if (outLines.length > 0) setLines((p) => [...p, ...outLines])
      setLines((p) => [...p, { id: idSeq++, text: 'READY', type: 'ready' }])
      if (result.new_cwd !== cwdRef.current) {
        cwdRef.current = result.new_cwd
        updateCwd(result.new_cwd)
      }
    } catch {
      setLines((p) => [...p, { id: idSeq++, text: 'ERROR: Backend connection failed', type: 'error' }])
    } finally {
      setIsRunning(false)
      setMsg('')
    }
  }

  const handleSubmit = (val: string) => {
    if (isRunning) return
    const v = val.trim()
    if (!v) { setLines((p) => [...p, { id: idSeq++, text: 'READY', type: 'ready' }]); return }
    if (v.toUpperCase() === 'CLEAR' || v.toUpperCase() === 'CLS') {
      setLines([{ id: idSeq++, text: 'READY', type: 'ready' }])
      return
    }
    // Strip leading TSO if user typed it
    run(v.replace(/^TSO\s+/i, ''))
  }

  const pfKeys = [
    { label: 'F1', action: 'Help' },
    { label: 'F3', action: 'Exit', handler: onBack },
    { label: 'F7', action: 'Up' },
    { label: 'F8', action: 'Down' },
    { label: 'F9', action: 'Swap' },
    { label: 'F12', action: 'Retrieve', handler: () => {
      const last = history.history[0]
      if (last) setCmd(last)
    }},
  ]

  return (
    <ISPFScreen
      panelTitle="ISPF COMMAND SHELL"
      rowInfo={`${username}@MVS38J`}
      shortMsg={isRunning ? 'RUNNING...' : (msg || undefined)}
      shortMsgType={isRunning ? 'info' : 'ok'}
      commandLabel="Command"
      commandValue={cmd}
      onCommandChange={setCmd}
      onCommandSubmit={handleSubmit}
      pfKeys={pfKeys}
      longMsg={`CWD: ${cwd}  — Enter USS commands. 'help' for command list. 'TSO command' for TSO passthru.`}
    >
      <div className="cmd-shell-intro">
        {'─'.repeat(80)}<br />
        {' Enter TSO commands, CLISTs, or REXX execs below.'}
        {'  Type "help" for command list.'}
      </div>
      <div className="cmd-shell-output">
        {lines.map((l) => (
          <div key={l.id} className={`cmd-shell-line cmd-shell-line--${l.type}`}>
            {l.type === 'ready' ? ' READY' : ` ${l.text}`}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </ISPFScreen>
  )
}
