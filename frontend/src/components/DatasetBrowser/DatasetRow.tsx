import React from 'react'
import type { DatasetInfo } from '../../api/datasets'

interface Props {
  ds: DatasetInfo
  isSelected: boolean
  onClick: () => void
}

export function DatasetRow({ ds, isSelected, onClick }: Props) {
  return (
    <div
      className={`ds-row ${isSelected ? 'ds-row--selected' : ''}`}
      onClick={onClick}
    >
      <span className="ds-name">{ds.dsn}</span>
      <span className="ds-org">{ds.dsorg}</span>
      <span className="ds-vol">{ds.volser}</span>
      {ds.member_count !== null && (
        <span className="ds-mbr">[{ds.member_count} mbr]</span>
      )}
    </div>
  )
}
