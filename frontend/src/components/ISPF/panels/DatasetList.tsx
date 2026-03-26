import React, { useState, useEffect, useRef } from 'react'
import { ISPFScreen } from '../ISPFScreen'
import { listDatasets, deleteDataset } from '../../../api/datasets'
import type { DatasetInfo } from '../../../api/datasets'
import type { PanelEntry } from '../../../hooks/useNavigation'

interface Props {
  initialFilter?: string
  onNavigate: (panel: PanelEntry) => void
  onBack: () => void
}

const COL_HEADER = [
  '         ',                         // line command (8ch)
  'Name                                        ', // dsn (44ch)
  'Org  ',                             // dsorg
  'Recfm ',                            // recfm
  'Lrecl',                             // lrecl
  '  Volume  ',                        // volser
  ' Changed',                          // changed
].join('')

export function DatasetList({ initialFilter = '', onNavigate, onBack }: Props) {
  const [datasets, setDatasets] = useState<DatasetInfo[]>([])
  const [filter, setFilter] = useState(initialFilter)
  const [cmd, setCmd] = useState('')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'ok'|'err'|'info'>('info')
  const [loading, setLoading] = useState(true)
  const cmdsRef = useRef<Record<string, string>>({})

  const load = async (f: string) => {
    setLoading(true)
    try {
      const data = await listDatasets(f || undefined)
      setDatasets(data)
      setMsg(`${data.length} DATASETS FOUND`)
      setMsgType('ok')
    } catch {
      setMsg('ERROR READING CATALOG')
      setMsgType('err')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(filter) }, [])

  const execLineCmd = (lineCmd: string, ds: DatasetInfo) => {
    const c = lineCmd.trim().toUpperCase()
    if (c === 'B' || c === 'E' || c === 'V' || c === '') {
      if (ds.dsorg === 'PO') {
        onNavigate({ id: 'members', params: { dsn: ds.dsn } })
      } else {
        onNavigate({ id: 'view', params: { dsn: ds.dsn, label: ds.dsn } })
      }
      return
    }
    if (c === 'M') {
      if (ds.dsorg === 'PO') onNavigate({ id: 'members', params: { dsn: ds.dsn } })
      else { setMsg('NOT A PDS — NO MEMBERS'); setMsgType('err') }
      return
    }
    if (c === 'D') {
      deleteDataset(ds.dsn)
        .then(() => {
          setDatasets(prev => prev.filter(d => d.dsn !== ds.dsn))
          setMsg(`DATASET ${ds.dsn} DELETED`)
          setMsgType('ok')
        })
        .catch(() => {
          setMsg(`DELETE FAILED: ${ds.dsn}`)
          setMsgType('err')
        })
      return
    }
    setMsg(`UNKNOWN COMMAND: ${c}`)
    setMsgType('err')
  }

  const handleRowEnter = (e: React.KeyboardEvent<HTMLInputElement>, ds: DatasetInfo, idx: number) => {
    if (e.key === 'Enter') {
      const val = cmdsRef.current[String(idx)] || ''
      execLineCmd(val, ds)
    }
  }

  const handleSubmit = (val: string) => {
    const v = val.trim().toUpperCase()
    if (!v) return
    if (v === 'RFIND' || v.startsWith('F ') || v.startsWith('FIND ')) {
      const term = v.split(' ').slice(1).join(' ')
      setFilter(term)
      load(term)
      return
    }
    // Direct dataset entry
    if (/^[A-Z#@$][A-Z0-9#@$.]*$/.test(v)) {
      setFilter(v)
      load(v)
      return
    }
    setMsg(`INVALID COMMAND: ${v}`)
    setMsgType('err')
  }

  const pfKeys = [
    { label: 'F1', action: 'Help' },
    { label: 'F2', action: 'Refresh', handler: () => load(filter) },
    { label: 'F3', action: 'Exit', handler: onBack },
    { label: 'F4', action: 'Expand' },
    { label: 'F5', action: 'Rfind' },
    { label: 'F6', action: 'Rchange' },
    { label: 'F7', action: 'Up' },
    { label: 'F8', action: 'Down' },
    { label: 'F9', action: 'Swap' },
    { label: 'F10', action: 'Left' },
    { label: 'F11', action: 'Right' },
    { label: 'F12', action: 'Cancel', handler: onBack },
  ]

  return (
    <ISPFScreen
      panelTitle={`DSLIST - Data Sets${filter ? ` Matching ${filter}` : ' (All)'}`}
      rowInfo={`Row 1 of ${datasets.length}`}
      shortMsg={msg || undefined}
      shortMsgType={msgType}
      commandValue={cmd}
      onCommandChange={setCmd}
      onCommandSubmit={handleSubmit}
      scrollValue="CSR"
      pfKeys={pfKeys}
      longMsg="Enter B=Browse, E=Edit, M=Members, D=Delete beside name. Enter filter in Command line."
    >
      {/* Filter row */}
      <div className="ispf-filter-row">
        <span>Dsname Level {'===>'}{' '}</span>
        <input
          className="ispf-filter-input"
          value={filter}
          onChange={(e) => setFilter(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && load(filter)}
          placeholder="(blank = all, e.g. SYS1.*  HERC01.*)"
          spellCheck={false}
        />
      </div>

      {/* Column header */}
      <div className="ds-colheader">
        <span style={{ width: '9ch', flexShrink: 0 }}> Command </span>
        <span style={{ flex: 1 }}> Name</span>
        <span style={{ width: '5ch', flexShrink: 0 }}>Org</span>
        <span style={{ width: '6ch', flexShrink: 0 }}>Recfm</span>
        <span style={{ width: '6ch', flexShrink: 0, textAlign: 'right', paddingRight: '1ch' }}>Lrecl</span>
        <span style={{ width: '8ch', flexShrink: 0 }}>Volume</span>
        <span style={{ width: '18ch', flexShrink: 0 }}>Changed</span>
      </div>

      {loading && <div className="ispf-loading"> Loading dataset catalog...</div>}

      {!loading && datasets.length === 0 && (
        <div className="ispf-empty"> No datasets match the specified criteria.</div>
      )}

      {datasets.map((ds, idx) => (
        <div
          key={ds.dsn}
          className="ds-row-wrap"
          onDoubleClick={() => {
            if (ds.dsorg === 'PO') onNavigate({ id: 'members', params: { dsn: ds.dsn } })
            else onNavigate({ id: 'view', params: { dsn: ds.dsn, label: ds.dsn } })
          }}
        >
          <input
            className="ds-line-cmd"
            maxLength={2}
            defaultValue=""
            onChange={(e) => { cmdsRef.current[String(idx)] = e.target.value }}
            onKeyDown={(e) => handleRowEnter(e, ds, idx)}
            spellCheck={false}
          />
          <span className="ds-col-name"> {ds.dsn}</span>
          <span className="ds-col-org"> {ds.dsorg}</span>
          <span className="ds-col-recfm">{ds.recfm}</span>
          <span className="ds-col-lrecl">{ds.lrecl}</span>
          <span className="ds-col-vol"> {ds.volser}</span>
          <span className="ds-col-ref"> {ds.changed}</span>
        </div>
      ))}
    </ISPFScreen>
  )
}
