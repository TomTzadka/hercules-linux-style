import React, { useState, useEffect, useRef } from 'react'
import { ISPFScreen } from '../ISPFScreen'
import { getDataset, deleteMember } from '../../../api/datasets'
import type { DatasetDetail } from '../../../api/datasets'
import type { PanelEntry } from '../../../hooks/useNavigation'

interface Props {
  dsn: string
  onNavigate: (panel: PanelEntry) => void
  onBack: () => void
}

export function MemberList({ dsn, onNavigate, onBack }: Props) {
  const [detail, setDetail] = useState<DatasetDetail | null>(null)
  const [cmd, setCmd] = useState('')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'ok'|'err'|'info'>('ok')
  const [loading, setLoading] = useState(true)
  const cmdsRef = useRef<Record<string, string>>({})

  useEffect(() => {
    setLoading(true)
    getDataset(dsn)
      .then((d) => { setDetail(d); setMsg(`${d.members.length} MEMBERS`); setMsgType('ok') })
      .catch(() => { setMsg('DATASET NOT FOUND'); setMsgType('err') })
      .finally(() => setLoading(false))
  }, [dsn])

  const open = (member: string) => {
    onNavigate({ id: 'view', params: { dsn, member, label: `${dsn}(${member})` } })
  }

  const edit = (member: string) => {
    onNavigate({ id: 'edit', params: { dsn, member } })
  }

  const doDelete = async (member: string) => {
    try {
      await deleteMember(dsn, member)
      setDetail(prev => prev
        ? { ...prev, members: prev.members.filter(m => m.name !== member) }
        : prev
      )
      setMsg(`MEMBER ${member} DELETED`)
      setMsgType('ok')
    } catch {
      setMsg(`DELETE FAILED: ${member}`)
      setMsgType('err')
    }
  }

  const handleRowEnter = (e: React.KeyboardEvent<HTMLInputElement>, member: string, idx: number) => {
    if (e.key === 'Enter') {
      const c = (cmdsRef.current[String(idx)] || '').trim().toUpperCase()
      if (c === '' || c === 'B' || c === 'V' || c === 'S') {
        open(member)
      } else if (c === 'E') {
        edit(member)
      } else if (c === 'D') {
        doDelete(member)
      } else {
        setMsg(`UNKNOWN LINE COMMAND: ${c}`)
        setMsgType('err')
      }
    }
  }

  const handleSubmit = (val: string) => {
    const v = val.trim().toUpperCase()
    if (!v) return
    // Try to open a member directly
    if (detail?.members.find((m) => m.name === v)) {
      open(v)
    } else {
      setMsg(`MEMBER NOT FOUND: ${v}`)
      setMsgType('err')
    }
  }

  const pfKeys = [
    { label: 'F1', action: 'Help' },
    { label: 'F2', action: 'Info' },
    { label: 'F3', action: 'Exit', handler: onBack },
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
      panelTitle={`MEMBER LIST - ${dsn}`}
      rowInfo={`Row 1 of ${detail?.members.length ?? 0}`}
      shortMsg={msg || undefined}
      shortMsgType={msgType}
      commandValue={cmd}
      onCommandChange={setCmd}
      onCommandSubmit={handleSubmit}
      scrollValue="CSR"
      pfKeys={pfKeys}
      longMsg="Enter B=Browse, E=Edit, D=Delete, R=Rename beside member name and press Enter."
    >
      {/* Column header */}
      <div className="mbr-colheader">
        <span style={{ width: '4ch', flexShrink: 0 }}>  </span>
        <span className="mbr-col-name">Name    </span>
        <span className="mbr-col-vvmm">VV.MM </span>
        <span className="mbr-col-created">Created     </span>
        <span className="mbr-col-changed">Changed              </span>
        <span className="mbr-col-size"> Size  </span>
        <span className="mbr-col-id">Id       </span>
      </div>

      {loading && <div className="ispf-loading"> Loading members...</div>}

      {!loading && detail && detail.members.length === 0 && (
        <div className="ispf-empty"> No members found in this PDS.</div>
      )}

      {!loading && detail?.members.map((m, idx) => (
        <div
          key={m.name}
          className="mbr-row-wrap"
          onDoubleClick={() => open(m.name)}
        >
          <span style={{ width: '1ch' }}> </span>
          <input
            className="mbr-line-cmd"
            maxLength={1}
            defaultValue=""
            onChange={(e) => { cmdsRef.current[String(idx)] = e.target.value }}
            onKeyDown={(e) => handleRowEnter(e, m.name, idx)}
            spellCheck={false}
          />
          <span className="mbr-col-name"> {m.name.padEnd(8)}</span>
          <span className="mbr-col-vvmm"> 01.00 </span>
          <span className="mbr-col-created"> 2026/03/18 </span>
          <span className="mbr-col-changed"> {m.changed} </span>
          <span className="mbr-col-size"> {m.size.toString().padStart(5)} </span>
          <span className="mbr-col-id"> {m.userid}</span>
        </div>
      ))}
    </ISPFScreen>
  )
}
