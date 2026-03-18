import React, { useState, useEffect, useCallback } from 'react'
import { TerminalOutput } from './TerminalOutput'
import { TerminalInput } from './TerminalInput'
import { StatusBar } from './StatusBar'
import { DatasetBrowser } from '../DatasetBrowser/DatasetBrowser'
import { useTerminal } from '../../hooks/useTerminal'

interface Props {
  sessionId: string
  cwd: string
  username: string
  updateCwd: (c: string) => void
}

export function Terminal({ sessionId, cwd, username, updateCwd }: Props) {
  const [showDatasets, setShowDatasets] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const { lines, isLoading, executeCommand, navigateUp, navigateDown } = useTerminal(
    sessionId,
    cwd,
    updateCwd
  )

  // PF key bindings
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F1') { e.preventDefault(); setShowHelp((v) => !v) }
      if (e.key === 'F3') { e.preventDefault(); setShowDatasets((v) => !v) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="terminal-root">
      <StatusBar
        username={username}
        cwd={cwd}
        isLoading={isLoading}
        showDatasets={showDatasets}
        onToggleDatasets={() => setShowDatasets((v) => !v)}
        onHelp={() => setShowHelp((v) => !v)}
      />

      <div className="terminal-body">
        <div className={`terminal-main ${showDatasets ? 'terminal-main--split' : ''}`}>
          <TerminalOutput lines={lines} />
          <TerminalInput
            cwd={cwd}
            username={username}
            isLoading={isLoading}
            onSubmit={executeCommand}
            onArrowUp={navigateUp}
            onArrowDown={navigateDown}
          />
        </div>

        {showDatasets && (
          <div className="terminal-side">
            <DatasetBrowser onClose={() => setShowDatasets(false)} />
          </div>
        )}
      </div>

      {showHelp && (
        <div className="help-overlay" onClick={() => setShowHelp(false)}>
          <div className="help-box" onClick={(e) => e.stopPropagation()}>
            <div className="help-title">╔══ HELP - MVS38J ══╗</div>
            <pre className="help-content">{HELP_TEXT}</pre>
            <button className="help-close" onClick={() => setShowHelp(false)}>CLOSE (F1)</button>
          </div>
        </div>
      )}
    </div>
  )
}

const HELP_TEXT = `
FILE SYSTEM COMMANDS
  pwd              Print working directory
  ls [-la] [path]  List directory contents
  cd [path]        Change directory (~ = home /u/herc01)
  cat <file>       Print file contents
  mkdir [-p] <dir> Create directory
  touch <file>     Create empty file
  rm [-r] <path>   Remove file or directory
  cp <src> <dst>   Copy file
  mv <src> <dst>   Move / rename
  echo <text>      Print text (supports > file redirect)

SYSTEM COMMANDS
  whoami           Current username
  hostname         System hostname (MVS38J)
  uname -a         OS information
  clear            Clear terminal screen

MVS DATASET COMMANDS
  ds list          List all datasets
  ds list SYS1.*   Filter by high-level qualifier
  ds members SYS1.PARMLIB    List PDS members
  ds read SYS1.PARMLIB(IEASYS00)  Read member
  ds cat SYS1.LOGREC         Print sequential dataset

KEYBOARD SHORTCUTS
  F1               Toggle this help overlay
  F3               Toggle MVS Dataset Browser panel
  ↑ / ↓           Navigate command history
  Enter            Execute command
`
