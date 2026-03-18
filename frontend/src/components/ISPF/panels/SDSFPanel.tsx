import React, { useState, useEffect } from 'react'
import { ISPFScreen } from '../ISPFScreen'
import client from '../../../api/client'
import type { PanelEntry } from '../../../hooks/useNavigation'

interface Props {
  sessionId: string
  onNavigate: (panel: PanelEntry) => void
  onBack: () => void
}

interface SDSFJob {
  jobname: string
  jobid: string
  owner: string
  prty: number
  queue: string
  c: string
  maxrc: string
  status: 'CC0000' | 'CC0004' | 'CC0008' | 'ACTIVE' | 'INPUT'
}

// Static job list (realistic MVS job queue)
const JOBS: SDSFJob[] = [
  { jobname: 'JES2',     jobid: 'STC00001', owner: 'IBMUSER', prty: 15, queue: 'STC',    c: 'STC', maxrc: 'STC',    status: 'ACTIVE' },
  { jobname: 'SMF',      jobid: 'STC00002', owner: 'IBMUSER', prty: 15, queue: 'STC',    c: 'STC', maxrc: 'STC',    status: 'ACTIVE' },
  { jobname: 'TCPIP',    jobid: 'STC00003', owner: 'IBMUSER', prty: 14, queue: 'STC',    c: 'STC', maxrc: 'STC',    status: 'ACTIVE' },
  { jobname: 'VTAM',     jobid: 'STC00010', owner: 'IBMUSER', prty: 14, queue: 'STC',    c: 'STC', maxrc: 'STC',    status: 'ACTIVE' },
  { jobname: 'RACF',     jobid: 'STC00011', owner: 'IBMUSER', prty: 15, queue: 'STC',    c: 'STC', maxrc: 'STC',    status: 'ACTIVE' },
  { jobname: 'COBRUN',   jobid: 'JOB00123', owner: 'HERC01',  prty: 5,  queue: 'OUTPUT', c: 'A',   maxrc: '0000',   status: 'CC0000' },
  { jobname: 'HELLO',    jobid: 'JOB00124', owner: 'HERC01',  prty: 5,  queue: 'OUTPUT', c: 'A',   maxrc: '0000',   status: 'CC0000' },
  { jobname: 'SORTJOB',  jobid: 'JOB00125', owner: 'HERC01',  prty: 5,  queue: 'OUTPUT', c: 'B',   maxrc: '0004',   status: 'CC0004' },
  { jobname: 'BACKUP',   jobid: 'JOB00126', owner: 'HERC01',  prty: 3,  queue: 'INPUT',  c: 'B',   maxrc: '',       status: 'INPUT' },
]

const STATUS_CLASSES: Record<string, string> = {
  CC0000: 'sdsf-status--cc0',
  CC0004: 'sdsf-status--cc4',
  CC0008: 'sdsf-status--cc8',
  ACTIVE: 'sdsf-status--run',
  INPUT:  '',
}

type View = 'ST' | 'LOG'

export function SDSFPanel({ sessionId, onNavigate, onBack }: Props) {
  const [cmd, setCmd] = useState('')
  const [view, setView] = useState<View>('ST')
  const [logLines, setLogLines] = useState<string[]>([])
  const [msg, setMsg] = useState('SDSF PRIMARY OPTION MENU')
  const [msgType, setMsgType] = useState<'ok'|'err'|'info'>('info')

  useEffect(() => {
    if (view === 'LOG') {
      client.get('/fs/cat', { params: { path: '/var/log/messages' } })
        .then((r) => setLogLines((r.data.data?.content ?? '').split('\n')))
        .catch(() => setLogLines(['ERROR READING SYSTEM LOG']))
    }
  }, [view])

  const handleSubmit = (val: string) => {
    const v = val.trim().toUpperCase()
    if (!v) return
    if (v === 'ST') { setView('ST'); setMsg('STATUS DISPLAY'); setMsgType('ok'); return }
    if (v === 'LOG') { setView('LOG'); setMsg('SYSTEM LOG'); setMsgType('ok'); return }
    if (v === 'DA') { setMsg('DISPLAY ACTIVE — USE ST FOR JOB LIST'); setMsgType('info'); return }
    if (v.startsWith('?') || v === 'HELP') {
      setMsg('SDSF COMMANDS: ST=Status  LOG=System Log  DA=Display Active')
      setMsgType('info')
      return
    }
    // clicking on a job (jobname)
    const job = JOBS.find((j) => j.jobname === v || j.jobid === v)
    if (job) {
      // View job output
      onNavigate({
        id: 'view',
        params: {
          ussPath: '/var/spool/jobs/JOB00123.txt',
          label: `SDSF OUTPUT  ${job.jobname}(${job.jobid})`,
        }
      })
      return
    }
    setMsg(`INVALID COMMAND: ${v}`)
    setMsgType('err')
  }

  const pfKeys = [
    { label: 'F1', action: 'Help' },
    { label: 'F3', action: 'Exit', handler: onBack },
    { label: 'F4', action: 'ST',   handler: () => { setView('ST'); setMsg('STATUS DISPLAY'); setMsgType('ok') } },
    { label: 'F5', action: 'LOG',  handler: () => { setView('LOG'); setMsg('SYSTEM LOG'); setMsgType('ok') } },
    { label: 'F7', action: 'Up' },
    { label: 'F8', action: 'Down' },
    { label: 'F9', action: 'Swap' },
    { label: 'F12', action: 'Cancel', handler: onBack },
  ]

  return (
    <ISPFScreen
      panelTitle={`SDSF - ${view === 'ST' ? 'STATUS DISPLAY (ST)' : 'SYSTEM LOG'}`}
      rowInfo="MVS38J"
      shortMsg={msg}
      shortMsgType={msgType}
      commandValue={cmd}
      onCommandChange={setCmd}
      onCommandSubmit={handleSubmit}
      pfKeys={pfKeys}
      longMsg="Enter ST=Status  LOG=System Log  DA=Display Active  ?=Help. Click jobname to view output."
    >
      {view === 'ST' && (
        <>
          <div className="sdsf-colheader">
            <span className="sdsf-col-np"> NP </span>
            <span className="sdsf-col-jobname">Jobname  </span>
            <span className="sdsf-col-jobid">JobID    </span>
            <span className="sdsf-col-owner">Owner    </span>
            <span className="sdsf-col-prty">Prty </span>
            <span className="sdsf-col-queue">Queue  </span>
            <span className="sdsf-col-c">C  </span>
            <span className="sdsf-col-maxrc">MaxRC </span>
            <span className="sdsf-col-status">Status    </span>
          </div>

          {JOBS.map((job) => (
            <div key={job.jobid} className="sdsf-row" onClick={() => setCmd(job.jobname)}>
              <span className="sdsf-col-np">  _ </span>
              <span className="sdsf-col-jobname">{job.jobname.padEnd(9)}</span>
              <span className="sdsf-col-jobid">{job.jobid.padEnd(9)}</span>
              <span className="sdsf-col-owner">{job.owner.padEnd(9)}</span>
              <span className="sdsf-col-prty">{String(job.prty).padStart(4)} </span>
              <span className="sdsf-col-queue">{job.queue.padEnd(7)}</span>
              <span className="sdsf-col-c">{job.c.padEnd(3)}</span>
              <span className="sdsf-col-maxrc">{job.maxrc.padEnd(6)}</span>
              <span className={`sdsf-col-status ${STATUS_CLASSES[job.status] ?? ''}`}>{job.status}</span>
            </div>
          ))}
        </>
      )}

      {view === 'LOG' && (
        <div>
          {logLines.map((line, i) => {
            let cls = 'sdsf-log-line--info'
            if (line.includes('STARTED') || line.includes('STC')) cls = 'sdsf-log-line--stc'
            else if (line.includes('IEF403') || line.includes('JOB')) cls = 'sdsf-log-line--job'
            else if (line.includes('ERROR') || line.includes('ABEND')) cls = 'sdsf-log-line--err'
            else if (line.includes('WARNING') || line.includes('WARN')) cls = 'sdsf-log-line--warn'
            else if (line.includes('kernel') || line.includes('boot')) cls = 'sdsf-log-line--sys'
            return (
              <div key={i} className={`sdsf-log-line ${cls}`}> {line}</div>
            )
          })}
        </div>
      )}
    </ISPFScreen>
  )
}
