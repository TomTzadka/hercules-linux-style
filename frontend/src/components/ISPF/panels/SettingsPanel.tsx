import React, { useState } from 'react'
import { ISPFScreen } from '../ISPFScreen'
import { writeMember } from '../../../api/datasets'

interface Props {
  onBack: () => void
  username?: string
}

interface Settings {
  numberMode: 'ON' | 'OFF'
  pfKeyDisplay: 'LONG' | 'SHORT'
  scroll: 'PAGE' | 'HALF' | 'CSR' | 'MAX'
  tabSize: '2' | '4' | '8'
  colorTheme: 'GREEN' | 'WHITE' | 'BLUE'
  cmdAtBottom: 'NO' | 'YES'
}

const STORAGE_KEY = 'hercules_settings'
const DEFAULTS: Settings = {
  numberMode: 'ON',
  pfKeyDisplay: 'LONG',
  scroll: 'PAGE',
  tabSize: '2',
  colorTheme: 'GREEN',
  cmdAtBottom: 'NO',
}

// Color palettes for each theme
const COLOR_THEMES: Record<string, Record<string, string>> = {
  GREEN: {
    '--z-green':  '#00aa00',
    '--z-cyan':   '#00aaaa',
    '--z-yellow': '#aaaa00',
    '--z-red':    '#aa0000',
    '--z-white':  '#aaaaaa',
  },
  WHITE: {
    '--z-green':  '#cccccc',
    '--z-cyan':   '#aaddff',
    '--z-yellow': '#ffff88',
    '--z-red':    '#ff6666',
    '--z-white':  '#ffffff',
  },
  BLUE: {
    '--z-green':  '#5599ff',
    '--z-cyan':   '#00ccff',
    '--z-yellow': '#ffdd44',
    '--z-red':    '#ff4444',
    '--z-white':  '#aaaacc',
  },
}

export function applyColorTheme(theme: string): void {
  const vars = COLOR_THEMES[theme] ?? COLOR_THEMES.GREEN
  const root = document.documentElement
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const s = { ...DEFAULTS, ...JSON.parse(raw) }
      applyColorTheme(s.colorTheme)
      return s
    }
  } catch { /* ignore */ }
  return { ...DEFAULTS }
}

function saveSettings(s: Settings): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* ignore */ }
}

async function saveToISPFProfile(s: Settings, userid: string): Promise<void> {
  const dsn = `${userid.toUpperCase()}.ISPF.ISPPROF`
  const content = [
    `*  ${dsn}(ISRPARM) - ISPF Edit Profile Parameters         *`,
    `NUMBER   = ${s.numberMode}`,
    `CAPS     = OFF`,
    `NULLS    = OFF`,
    `TABS     = ${s.tabSize}`,
    `AUTOLIST = OFF`,
    `AUTOSAVE = OFF`,
    `RECOVERY = OFF`,
    `STATS    = ON`,
    `PFKEYS   = ${s.pfKeyDisplay}`,
    `SCROLL   = ${s.scroll}`,
    `COLOR    = ${s.colorTheme}`,
    `CMDPOS   = ${s.cmdAtBottom === 'YES' ? 'BOTTOM' : 'TOP'}`,
  ].join('\n')
  await writeMember(dsn, 'ISRPARM', content).catch(() => {/* dataset may not exist yet */})
}

export function SettingsPanel({ onBack, username = 'HERC01' }: Props) {
  const [saved, setSaved] = useState<Settings>(loadSettings)
  const [draft, setDraft] = useState<Settings>(loadSettings)
  const [cmd, setCmd] = useState('')
  const [msg, setMsg] = useState('ENTER A FIELD VALUE AND PRESS ENTER')
  const [msgType, setMsgType] = useState<'ok' | 'err' | 'info'>('info')

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }))
  }

  const handleSubmit = (val: string) => {
    const v = val.trim().toUpperCase()
    if (!v) return

    if (v === 'SAVE') {
      saveSettings(draft)
      setSaved(draft)
      applyColorTheme(draft.colorTheme)
      saveToISPFProfile(draft, username).catch(() => {})
      setMsg('SETTINGS SAVED — PROFILE UPDATED IN ' + username.toUpperCase() + '.ISPF.ISPPROF')
      setMsgType('ok')
      onBack()
      return
    }
    if (v === 'CANCEL' || v === 'END') {
      setDraft(saved)
      onBack()
      return
    }
    // Allow typing values directly
    if (['ON', 'OFF'].includes(v)) { set('numberMode', v as 'ON' | 'OFF'); setMsg('Number mode updated — type SAVE to apply'); setMsgType('info'); return }
    if (['LONG', 'SHORT'].includes(v)) { set('pfKeyDisplay', v as 'LONG' | 'SHORT'); setMsg('PF key display updated — type SAVE to apply'); setMsgType('info'); return }
    if (['PAGE', 'HALF', 'CSR', 'MAX'].includes(v)) { set('scroll', v as Settings['scroll']); setMsg('Scroll updated — type SAVE to apply'); setMsgType('info'); return }
    if (['2', '4', '8'].includes(v)) { set('tabSize', v as '2' | '4' | '8'); setMsg('Tab size updated — type SAVE to apply'); setMsgType('info'); return }
    if (['GREEN', 'WHITE', 'BLUE'].includes(v)) {
      setDraft(prev => ({ ...prev, colorTheme: v as Settings['colorTheme'] }))
      applyColorTheme(v)  // preview immediately
      setMsg(`Color theme: ${v} — type SAVE to apply`); setMsgType('info'); return
    }
    if (v === 'BOTTOM' || v === 'TOP') {
      setDraft(prev => ({ ...prev, cmdAtBottom: v === 'BOTTOM' ? 'YES' : 'NO' }))
      setMsg(`Command line: ${v} — type SAVE to apply`); setMsgType('info'); return
    }

    setMsg(`UNKNOWN VALUE: ${v}`)
    setMsgType('err')
  }

  const row = (label: string, value: string, options: string[]) => (
    <div style={{ display: 'flex', gap: '2ch', marginBottom: '0.3em' }}>
      <span style={{ color: 'var(--z-cyan)', width: '28ch', flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--z-yellow)', width: '8ch' }}>{value}</span>
      <span style={{ color: 'var(--z-green)', fontSize: 11 }}>({options.join(' / ')})</span>
    </div>
  )

  const pfKeys = [
    { label: 'F1', action: 'Help' },
    { label: 'F3', action: 'Cancel', handler: () => { setDraft(saved); onBack() } },
    { label: 'F12', action: 'Cancel', handler: () => { setDraft(saved); onBack() } },
  ]

  return (
    <ISPFScreen
      panelTitle="ISPF Settings — Option 0"
      rowInfo="MVS38J"
      shortMsg={msg}
      shortMsgType={msgType}
      commandValue={cmd}
      onCommandChange={setCmd}
      onCommandSubmit={handleSubmit}
      pfKeys={pfKeys}
      longMsg="Type a value in Command and press Enter, or click a field. Type SAVE to apply. CANCEL to discard."
    >
      <div style={{ padding: '1em 2ch', color: 'var(--z-white)' }}>

        <div style={{ color: 'var(--z-yellow)', marginBottom: '1em' }}>
          {'─'.repeat(50)}<br/>
          {'  ISPF User Settings — Hercules Mainframe Sim'}<br/>
          {'─'.repeat(50)}
        </div>

        <div style={{ marginBottom: '1.5em' }}>
          <div style={{ color: 'var(--z-cyan)', marginBottom: '0.5em' }}>  Terminal / Editor</div>
          {row('  Number mode . . . . . . :', draft.numberMode, ['ON', 'OFF'])}
          {row('  PF key display  . . . . :', draft.pfKeyDisplay, ['LONG', 'SHORT'])}
          {row('  Default scroll  . . . . :', draft.scroll, ['PAGE', 'HALF', 'CSR', 'MAX'])}
          {row('  Tab size  . . . . . . . :', draft.tabSize, ['2', '4', '8'])}
        </div>

        <div style={{ marginBottom: '1.5em' }}>
          <div style={{ color: 'var(--z-cyan)', marginBottom: '0.5em' }}>  Display</div>
          {row('  Color theme . . . . . . :', draft.colorTheme, ['GREEN', 'WHITE', 'BLUE'])}
          {row('  Command line position  . :', draft.cmdAtBottom === 'YES' ? 'BOTTOM' : 'TOP', ['TOP', 'BOTTOM'])}
        </div>

        <div style={{ marginBottom: '1.5em' }}>
          <div style={{ color: 'var(--z-cyan)', marginBottom: '0.5em' }}>  System Information (read-only)</div>
          {row('  Terminal type . . . . . :', 'IBM 3278', [])}
          {row('  Screen format . . . . . :', 'DATA', [])}
          {row('  Language . . . . . . . :', 'ENGLISH', [])}
          {row('  System ID  . . . . . . :', 'MVS38J', [])}
        </div>

        <div style={{ color: 'var(--z-green)', marginTop: '1em', fontSize: 11 }}>
          {'─'.repeat(50)}<br/>
          {'  Type SAVE to apply changes   CANCEL to discard'}
        </div>
      </div>
    </ISPFScreen>
  )
}
