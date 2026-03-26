import React, { useState } from 'react'
import { ISPFScreen } from '../ISPFScreen'
import { allocateDataset } from '../../../api/datasets'

interface Props {
  onBack: () => void
}

export function AllocatePanel({ onBack }: Props) {
  const [cmd, setCmd] = useState('')
  const [msg, setMsg] = useState('SPECIFY DATA SET ATTRIBUTES AND PRESS ENTER TO ALLOCATE')
  const [msgType, setMsgType] = useState<'ok'|'err'|'info'>('info')

  // Form fields
  const [dsn, setDsn] = useState('')
  const [dsorg, setDsorg] = useState('PS')
  const [recfm, setRecfm] = useState('FB')
  const [lrecl, setLrecl] = useState('80')
  const [blksize, setBlksize] = useState('3200')
  const [volser, setVolser] = useState('USR001')

  const doAllocate = async () => {
    const dsnUpper = dsn.trim().toUpperCase()
    if (!dsnUpper) { setMsg('DATA SET NAME IS REQUIRED'); setMsgType('err'); return }
    if (!/^[A-Z#@$][A-Z0-9#@$.]*(\.[A-Z#@$][A-Z0-9#@$.]*)*$/.test(dsnUpper)) {
      setMsg('INVALID DSN FORMAT — USE QUALIFIED NAME LIKE MY.DATA.SET'); setMsgType('err'); return
    }
    const dsorgUpper = dsorg.trim().toUpperCase()
    if (!['PS', 'PO'].includes(dsorgUpper)) { setMsg('DSORG MUST BE PS OR PO'); setMsgType('err'); return }
    const recfmUpper = recfm.trim().toUpperCase()
    if (!['FB', 'VB', 'U', 'F', 'V'].includes(recfmUpper)) { setMsg('RECFM MUST BE FB, VB, F, V, OR U'); setMsgType('err'); return }
    const lreclNum = parseInt(lrecl) || 80
    const blksizeNum = parseInt(blksize) || 3200
    try {
      await allocateDataset(dsnUpper, dsorgUpper, recfmUpper, lreclNum, blksizeNum, volser.trim().toUpperCase() || 'USR001')
      setMsg(`DATASET '${dsnUpper}' ALLOCATED SUCCESSFULLY`)
      setMsgType('ok')
      setDsn('')
    } catch (e: any) {
      setMsg(`ALLOCATION FAILED: ${e.message || 'DATASET MAY ALREADY EXIST'}`)
      setMsgType('err')
    }
  }

  const handleSubmit = async (val: string) => {
    const v = val.trim().toUpperCase()
    if (!v) { await doAllocate(); return }
    if (v === 'ALLOC' || v === 'ALLOCATE') { await doAllocate(); return }
    setMsg(`UNKNOWN COMMAND: ${v}`); setMsgType('err')
  }

  const pfKeys = [
    { label: 'F1', action: 'Help' },
    { label: 'F2', action: 'Alloc', handler: doAllocate },
    { label: 'F3', action: 'Exit', handler: onBack },
    { label: 'F12', action: 'Cancel', handler: onBack },
  ]

  const labelStyle: React.CSSProperties = {
    color: 'var(--z-green)',
    display: 'inline-block',
    width: '28ch',
  }

  const inputStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid var(--z-cyan)',
    color: 'var(--z-yellow)',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    outline: 'none',
  }

  return (
    <ISPFScreen
      panelTitle="UTILITY 3.2 — Allocate New Data Set"
      rowInfo="Option 3.2"
      shortMsg={msg}
      shortMsgType={msgType}
      commandValue={cmd}
      onCommandChange={setCmd}
      onCommandSubmit={handleSubmit}
      pfKeys={pfKeys}
      longMsg="Fill in DSN and attributes. Press Enter or F2 to allocate. F3=Exit."
    >
      <div style={{ marginTop: 8, lineHeight: '2em' }}>
        <div style={{ color: 'var(--z-yellow)', marginBottom: 8 }}>
          {'  Specify data set attributes for the new data set to be allocated.'}
        </div>

        <div>
          <span style={labelStyle}>{'  Data set name . . . . . . :'}</span>
          <input
            value={dsn}
            onChange={e => setDsn(e.target.value.toUpperCase())}
            placeholder="MY.NEW.DATASET"
            spellCheck={false}
            style={{ ...inputStyle, width: '44ch' }}
            autoFocus
          />
        </div>

        <div>
          <span style={labelStyle}>{'  Data set organization . . :'}</span>
          <input
            value={dsorg}
            onChange={e => setDsorg(e.target.value.toUpperCase())}
            maxLength={2}
            spellCheck={false}
            style={{ ...inputStyle, width: '4ch' }}
          />
          <span style={{ color: 'var(--z-green)', fontSize: 11, marginLeft: '1ch' }}>(PS / PO)</span>
        </div>

        <div>
          <span style={labelStyle}>{'  Record format. . . . . . . :'}</span>
          <input
            value={recfm}
            onChange={e => setRecfm(e.target.value.toUpperCase())}
            maxLength={2}
            spellCheck={false}
            style={{ ...inputStyle, width: '4ch' }}
          />
          <span style={{ color: 'var(--z-green)', fontSize: 11, marginLeft: '1ch' }}>(FB / VB / F / V / U)</span>
        </div>

        <div>
          <span style={labelStyle}>{'  Record length . . . . . . :'}</span>
          <input
            value={lrecl}
            onChange={e => setLrecl(e.target.value.replace(/\D/g, ''))}
            maxLength={5}
            spellCheck={false}
            style={{ ...inputStyle, width: '6ch' }}
          />
        </div>

        <div>
          <span style={labelStyle}>{'  Block size . . . . . . . . :'}</span>
          <input
            value={blksize}
            onChange={e => setBlksize(e.target.value.replace(/\D/g, ''))}
            maxLength={6}
            spellCheck={false}
            style={{ ...inputStyle, width: '8ch' }}
          />
        </div>

        <div>
          <span style={labelStyle}>{'  Volume serial . . . . . . :'}</span>
          <input
            value={volser}
            onChange={e => setVolser(e.target.value.toUpperCase())}
            maxLength={6}
            spellCheck={false}
            style={{ ...inputStyle, width: '8ch' }}
          />
        </div>

        <div style={{ marginTop: 16, color: 'var(--z-cyan)', fontSize: 11 }}>
          {'─'.repeat(60)}<br />
          {'  Space defaults: 5 primary, 5 secondary tracks (simulated)'}<br />
          {'  Press Enter or F2 (Alloc) to create the data set.'}<br />
          {'─'.repeat(60)}
        </div>
      </div>
    </ISPFScreen>
  )
}
