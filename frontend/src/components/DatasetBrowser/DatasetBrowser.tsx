import React, { useState, useEffect } from 'react'
import { listDatasets, getDataset } from '../../api/datasets'
import type { DatasetInfo, DatasetDetail } from '../../api/datasets'
import { DatasetRow } from './DatasetRow'

interface Props {
  onClose: () => void
}

export function DatasetBrowser({ onClose }: Props) {
  const [datasets, setDatasets] = useState<DatasetInfo[]>([])
  const [selected, setSelected] = useState<DatasetDetail | null>(null)
  const [filter, setFilter] = useState('')
  const [activeMember, setActiveMember] = useState<string | null>(null)
  const [memberContent, setMemberContent] = useState<string>('')

  useEffect(() => {
    listDatasets(filter || undefined).then(setDatasets)
  }, [filter])

  const handleSelect = async (dsn: string) => {
    const detail = await getDataset(dsn)
    setSelected(detail)
    setActiveMember(null)
    setMemberContent('')
  }

  const handleMember = async (member: string) => {
    if (!selected) return
    const res = await fetch(`/api/datasets/${selected.dsn}/members/${member}`)
    const json = await res.json()
    setActiveMember(member)
    setMemberContent(json.data?.content ?? '')
  }

  return (
    <div className="ds-browser">
      <div className="ds-browser-header">
        <span>╔══ MVS DATASET BROWSER ══╗</span>
        <button className="ds-close" onClick={onClose}>✕ CLOSE</button>
      </div>

      <div className="ds-browser-body">
        {/* Left: dataset list */}
        <div className="ds-list-panel">
          <div className="ds-filter-row">
            <span>FILTER: </span>
            <input
              className="ds-filter-input"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="SYS1.*"
              spellCheck={false}
            />
          </div>
          <div className="ds-list">
            {datasets.map((ds) => (
              <DatasetRow
                key={ds.dsn}
                ds={ds}
                isSelected={selected?.dsn === ds.dsn}
                onClick={() => handleSelect(ds.dsn)}
              />
            ))}
          </div>
        </div>

        {/* Right: detail / member list / content */}
        <div className="ds-detail-panel">
          {selected ? (
            <>
              <div className="ds-detail-header">
                <span className="ds-detail-dsn">{selected.dsn}</span>
                <span className="ds-detail-meta">
                  {selected.dsorg} | LRECL={selected.lrecl} | VOL={selected.volser}
                </span>
              </div>

              {selected.dsorg === 'PO' ? (
                <div className="ds-members-area">
                  <div className="ds-members-list">
                    {selected.members.map((m) => (
                      <div
                        key={m.name}
                        className={`ds-member ${activeMember === m.name ? 'ds-member--active' : ''}`}
                        onClick={() => handleMember(m.name)}
                      >
                        <span>{m.name}</span>
                        <span className="ds-member-meta">{m.userid} {m.changed}</span>
                      </div>
                    ))}
                  </div>
                  {activeMember && (
                    <pre className="ds-content">{memberContent}</pre>
                  )}
                </div>
              ) : (
                <pre className="ds-content">{selected.content}</pre>
              )}
            </>
          ) : (
            <div className="ds-placeholder">
              Select a dataset from the list.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
