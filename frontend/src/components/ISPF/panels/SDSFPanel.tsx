import React, { useState, useEffect, useRef } from 'react'
import { ISPFScreen } from '../ISPFScreen'
import client from '../../../api/client'
import { listSpoolJobs, getSpoolJob, deleteSpoolJob } from '../../../api/spool'
import type { SpoolJobInfo } from '../../../api/spool'
import type { PanelEntry } from '../../../hooks/useNavigation'

interface Props {
  sessionId: string
  onNavigate: (panel: PanelEntry) => void
  onBack: () => void
}

type AllJob = SpoolJobInfo & { isStc?: boolean }

// Static started tasks (always running)
const STATIC_STCS: AllJob[] = [
  { jobname: 'JES2',  jobid: 'STC00001', owner: 'TOMTZ', prty: 15, queue: 'STC', job_class: 'STC', status: 'ACTIVE', submitted: '', isStc: true },
  { jobname: 'SMF',   jobid: 'STC00002', owner: 'TOMTZ', prty: 15, queue: 'STC', job_class: 'STC', status: 'ACTIVE', submitted: '', isStc: true },
  { jobname: 'TCPIP', jobid: 'STC00003', owner: 'TOMTZ', prty: 14, queue: 'STC', job_class: 'STC', status: 'ACTIVE', submitted: '', isStc: true },
  { jobname: 'VTAM',  jobid: 'STC00010', owner: 'TOMTZ', prty: 14, queue: 'STC', job_class: 'STC', status: 'ACTIVE', submitted: '', isStc: true },
  { jobname: 'RACF',  jobid: 'STC00011', owner: 'TOMTZ', prty: 15, queue: 'STC', job_class: 'STC', status: 'ACTIVE', submitted: '', isStc: true },
]

const STATUS_CLASSES: Record<string, string> = {
  CC0000: 'sdsf-status--cc0',
  CC0004: 'sdsf-status--cc4',
  CC0008: 'sdsf-status--cc8',
  ACTIVE: 'sdsf-status--run',
  INPUT:  '',
}

type View = 'ST' | 'LOG' | 'H' | 'DA'

export function SDSFPanel({ sessionId, onNavigate, onBack }: Props) {
  const [cmd, setCmd] = useState('')
  const [view, setView] = useState<View>('ST')
  const [logLines, setLogLines] = useState<string[]>([])
  const [dynamicJobs, setDynamicJobs] = useState<SpoolJobInfo[]>([])
  const [msg, setMsg] = useState('SDSF PRIMARY OPTION MENU')
  const [msgType, setMsgType] = useState<'ok'|'err'|'info'>('info')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [prefixFilter, setPrefixFilter] = useState('')
  const npRefs = useRef<(HTMLInputElement | null)[]>([])
  const npVals = useRef<Record<number, string>>({})

  // Load spool jobs
  useEffect(() => {
    listSpoolJobs()
      .then(jobs => setDynamicJobs(jobs))
      .catch(() => { /* spool empty on startup */ })
  }, [])

  const refreshJobs = () => {
    listSpoolJobs()
      .then(jobs => setDynamicJobs(jobs))
      .catch(() => {})
  }

  useEffect(() => {
    if (view === 'LOG') {
      client.get('/fs/cat', { params: { path: '/var/log/messages' } })
        .then((r) => setLogLines((r.data.data?.content ?? '').split('\n')))
        .catch(() => setLogLines(['ERROR READING SYSTEM LOG']))
    }
    if (view === 'ST' || view === 'H') refreshJobs()
  }, [view])

  const viewJob = async (jobid: string, jobname: string, isStc = false) => {
    if (isStc) {
      setMsg(`${jobname} IS AN ACTIVE STC — NO SPOOL OUTPUT AVAILABLE`)
      setMsgType('info')
      return
    }
    try {
      const detail = await getSpoolJob(jobid)
      onNavigate({
        id: 'view',
        params: {
          content: detail.output,
          label: `SDSF OUTPUT  ${jobname}(${jobid})`,
        }
      })
    } catch {
      setMsg(`SPOOL OUTPUT NOT FOUND FOR ${jobid}`)
      setMsgType('err')
    }
  }

  const viewJcl = async (jobid: string, jobname: string, isStc: boolean) => {
    if (isStc) {
      setMsg(`${jobname} IS AN ACTIVE STC — NO JCL AVAILABLE`)
      setMsgType('info')
      return
    }
    try {
      const detail = await getSpoolJob(jobid)
      const jcl = (detail as any).jcl || '(JCL NOT AVAILABLE)'
      onNavigate({
        id: 'view',
        params: {
          content: jcl,
          label: `SDSF JCL  ${jobname}(${jobid})`,
        }
      })
    } catch {
      setMsg(`SPOOL JCL NOT FOUND FOR ${jobid}`)
      setMsgType('err')
    }
  }

  const purgeJob = async (jobid: string, jobname: string, isStc: boolean, idx: number) => {
    if (isStc) {
      setMsg(`${jobname} IS AN ACTIVE STC — CANNOT PURGE`)
      setMsgType('err')
      npVals.current[idx] = ''
      if (npRefs.current[idx]) npRefs.current[idx]!.value = ''
      return
    }
    try {
      await deleteSpoolJob(jobid)
      setMsg(`${jobid} PURGED`)
      setMsgType('ok')
      refreshJobs()
    } catch {
      setMsg(`PURGE FAILED FOR ${jobid}`)
      setMsgType('err')
    }
    npVals.current[idx] = ''
    if (npRefs.current[idx]) npRefs.current[idx]!.value = ''
  }

  // Apply filters
  const filteredDynamic = dynamicJobs.filter(j => {
    if (ownerFilter && !j.owner.toUpperCase().startsWith(ownerFilter.toUpperCase())) return false
    if (prefixFilter && !j.jobname.toUpperCase().startsWith(prefixFilter.toUpperCase())) return false
    return true
  })

  const filteredStcs = STATIC_STCS.filter(j => {
    if (ownerFilter && !j.owner.toUpperCase().startsWith(ownerFilter.toUpperCase())) return false
    if (prefixFilter && !j.jobname.toUpperCase().startsWith(prefixFilter.toUpperCase())) return false
    return true
  })

  // For H panel: show only "held" output jobs (simulated: class X or H)
  const heldJobs: AllJob[] = filteredDynamic.filter(j => j.job_class === 'X' || j.job_class === 'H') as AllJob[]

  const allJobs: AllJob[] = view === 'H'
    ? heldJobs
    : [...filteredStcs, ...filteredDynamic]

  const handleNpKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    job: AllJob,
    idx: number
  ) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); npRefs.current[idx - 1]?.focus(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); npRefs.current[idx + 1]?.focus(); return }
    if (e.key === 'Enter') {
      const val = (npVals.current[idx] ?? '').trim().toUpperCase()
      if (val === 'P') {
        purgeJob(job.jobid, job.jobname, !!job.isStc, idx)
      } else if (val === 'J') {
        viewJcl(job.jobid, job.jobname, !!job.isStc)
        npVals.current[idx] = ''
        if (npRefs.current[idx]) npRefs.current[idx]!.value = ''
      } else if (val === 'S' || val === '') {
        viewJob(job.jobid, job.jobname, !!job.isStc)
        npVals.current[idx] = ''
        if (npRefs.current[idx]) npRefs.current[idx]!.value = ''
      } else if (val === 'C') {
        setMsg(`CANCEL NOT SUPPORTED FOR ${job.jobid} IN SIMULATOR`)
        setMsgType('info')
        npVals.current[idx] = ''
        if (npRefs.current[idx]) npRefs.current[idx]!.value = ''
      }
    }
  }

  const handleSubmit = (val: string) => {
    const v = val.trim().toUpperCase()
    if (!v) return
    if (v === 'ST') { setView('ST'); setMsg('STATUS DISPLAY'); setMsgType('ok'); return }
    if (v === 'LOG') { setView('LOG'); setMsg('SYSTEM LOG'); setMsgType('ok'); return }
    if (v === 'H') { setView('H'); setMsg('HELD OUTPUT QUEUE'); setMsgType('ok'); return }
    if (v === 'DA') { setView('DA'); setMsg('DISPLAY ACTIVE'); setMsgType('ok'); return }
    if (v === 'REFRESH' || v === 'REF') { refreshJobs(); setMsg('REFRESHED'); setMsgType('ok'); return }

    // OWNER filter
    if (v.startsWith('OWNER ') || v.startsWith('OWN ')) {
      const owner = val.trim().split(/\s+/).slice(1).join('').toUpperCase()
      setOwnerFilter(owner)
      setMsg(owner ? `OWNER FILTER: ${owner}` : 'OWNER FILTER CLEARED')
      setMsgType('ok'); return
    }
    if (v === 'OWNER' || v === 'OWN') {
      setOwnerFilter('')
      setMsg('OWNER FILTER CLEARED'); setMsgType('ok'); return
    }

    // PREFIX filter
    if (v.startsWith('PREFIX ') || v.startsWith('PRE ')) {
      const prefix = val.trim().split(/\s+/).slice(1).join('').toUpperCase()
      const effective = prefix === '*' ? '' : prefix
      setPrefixFilter(effective)
      setMsg(effective ? `PREFIX FILTER: ${effective}` : 'PREFIX FILTER CLEARED')
      setMsgType('ok'); return
    }
    if (v === 'PREFIX' || v === 'PRE') {
      setPrefixFilter('')
      setMsg('PREFIX FILTER CLEARED'); setMsgType('ok'); return
    }

    // FILTER command
    if (v.startsWith('FILTER ') || v.startsWith('FILT ')) {
      const jobpat = val.trim().split(/\s+/).slice(1).join('').toUpperCase().replace('*', '')
      setPrefixFilter(jobpat)
      setMsg(jobpat ? `JOB FILTER: ${jobpat}*` : 'FILTER CLEARED')
      setMsgType('ok'); return
    }

    // SORT (stub)
    if (v.startsWith('SORT ')) {
      setMsg('SORT APPLIED (DISPLAY ONLY IN SIMULATOR)'); setMsgType('info'); return
    }

    if (v.startsWith('?') || v === 'HELP') {
      setMsg('SDSF: ST=Status  H=Held  DA=Active  LOG=SysLog  REFRESH  OWNER id  PREFIX pat  FILTER pat  P/S/J=NP')
      setMsgType('info'); return
    }

    // Match job by name or ID
    const job = ([...filteredStcs, ...filteredDynamic] as AllJob[]).find((j) => j.jobname === v || j.jobid === v)
    if (job) {
      viewJob(job.jobid, job.jobname, !!job.isStc)
      return
    }
    setMsg(`INVALID COMMAND: ${v}`)
    setMsgType('err')
  }

  const viewTitle = view === 'ST'
    ? 'STATUS DISPLAY (ST)'
    : view === 'H'
    ? 'HELD OUTPUT (H)'
    : view === 'DA'
    ? 'DISPLAY ACTIVE (DA)'
    : 'SYSTEM LOG'

  const filterInfo = [
    ownerFilter ? `OWNER=${ownerFilter}` : '',
    prefixFilter ? `PREFIX=${prefixFilter}` : '',
  ].filter(Boolean).join('  ')

  const pfKeys = [
    { label: 'F1', action: 'Help' },
    { label: 'F2', action: 'Refresh', handler: () => { refreshJobs(); setMsg('REFRESHED'); setMsgType('ok') } },
    { label: 'F3', action: 'Exit', handler: onBack },
    { label: 'F4', action: 'ST',   handler: () => { setView('ST'); setMsg('STATUS DISPLAY'); setMsgType('ok') } },
    { label: 'F5', action: 'H',    handler: () => { setView('H'); setMsg('HELD OUTPUT'); setMsgType('ok') } },
    { label: 'F6', action: 'LOG',  handler: () => { setView('LOG'); setMsg('SYSTEM LOG'); setMsgType('ok') } },
    { label: 'F7', action: 'DA',   handler: () => { setView('DA'); setMsg('DISPLAY ACTIVE'); setMsgType('ok') } },
    { label: 'F8', action: 'Down' },
    { label: 'F12', action: 'Cancel', handler: onBack },
  ]

  return (
    <ISPFScreen
      panelTitle={`SDSF - ${viewTitle}${filterInfo ? `  [${filterInfo}]` : ''}`}
      rowInfo="MVS38J"
      shortMsg={msg}
      shortMsgType={msgType}
      commandValue={cmd}
      onCommandChange={setCmd}
      onCommandSubmit={handleSubmit}
      pfKeys={pfKeys}
      longMsg="NP: P=Purge S=View J=JCL C=Cancel. Commands: ST  H  LOG  OWNER id  PREFIX pat  FILTER pat  REFRESH"
    >
      {(view === 'ST' || view === 'H') && (
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

          {allJobs.map((job, idx) => {
            const maxrc = job.status === 'ACTIVE' ? 'STC' : job.status.replace('CC', '')
            return (
              <div
                key={job.jobid}
                className="sdsf-row"
                style={{ cursor: 'default' }}
              >
                <input
                  ref={el => { npRefs.current[idx] = el }}
                  className="sdsf-col-np sdsf-np-input"
                  maxLength={1}
                  defaultValue=""
                  placeholder="_"
                  onChange={e => { npVals.current[idx] = e.target.value }}
                  onKeyDown={e => handleNpKeyDown(e, job, idx)}
                  onDoubleClick={() => viewJob(job.jobid, job.jobname, !!job.isStc)}
                  spellCheck={false}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--z-cyan)',
                    fontFamily: 'inherit',
                    fontSize: 'inherit',
                    width: '4ch',
                    outline: 'none',
                    textAlign: 'center',
                    cursor: 'text',
                  }}
                />
                <span className="sdsf-col-jobname" onClick={() => setCmd(job.jobname)} style={{ cursor: 'pointer' }}>{job.jobname.padEnd(9)}</span>
                <span className="sdsf-col-jobid">{job.jobid.padEnd(9)}</span>
                <span className="sdsf-col-owner">{job.owner.padEnd(9)}</span>
                <span className="sdsf-col-prty">{String(job.prty).padStart(4)} </span>
                <span className="sdsf-col-queue">{job.queue.padEnd(7)}</span>
                <span className="sdsf-col-c">{job.job_class.padEnd(3)}</span>
                <span className="sdsf-col-maxrc">{maxrc.padEnd(6)}</span>
                <span className={`sdsf-col-status ${STATUS_CLASSES[job.status] ?? ''}`}>{job.status}</span>
              </div>
            )
          })}

          {view === 'ST' && filteredDynamic.length === 0 && (
            <div className="ispf-empty" style={{ color: 'var(--z-green)', marginTop: 4 }}>
              {' No submitted jobs in spool.  Submit a JCL member with S command.'}
            </div>
          )}

          {view === 'H' && heldJobs.length === 0 && (
            <div className="ispf-empty" style={{ color: 'var(--z-green)', marginTop: 4 }}>
              {' No held output.  Submit a JCL job with CLASS=X or CLASS=H to hold output.'}
            </div>
          )}
        </>
      )}

      {view === 'DA' && (
        <>
          <div className="sdsf-colheader">
            <span style={{ display: 'inline-block', width: '10ch' }}>Jobname  </span>
            <span style={{ display: 'inline-block', width: '10ch' }}>JobID    </span>
            <span style={{ display: 'inline-block', width: '10ch' }}>Type     </span>
            <span style={{ display: 'inline-block', width: '6ch' }}>Prty </span>
            <span style={{ display: 'inline-block', width: '10ch' }}>Status    </span>
            <span style={{ display: 'inline-block' }}>Description</span>
          </div>
          {STATIC_STCS.map(job => (
            <div key={job.jobid} className="sdsf-row" style={{ color: 'var(--z-green)' }}>
              <span style={{ display: 'inline-block', width: '10ch', color: 'var(--z-yellow)' }}>{job.jobname.padEnd(9)}</span>
              <span style={{ display: 'inline-block', width: '10ch' }}>{job.jobid.padEnd(9)}</span>
              <span style={{ display: 'inline-block', width: '10ch', color: 'var(--z-cyan)' }}>{'STC'.padEnd(9)}</span>
              <span style={{ display: 'inline-block', width: '6ch' }}>{String(job.prty).padStart(4)} </span>
              <span style={{ display: 'inline-block', width: '10ch', color: 'var(--z-green)' }}>{'**ACTIVE**'}</span>
              <span style={{ color: 'var(--z-cyan)' }}>{
                job.jobname === 'JES2'  ? 'Job Entry Subsystem 2' :
                job.jobname === 'SMF'   ? 'System Management Facilities' :
                job.jobname === 'TCPIP' ? 'TCP/IP Stack' :
                job.jobname === 'VTAM'  ? 'Virtual Telecomm Access Method' :
                job.jobname === 'RACF'  ? 'Resource Access Control Facility' :
                'Started Task'
              }</span>
            </div>
          ))}
          <div style={{ color: 'var(--z-cyan)', marginTop: 4, fontSize: 11 }}>
            {'─'.repeat(60)}<br />
            {'  DA panel shows active started tasks (STCs). Batch jobs complete instantly in simulator.'}
          </div>
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
