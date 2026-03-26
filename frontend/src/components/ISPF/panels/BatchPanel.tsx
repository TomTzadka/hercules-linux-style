import React, { useState } from 'react'
import { ISPFScreen } from '../ISPFScreen'
import { submitJcl } from '../../../api/spool'

interface Props {
  username: string
  onBack: () => void
}

const DEFAULT_JOB = `//BATCHJOB JOB (HERC01),'BATCH COMPILE',CLASS=A,MSGCLASS=A,
//          MSGLEVEL=(1,1),NOTIFY=&SYSUID
//*
//STEP1    EXEC PGM=IGYCRCTL,PARM='NOSEQ,NOTERM,OBJECT'
//SYSPRINT DD   SYSOUT=*
//SYSLIN   DD   DSN=&&LOADSET,UNIT=SYSDA,SPACE=(TRK,(3,3)),
//              DISP=(MOD,PASS)
//SYSIN    DD   DSN=MY.COBOL.SRC(MYPGM),DISP=SHR
//*
//LKED     EXEC PGM=HEWL,PARM='LIST,XREF',COND=(8,LT,STEP1)
//SYSPRINT DD   SYSOUT=*
//SYSLIN   DD   DSN=&&LOADSET,DISP=(OLD,DELETE)
//SYSLMOD  DD   DSN=MY.LOAD(MYPGM),DISP=SHR
//`

export function BatchPanel({ username, onBack }: Props) {
  const [cmd, setCmd] = useState('')
  const [msg, setMsg] = useState('ENTER JCL AND PRESS ENTER OR TYPE SUBMIT')
  const [msgType, setMsgType] = useState<'ok'|'err'|'info'>('info')
  const [jcl, setJcl] = useState(DEFAULT_JOB)
  const [sourceDsn, setSourceDsn] = useState('')
  const [jobClass, setJobClass] = useState('A')

  const doSubmit = async () => {
    const jclToSubmit = jcl.replace('MY.COBOL.SRC(MYPGM)',
      sourceDsn.trim() || 'MY.COBOL.SRC(MYPGM)')
    try {
      const job = await submitJcl(jclToSubmit, username)
      setMsg(`${job.jobid} SUBMITTED — JOBNAME=${job.jobname} — CHECK SDSF FOR STATUS`)
      setMsgType('ok')
    } catch {
      setMsg('SUBMIT FAILED — CHECK JCL SYNTAX')
      setMsgType('err')
    }
  }

  const handleSubmit = async (val: string) => {
    const v = val.trim().toUpperCase()
    if (!v || v === 'SUBMIT' || v === 'SUB') {
      await doSubmit(); return
    }
    setMsg(`UNKNOWN COMMAND: ${v}`); setMsgType('err')
  }

  const pfKeys = [
    { label: 'F1', action: 'Help' },
    { label: 'F2', action: 'Submit', handler: doSubmit },
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
  }

  const labelStyle: React.CSSProperties = {
    color: 'var(--z-green)',
    display: 'inline-block',
    width: '24ch',
  }

  return (
    <ISPFScreen
      panelTitle="ISPF/PDF BATCH — Submit Job for Language Processing"
      rowInfo="Option 5"
      shortMsg={msg}
      shortMsgType={msgType}
      commandValue={cmd}
      onCommandChange={setCmd}
      onCommandSubmit={handleSubmit}
      pfKeys={pfKeys}
      longMsg="Edit JCL below or fill in source DSN. SUBMIT or F2 to submit job."
    >
      <div style={{ marginTop: 4, lineHeight: '1.8em' }}>
        <div style={{ color: 'var(--z-yellow)', marginBottom: 4 }}>
          {'  Specify source DSN or edit JCL below, then press SUBMIT (F2).'}
        </div>

        <div style={{ marginBottom: 4 }}>
          <span style={labelStyle}>{'  Source data set name  :'}</span>
          <input
            value={sourceDsn}
            onChange={e => setSourceDsn(e.target.value.toUpperCase())}
            placeholder="'MY.COBOL.SRC(MYPGM)'"
            spellCheck={false}
            style={{ ...fieldStyle, width: '40ch' }}
          />
        </div>

        <div style={{ marginBottom: 4 }}>
          <span style={labelStyle}>{'  Job class  . . . . .  :'}</span>
          <input
            value={jobClass}
            onChange={e => setJobClass(e.target.value.toUpperCase().slice(0, 1))}
            maxLength={1}
            spellCheck={false}
            style={{ ...fieldStyle, width: '3ch' }}
          />
        </div>

        <div style={{ color: 'var(--z-cyan)', margin: '8px 0 4px' }}>{'  JCL Statements:'}</div>

        <textarea
          value={jcl}
          onChange={e => setJcl(e.target.value)}
          spellCheck={false}
          rows={12}
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid var(--z-cyan)',
            color: 'var(--z-green)',
            fontFamily: 'IBM Plex Mono, Courier New, monospace',
            fontSize: 'inherit',
            outline: 'none',
            width: '100%',
            resize: 'vertical',
            padding: '4px 8px',
          }}
        />
      </div>
    </ISPFScreen>
  )
}
