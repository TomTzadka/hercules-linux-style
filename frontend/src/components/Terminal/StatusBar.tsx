import React from 'react'

interface Props {
  username: string
  cwd: string
  isLoading: boolean
  showDatasets: boolean
  onToggleDatasets: () => void
  onHelp: () => void
}

export function StatusBar({ username, cwd, isLoading, showDatasets, onToggleDatasets, onHelp }: Props) {
  const status = isLoading ? 'RUNNING' : 'READY'
  const statusClass = isLoading ? 'status--running' : 'status--ready'

  return (
    <div className="status-bar">
      <span className="status-system">╔══ MVS38J ══╗</span>
      <span className="status-user">{username}</span>
      <span className="status-cwd">{cwd}</span>
      <span className={`status-state ${statusClass}`}>[{status}]</span>
      <span className="status-keys">
        <button className="pf-key" onClick={onHelp} title="Help">PF1=HELP</button>
        <button className={`pf-key ${showDatasets ? 'pf-key--active' : ''}`} onClick={onToggleDatasets} title="Dataset Browser">
          PF3=DATASETS
        </button>
      </span>
    </div>
  )
}
