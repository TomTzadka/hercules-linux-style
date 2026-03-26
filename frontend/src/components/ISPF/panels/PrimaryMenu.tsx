import React, { useState } from 'react'
import { ISPFScreen } from '../ISPFScreen'
import type { PanelEntry } from '../../../hooks/useNavigation'

interface Props {
  username: string
  onNavigate: (panel: PanelEntry) => void
  onLogout: () => void
}

const OPTIONS = [
  { num: '0',  name: 'Settings',   desc: 'Terminal and user parameters' },
  { num: '1',  name: 'View',       desc: 'Display source data or listings' },
  { num: '2',  name: 'Edit',       desc: 'Create or change source data' },
  { num: '3',  name: 'Utilities',  desc: 'Perform utility functions' },
  { num: '4',  name: 'Foreground', desc: 'Interactive language processing' },
  { num: '5',  name: 'Batch',      desc: 'Submit job for language processing' },
  { num: '6',  name: 'Command',    desc: 'Enter TSO or Workstation commands' },
  { num: '7',  name: 'Dialog Test','desc': 'Perform dialog testing' },
  { num: '9',  name: 'IBM Products','desc': 'IBM program development products' },
  { num: '10', name: 'SCLM',       desc: 'SW Configuration Library Manager' },
  { num: '11', name: 'Workplace',  desc: 'ISPF Object/Action Workplace' },
  { num: 'S',  name: 'SDSF',       desc: 'System Display and Search Facility' },
]

export function PrimaryMenu({ username, onNavigate, onLogout }: Props) {
  const [cmd, setCmd] = useState('')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'ok'|'err'|'info'>('info')

  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })

  const navigate = (opt: string) => {
    const o = opt.trim().toUpperCase()
    if (o === 'X') { onLogout(); return }
    if (o === '0') { onNavigate({ id: 'settings', params: {} }); return }
    if (o === '1' || o === '2') {
      onNavigate({ id: 'uss', params: { ussPath: `/u/${username.toLowerCase()}`, title: o === '1' ? 'VIEW' : 'EDIT' } })
      return
    }
    if (o === '3') {
      onNavigate({ id: 'utilities', params: {} })
      return
    }
    if (o === '3.4') {
      onNavigate({ id: 'dslist', params: { filter: '' } })
      return
    }
    if (o === '3.2') {
      onNavigate({ id: 'allocate', params: {} })
      return
    }
    if (o === '3.3') {
      onNavigate({ id: 'movecopy', params: {} })
      return
    }
    if (o === '4') {
      onNavigate({ id: 'foreground', params: {} })
      return
    }
    if (o === '5') {
      onNavigate({ id: 'batch', params: {} })
      return
    }
    if (o === '6') {
      onNavigate({ id: 'command', params: {} })
      return
    }
    if (o === 'S') {
      onNavigate({ id: 'sdsf', params: {} })
      return
    }
    // Try =n.n navigation (e.g. =3.4)
    if (o.startsWith('=')) {
      const inner = o.slice(1)
      if (inner === '3.4') { onNavigate({ id: 'dslist', params: {} }); return }
      if (inner === '3') { onNavigate({ id: 'utilities', params: {} }); return }
      if (inner === '3.2') { onNavigate({ id: 'allocate', params: {} }); return }
      if (inner === '3.3') { onNavigate({ id: 'movecopy', params: {} }); return }
      if (inner === '4') { onNavigate({ id: 'foreground', params: {} }); return }
      if (inner === '5') { onNavigate({ id: 'batch', params: {} }); return }
      if (inner === '6') { onNavigate({ id: 'command', params: {} }); return }
      if (inner === 'S' || inner === 's') { onNavigate({ id: 'sdsf', params: {} }); return }
    }
    setMsg(`OPTION NOT AVAILABLE: ${o}`)
    setMsgType('err')
  }

  const handleSubmit = (val: string) => {
    if (!val.trim()) return
    navigate(val)
  }

  const pfKeys = [
    { label: 'F1', action: 'Help' },
    { label: 'F2', action: 'Split' },
    { label: 'F3', action: 'Exit',    handler: onLogout },
    { label: 'F4', action: 'Return' },
    { label: 'F5', action: 'Rfind' },
    { label: 'F6', action: 'Rchange' },
    { label: 'F7', action: 'Backward' },
    { label: 'F8', action: 'Forward' },
    { label: 'F9', action: 'Swap' },
    { label: 'F10', action: 'Actions' },
    { label: 'F11', action: 'Menu' },
    { label: 'F12', action: 'Cancel', handler: () => setCmd('') },
  ]

  return (
    <ISPFScreen
      panelTitle="ISPF Primary Option Menu"
      rowInfo={`User: ${username}  ${timeStr}`}
      shortMsg={msg || undefined}
      shortMsgType={msgType}
      commandLabel="Option"
      commandValue={cmd}
      onCommandChange={setCmd}
      onCommandSubmit={handleSubmit}
      pfKeys={pfKeys}
      onActionItem={(item) => {
        if (item === 'Utilities') onNavigate({ id: 'dslist', params: {} })
        if (item === 'Status') onNavigate({ id: 'sdsf', params: {} })
        if (item === 'Help') { setMsg('PF1=HELP — NO HELP CONFIGURED'); setMsgType('info') }
      }}
    >
      <div className="primary-layout">
        <div className="primary-options">
          {OPTIONS.map((opt) => (
            <div
              key={opt.num}
              className="primary-opt-row"
              onClick={() => navigate(opt.num)}
            >
              <span className="primary-opt-num">{opt.num}</span>
              <span className="primary-opt-name">{opt.name}</span>
              <span className="primary-opt-desc">{opt.desc}</span>
            </div>
          ))}
          <div className="primary-opt-sep">{'─'.repeat(60)}</div>
          <div className="primary-opt-row" onClick={onLogout}>
            <span className="primary-opt-num">X</span>
            <span className="primary-opt-name">Exit</span>
            <span className="primary-opt-desc">ISPF without saving your profile</span>
          </div>
        </div>

        <div className="primary-sysinfo">
          {[
            ['User ID', username],
            ['Time', timeStr],
            ['Terminal', 'IBM 3278'],
            ['Screen', '1'],
            ['Language', 'ENGLISH'],
            ['Appl ID', 'ISR'],
            ['TSO logon', 'TSOPROC'],
            ['TSO prefix', username],
            ['System ID', 'MVS38J'],
            ['MVS acct', 'HERC01'],
          ].map(([k, v]) => (
            <div key={k} className="sysinfo-row">
              <span className="sysinfo-label"> {k} . : </span>
              <span className="sysinfo-value">{v}</span>
            </div>
          ))}
          <div style={{ marginTop: 8, color: 'var(--z-green)', fontSize: 11 }}>
            {'─'.repeat(28)}<br/>
            {' Hercules Mainframe Sim'}<br/>
            {' z/OS USS + MVS 3.8J'}<br/>
            {' jaymoseley.com'}
          </div>
        </div>
      </div>
    </ISPFScreen>
  )
}
