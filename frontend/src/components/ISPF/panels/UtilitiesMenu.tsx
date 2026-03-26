import React, { useState } from 'react'
import { ISPFScreen } from '../ISPFScreen'
import type { PanelEntry } from '../../../hooks/useNavigation'

interface Props {
  onNavigate: (panel: PanelEntry) => void
  onBack: () => void
}

const UTIL_OPTIONS = [
  { num: '1',  name: 'Library',       desc: 'Copy/move/rename members between PDSs' },
  { num: '2',  name: 'Data Set',      desc: 'Allocate, rename, catalog, compress PDS' },
  { num: '3',  name: 'Move/Copy',     desc: 'Move or copy data sets or members' },
  { num: '4',  name: 'Data Set List', desc: 'List data sets — DSLIST utility' },
  { num: '5',  name: 'Reset Stats',   desc: 'Reset ISPF statistics for members' },
  { num: '6',  name: 'Hardcopy',      desc: 'Print data set to SYSOUT class' },
  { num: '8',  name: 'Outlist',       desc: 'Browse/print held SYSOUT data' },
  { num: '11', name: 'SuperC',        desc: 'Compare two data sets (source compare)' },
  { num: '12', name: 'SuperCE',       desc: 'Compare Extended with change list' },
  { num: '13', name: 'Search-For',    desc: 'Search for string across multiple members' },
  { num: '14', name: 'Search-ForE',   desc: 'Search Extended with patterns' },
]

export function UtilitiesMenu({ onNavigate, onBack }: Props) {
  const [cmd, setCmd] = useState('')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'ok'|'err'|'info'>('info')

  const navigate = (opt: string) => {
    const o = opt.trim().toUpperCase()
    if (o === '4' || o === '3.4') {
      onNavigate({ id: 'dslist', params: { filter: '' } }); return
    }
    if (o === '2' || o === '3.2') {
      onNavigate({ id: 'allocate', params: {} }); return
    }
    if (o === '3' || o === '3.3') {
      onNavigate({ id: 'movecopy', params: {} }); return
    }
    if (o === '5' || o === '3.5') {
      // Reset statistics: show a stub message
      setMsg('3.5 RESET STATISTICS — USE FROM MEMBER LIST WITH R COMMAND')
      setMsgType('info'); return
    }
    if (o === '11' || o === '3.11') {
      onNavigate({
        id: 'view',
        params: {
          content: [
            'ISPF SUPERC — SOURCE COMPARE UTILITY',
            '═'.repeat(50),
            '',
            'SuperC is not fully implemented in this simulator.',
            '',
            'To compare two members manually:',
            '  1. Use BROWSE (B) to open member 1',
            '  2. Use BROWSE (B) to open member 2',
            '  3. Compare content side by side',
            '',
            'In real z/OS:',
            '  SuperC compares two PDSs or sequential datasets',
            '  and produces a change listing showing added,',
            '  deleted, and changed lines.',
            '',
            'Commands (real ISPF):',
            '  OLD  DSN1  — Old (input) dataset',
            '  NEW  DSN2  — New (updated) dataset',
            '  OUTDS dsn  — Output change listing',
            '  SRCHFOR str — Search for string',
          ].join('\n'),
          label: 'ISPF SUPERC 3.11',
        }
      }); return
    }
    if (o === '13' || o === '3.13') {
      onNavigate({ id: 'searchfor', params: {} }); return
    }
    if (o === '6' || o === '8' || o === '12' || o === '14' || o === '1') {
      setMsg(`OPTION ${o} — NOT IMPLEMENTED IN THIS SIMULATOR`)
      setMsgType('info'); return
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
    { label: 'F3', action: 'Exit', handler: onBack },
    { label: 'F12', action: 'Cancel', handler: onBack },
  ]

  return (
    <ISPFScreen
      panelTitle="ISPF Utility Selection Panel"
      rowInfo="Option 3"
      shortMsg={msg || undefined}
      shortMsgType={msgType}
      commandLabel="Option"
      commandValue={cmd}
      onCommandChange={setCmd}
      onCommandSubmit={handleSubmit}
      pfKeys={pfKeys}
    >
      <div style={{ marginTop: 4 }}>
        {UTIL_OPTIONS.map((opt) => {
          const implemented = ['2', '3', '4', '13'].includes(opt.num) || opt.num === '11'
          return (
            <div
              key={opt.num}
              className="primary-opt-row"
              onClick={() => navigate(opt.num)}
              style={{ cursor: 'pointer' }}
            >
              <span className="primary-opt-num" style={{ width: '4ch', flexShrink: 0 }}>{opt.num}</span>
              <span className="primary-opt-name" style={{ width: '14ch', flexShrink: 0, color: implemented ? 'var(--z-yellow)' : 'var(--z-green)' }}>{opt.name}</span>
              <span className="primary-opt-desc" style={{ color: implemented ? 'var(--z-green)' : 'var(--z-white)' }}>{opt.desc}</span>
            </div>
          )
        })}
      </div>
    </ISPFScreen>
  )
}
