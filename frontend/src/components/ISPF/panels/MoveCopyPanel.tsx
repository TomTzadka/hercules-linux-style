import React, { useState } from 'react'
import { ISPFScreen } from '../ISPFScreen'
import { getMember, writeMember, deleteMember, getDataset } from '../../../api/datasets'
import client from '../../../api/client'

interface Props {
  sourceDsn?: string
  sourceMember?: string
  onBack: () => void
}

export function MoveCopyPanel({ sourceDsn: initSrcDsn, sourceMember: initSrcMbr, onBack }: Props) {
  const [cmd, setCmd] = useState('')
  const [msg, setMsg] = useState('SPECIFY FROM AND TO DATA SETS')
  const [msgType, setMsgType] = useState<'ok'|'err'|'info'>('info')
  const [mode, setMode] = useState('COPY')

  const [fromDsn, setFromDsn] = useState(initSrcDsn ?? '')
  const [fromMember, setFromMember] = useState(initSrcMbr ?? '')
  const [toDsn, setToDsn] = useState('')
  const [toMember, setToMember] = useState(initSrcMbr ?? '')

  const doOperation = async () => {
    const srcDsn = fromDsn.trim().toUpperCase()
    const srcMbr = fromMember.trim().toUpperCase()
    const dstDsn = toDsn.trim().toUpperCase()
    const dstMbr = toMember.trim().toUpperCase() || srcMbr

    if (!srcDsn) { setMsg('FROM DATA SET NAME IS REQUIRED'); setMsgType('err'); return }
    if (!dstDsn) { setMsg('TO DATA SET NAME IS REQUIRED'); setMsgType('err'); return }

    const modeUpper = mode.trim().toUpperCase()
    if (!['COPY', 'MOVE'].includes(modeUpper)) { setMsg('OPTION MUST BE COPY OR MOVE'); setMsgType('err'); return }
    setMsg(`${modeUpper === 'COPY' ? 'COPYING' : 'MOVING'} ${srcDsn}${srcMbr ? `(${srcMbr})` : ''} ...`)
    setMsgType('info')

    try {
      let content = ''

      if (srcMbr) {
        // PDS member operation
        const m = await getMember(srcDsn, srcMbr)
        content = m.content
        await writeMember(dstDsn, dstMbr || srcMbr, content)
        if (modeUpper === 'MOVE') {
          await deleteMember(srcDsn, srcMbr)
        }
        setMsg(`${modeUpper} COMPLETE: ${srcDsn}(${srcMbr}) → ${dstDsn}(${dstMbr || srcMbr})`)
      } else {
        // Sequential or whole PDS — get dataset detail
        const ds = await getDataset(srcDsn)
        if (ds.dsorg === 'PO') {
          // Copy all members
          let copied = 0
          for (const m of ds.members) {
            const detail = await getMember(srcDsn, m.name)
            await writeMember(dstDsn, m.name, detail.content)
            copied++
          }
          if (modeUpper === 'MOVE') {
            setMsg(`MOVE of PDS not supported — use individual member move. ${copied} members COPIED.`)
            setMsgType('info')
          } else {
            setMsg(`${copied} MEMBERS COPIED FROM ${srcDsn} TO ${dstDsn}`)
            setMsgType('ok')
          }
          return
        } else {
          // Sequential dataset
          content = ds.content ?? ''
          await client.post(`/datasets`, {
            dsn: dstDsn, dsorg: ds.dsorg, recfm: ds.recfm,
            lrecl: ds.lrecl, blksize: 3200, volser: 'USR001',
          }).catch(() => {/* may already exist */})
          await client.post(`/datasets/${dstDsn}/content`, { content })
          setMsg(`${modeUpper} COMPLETE: ${srcDsn} → ${dstDsn}`)
        }
      }

      setMsgType('ok')
    } catch (e: any) {
      setMsg(`${modeUpper} FAILED: ${e.message || 'CHECK SOURCE/TARGET DATASET NAMES'}`)
      setMsgType('err')
    }
  }

  const handleSubmit = async (val: string) => {
    const v = val.trim().toUpperCase()
    if (!v) { await doOperation(); return }
    if (v === 'COPY') { setMode('COPY'); setMsg('MODE: COPY'); setMsgType('ok'); return }
    if (v === 'MOVE') { setMode('MOVE'); setMsg('MODE: MOVE'); setMsgType('ok'); return }
    if (v === 'EXECUTE' || v === 'EXEC') { await doOperation(); return }
    setMsg(`UNKNOWN COMMAND: ${v}`); setMsgType('err')
  }

  const pfKeys = [
    { label: 'F1', action: 'Help' },
    { label: 'F2', action: 'Execute', handler: doOperation },
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
      panelTitle="UTILITY 3.3 — Move/Copy Data Sets or Members"
      rowInfo="Option 3.3"
      shortMsg={msg}
      shortMsgType={msgType}
      commandValue={cmd}
      onCommandChange={setCmd}
      onCommandSubmit={handleSubmit}
      pfKeys={pfKeys}
      longMsg="Fill in FROM and TO fields. COPY=duplicate, MOVE=copy+delete source. Press Enter or F2."
    >
      <div style={{ marginTop: 8, lineHeight: '2em' }}>
        <div style={{ color: 'var(--z-yellow)', marginBottom: 8 }}>
          {'  Specify FROM and TO data set names. Leave member blank for entire PDS.'}
        </div>

        {/* Mode selection */}
        <div style={{ marginBottom: 8 }}>
          <span style={labelStyle}>{'  Option (COPY or MOVE). . . :'}</span>
          <input
            value={mode}
            onChange={e => setMode(e.target.value.toUpperCase())}
            maxLength={4}
            spellCheck={false}
            style={{ ...inputStyle, width: '6ch' }}
          />
          <span style={{ color: 'var(--z-green)', fontSize: 11, marginLeft: '1ch' }}>(COPY / MOVE)</span>
        </div>

        <div style={{ color: 'var(--z-cyan)', margin: '4px 0' }}>{'  ─── FROM ───────────────────────────────────────'}</div>

        <div>
          <span style={labelStyle}>{'  Data set name . . . . . . :'}</span>
          <input
            value={fromDsn}
            onChange={e => setFromDsn(e.target.value.toUpperCase())}
            placeholder="MY.SOURCE.PDS"
            spellCheck={false}
            style={{ ...inputStyle, width: '44ch' }}
            autoFocus
          />
        </div>

        <div>
          <span style={labelStyle}>{'  Member (blank=all) . . . . :'}</span>
          <input
            value={fromMember}
            onChange={e => setFromMember(e.target.value.toUpperCase())}
            placeholder="MEMBERNAME"
            maxLength={8}
            spellCheck={false}
            style={{ ...inputStyle, width: '10ch' }}
          />
        </div>

        <div style={{ color: 'var(--z-cyan)', margin: '4px 0' }}>{'  ─── TO ─────────────────────────────────────────'}</div>

        <div>
          <span style={labelStyle}>{'  Data set name . . . . . . :'}</span>
          <input
            value={toDsn}
            onChange={e => setToDsn(e.target.value.toUpperCase())}
            placeholder="MY.TARGET.PDS"
            spellCheck={false}
            style={{ ...inputStyle, width: '44ch' }}
          />
        </div>

        <div>
          <span style={labelStyle}>{'  Member name . . . . . . . :'}</span>
          <input
            value={toMember}
            onChange={e => setToMember(e.target.value.toUpperCase())}
            placeholder="(same as from)"
            maxLength={8}
            spellCheck={false}
            style={{ ...inputStyle, width: '10ch' }}
          />
        </div>

        <div style={{ marginTop: 16, color: 'var(--z-cyan)', fontSize: 11 }}>
          {'─'.repeat(60)}<br />
          {'  Press Enter or F2 to execute the ' + mode + ' operation.'}<br />
          {'  Type COPY or MOVE in command line to change mode.'}<br />
          {'─'.repeat(60)}
        </div>
      </div>
    </ISPFScreen>
  )
}
