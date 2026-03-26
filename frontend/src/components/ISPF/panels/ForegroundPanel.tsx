import React, { useState } from 'react'
import { ISPFScreen } from '../ISPFScreen'

interface Props {
  onBack: () => void
}

const VALID_LANGUAGES = ['COBOL', 'FORTRAN', 'PLI', 'ASM', 'REXX', 'CLIST']

export function ForegroundPanel({ onBack }: Props) {
  const [cmd, setCmd] = useState('')
  const [msg, setMsg] = useState('ENTER OPTION TO SELECT LANGUAGE PROCESSOR')
  const [msgType, setMsgType] = useState<'ok'|'err'|'info'>('info')
  const [language, setLanguage] = useState('COBOL')
  const [sourceDsn, setSourceDsn] = useState('')
  const [objDsn, setObjDsn] = useState('')
  const [listDsn, setListDsn] = useState('')
  const [options, setOptions] = useState('')

  const handleSubmit = (val: string) => {
    const v = val.trim().toUpperCase()
    if (!v) {
      if (!sourceDsn.trim()) {
        setMsg('SOURCE DSN REQUIRED'); setMsgType('err'); return
      }
      const langUpper = language.trim().toUpperCase()
      if (!VALID_LANGUAGES.includes(langUpper)) {
        setMsg(`LANGUAGE MUST BE ONE OF: ${VALID_LANGUAGES.join(' / ')}`); setMsgType('err'); return
      }
      // Simulate foreground compile
      const dsn = sourceDsn.trim().toUpperCase()
      setTimeout(() => {
        setMsg(`IEW2000I PROGRAM ${langUpper} COMPILE COMPLETE — RC=0000 — NO ERRORS`)
        setMsgType('ok')
      }, 800)
      setMsg(`COMPILING ${dsn} WITH ${langUpper}...`); setMsgType('info')
      return
    }
    if (v === 'COBOL' || v === '1') { setLanguage('COBOL'); return }
    if (v === 'FORTRAN' || v === '2') { setLanguage('FORTRAN'); return }
    if (v === 'PLI' || v === '3') { setLanguage('PLI'); return }
    if (v === 'ASM' || v === '4') { setLanguage('ASM'); return }
    if (v === 'REXX' || v === '5') { setLanguage('REXX'); return }
    setMsg(`UNKNOWN OPTION: ${v}`); setMsgType('err')
  }

  const pfKeys = [
    { label: 'F1', action: 'Help' },
    { label: 'F3', action: 'Exit', handler: onBack },
    { label: 'F12', action: 'Cancel', handler: onBack },
  ]

  const fieldStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid var(--z-cyan)',
    color: 'var(--z-yellow)',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    outline: 'none',
    width: '44ch',
  }

  const labelStyle: React.CSSProperties = {
    color: 'var(--z-green)',
    display: 'inline-block',
    width: '22ch',
  }

  return (
    <ISPFScreen
      panelTitle="ISPF/PDF FOREGROUND — Language Processing"
      rowInfo="Option 4"
      shortMsg={msg}
      shortMsgType={msgType}
      commandValue={cmd}
      onCommandChange={setCmd}
      onCommandSubmit={handleSubmit}
      pfKeys={pfKeys}
      longMsg="Enter source DSN and press Enter to compile. Press F3 to exit."
    >
      <div style={{ marginTop: 8, lineHeight: '1.8em' }}>
        <div style={{ color: 'var(--z-yellow)', marginBottom: 8 }}>
          {'  Select language processor and specify data set names.'}
        </div>

        <div style={{ marginBottom: 8 }}>
          <span style={labelStyle}>{'  Language . . . . . . :'}</span>
          <input
            value={language}
            onChange={e => setLanguage(e.target.value.toUpperCase())}
            maxLength={7}
            spellCheck={false}
            style={{ ...fieldStyle, width: '10ch' }}
          />
          <span style={{ color: 'var(--z-green)', fontSize: 11, marginLeft: '1ch' }}>({VALID_LANGUAGES.join(' / ')})</span>
        </div>

        <div style={{ marginBottom: 4 }}>
          <span style={labelStyle}>{'  Source data set name  :'}</span>
          <input
            value={sourceDsn}
            onChange={e => setSourceDsn(e.target.value.toUpperCase())}
            placeholder="'MY.COBOL.SRC(MEMBER)'"
            spellCheck={false}
            style={fieldStyle}
          />
        </div>

        <div style={{ marginBottom: 4 }}>
          <span style={labelStyle}>{'  Object data set name  :'}</span>
          <input
            value={objDsn}
            onChange={e => setObjDsn(e.target.value.toUpperCase())}
            placeholder="'MY.OBJ'"
            spellCheck={false}
            style={fieldStyle}
          />
        </div>

        <div style={{ marginBottom: 4 }}>
          <span style={labelStyle}>{'  Listing data set name :'}</span>
          <input
            value={listDsn}
            onChange={e => setListDsn(e.target.value.toUpperCase())}
            placeholder="'MY.LIST'"
            spellCheck={false}
            style={fieldStyle}
          />
        </div>

        <div style={{ marginBottom: 4 }}>
          <span style={labelStyle}>{'  Options . . . . . . . :'}</span>
          <input
            value={options}
            onChange={e => setOptions(e.target.value.toUpperCase())}
            placeholder="NOSEQ OFFSET LIST"
            spellCheck={false}
            style={fieldStyle}
          />
        </div>

        <div style={{ marginTop: 16, color: 'var(--z-cyan)', fontSize: 11 }}>
          {'─'.repeat(60)}<br />
          {'  NOTE: Foreground compilation is simulated.'}<br />
          {'  Actual code generation is not performed.'}<br />
          {'─'.repeat(60)}
        </div>
      </div>
    </ISPFScreen>
  )
}
