import React, { useState, useEffect, useRef } from 'react'
import { ISPFScreen } from '../ISPFScreen'
import { lsDir } from '../../../api/filesystem'
import type { FSNode } from '../../../api/filesystem'
import type { PanelEntry } from '../../../hooks/useNavigation'

interface Props {
  path: string
  title?: string        // 'VIEW' or 'EDIT' for label
  sessionId: string
  onNavigate: (panel: PanelEntry) => void
  onBack: () => void
}

function fmt(date: string) {
  try { return new Date(date).toLocaleDateString('en-CA') }
  catch { return date.slice(0, 10) }
}

function fmtSize(n: number) {
  if (n < 1024) return String(n)
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + 'K'
  return (n / 1024 / 1024).toFixed(1) + 'M'
}

export function USSBrowser({ path, title = 'VIEW', sessionId, onNavigate, onBack }: Props) {
  const [nodes, setNodes] = useState<FSNode[]>([])
  const [cwd, setCwd] = useState(path)
  const [cmd, setCmd] = useState('')
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'ok'|'err'|'info'>('ok')
  const [loading, setLoading] = useState(true)
  const cmdsRef = useRef<Record<string, string>>({})

  const load = async (p: string) => {
    setLoading(true)
    try {
      const data = await lsDir(p, sessionId)
      const sorted = [...data].sort((a, b) => {
        if (a.node_type !== b.node_type) return a.node_type === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      setNodes(sorted)
      setCwd(p)
      setMsg(`${data.length} ENTRIES`)
      setMsgType('ok')
    } catch {
      setMsg('PATH NOT FOUND')
      setMsgType('err')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(path) }, [path])

  const open = (node: FSNode) => {
    const fullPath = cwd.replace(/\/$/, '') + '/' + node.name
    if (node.node_type === 'directory') {
      load(fullPath)
    } else {
      onNavigate({ id: 'view', params: { ussPath: fullPath, label: fullPath } })
    }
  }

  const handleRowEnter = (e: React.KeyboardEvent<HTMLInputElement>, node: FSNode, idx: number) => {
    if (e.key === 'Enter') {
      const c = (cmdsRef.current[String(idx)] || '').trim().toLowerCase()
      if (c === '' || c === 'b' || c === 'e' || c === 'v') { open(node); return }
      if (c === 's') { open(node); return }
      setMsg(`UNKNOWN COMMAND: ${c.toUpperCase()}`)
      setMsgType('err')
    }
  }

  const goUp = () => {
    const parent = cwd.includes('/') ? cwd.replace(/\/[^/]+$/, '') || '/' : '/'
    if (parent !== cwd) load(parent)
  }

  const handleSubmit = (val: string) => {
    const v = val.trim()
    if (!v) return
    const vUp = v.toUpperCase()
    if (vUp === 'UP' || vUp === '..') { goUp(); return }
    if (v.startsWith('/')) { load(v); return }
    const target = cwd.replace(/\/$/, '') + '/' + v
    load(target)
  }

  const parentPath = cwd.replace(/\/[^/]+$/, '') || '/'

  const pfKeys = [
    { label: 'F1', action: 'Help' },
    { label: 'F2', action: 'Refresh', handler: () => load(cwd) },
    { label: 'F3', action: 'Exit', handler: onBack },
    { label: 'F5', action: 'Rfind' },
    { label: 'F7', action: 'Up' },
    { label: 'F8', action: 'Down' },
    { label: 'F9', action: 'Swap' },
    { label: 'F12', action: 'Cancel', handler: onBack },
  ]

  return (
    <ISPFScreen
      panelTitle={`${title} - z/OS UNIX System Services`}
      rowInfo={`Row 1 of ${nodes.length}`}
      shortMsg={msg || undefined}
      shortMsgType={msgType}
      commandValue={cmd}
      onCommandChange={setCmd}
      onCommandSubmit={handleSubmit}
      scrollValue="CSR"
      pfKeys={pfKeys}
      longMsg="Enter B=Browse, V=View, E=Edit beside name. Type path in Command to navigate. F3=Exit."
    >
      {/* Path row */}
      <div className="uss-path-row">
        {' Directory ==> '}<span style={{ color: 'var(--z-yellow)' }}>{cwd}</span>
        {cwd !== '/' && (
          <span
            style={{ color: 'var(--z-cyan)', marginLeft: 16, cursor: 'pointer', fontSize: 11 }}
            onClick={goUp}
          >
            [..] Go Up ({parentPath})
          </span>
        )}
      </div>

      {/* Column header */}
      <div className="uss-colheader">
        <span style={{ width: '4ch' }}>    </span>
        <span className="uss-col-name">Name                        </span>
        <span className="uss-col-perm">Permissions </span>
        <span className="uss-col-owner">Owner     </span>
        <span className="uss-col-size">    Size</span>
        <span className="uss-col-mod">  Modified    </span>
      </div>

      {loading && <div className="ispf-loading"> Loading directory...</div>}

      {!loading && nodes.length === 0 && (
        <div className="ispf-empty"> Directory is empty.</div>
      )}

      {!loading && nodes.map((node, idx) => {
        const isDir = node.node_type === 'directory'
        const nameClass = isDir ? 'uss-col-name--dir' : 'uss-col-name--file'
        const nameSuffix = isDir ? '/' : ''
        return (
          <div
            key={node.name}
            className="uss-row-wrap"
            onDoubleClick={() => open(node)}
          >
            <span style={{ width: '1ch' }}> </span>
            <input
              className="uss-line-cmd"
              maxLength={1}
              defaultValue=""
              onChange={(e) => { cmdsRef.current[String(idx)] = e.target.value }}
              onKeyDown={(e) => handleRowEnter(e, node, idx)}
              spellCheck={false}
            />
            <span style={{ width: '1ch' }}> </span>
            <span className={`uss-col-name ${nameClass}`}>
              {node.name}{nameSuffix}
            </span>
            <span className="uss-col-perm">{node.permissions} </span>
            <span className="uss-col-owner">{node.owner}     </span>
            <span className="uss-col-size">{fmtSize(node.size).padStart(6)} </span>
            <span className="uss-col-mod">  {fmt(node.modified)}</span>
          </div>
        )
      })}
    </ISPFScreen>
  )
}
