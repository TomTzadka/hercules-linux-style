import React, { useRef, useEffect, useState, KeyboardEvent } from 'react'

export interface PFKey {
  label: string    // e.g. "F1"
  action: string   // e.g. "Help"
  handler?: () => void
}

interface Props {
  panelTitle: string
  rowInfo?: string
  shortMsg?: string
  shortMsgType?: 'ok' | 'err' | 'info'
  longMsg?: string | false
  longMsgHighlight?: boolean   // show longMsg as attention popup
  commandLabel?: string   // default "Command"
  commandValue: string
  onCommandChange: (v: string) => void
  onCommandSubmit: (v: string) => void
  scrollValue?: string    // e.g. "CSR" — omit to hide
  pfKeys: PFKey[]
  children: React.ReactNode
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
  // Action bar items (default set provided)
  actionItems?: string[]
  onActionItem?: (item: string) => void
}

const DEFAULT_ACTIONS = ['Menu', 'Utilities', 'Compilers', 'Options', 'Status', 'Help']

// Keys shown in mobile bottom bar (always F3=Back + scroll + cancel)
const MOBILE_KEY_LABELS = ['F3', 'F7', 'F8', 'F12']

export function ISPFScreen({
  panelTitle,
  rowInfo,
  shortMsg,
  shortMsgType = 'info',
  longMsg,
  longMsgHighlight = false,
  commandLabel = 'Command',
  commandValue,
  onCommandChange,
  onCommandSubmit,
  scrollValue,
  pfKeys,
  children,
  onKeyDown,
  actionItems = DEFAULT_ACTIONS,
  onActionItem,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Split PF keys into rows of 6
  const row1 = pfKeys.slice(0, 6)
  const row2 = pfKeys.slice(6, 12)

  // Keys for the mobile bottom bar
  const mobileKeys = MOBILE_KEY_LABELS
    .map(label => pfKeys.find(k => k.label === label))
    .filter((k): k is PFKey => k !== undefined)

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const val = commandValue
      onCommandChange('')
      onCommandSubmit(val)
    }
    onKeyDown?.(e)
  }

  // Focus command input on mount only (not on every re-render, to avoid stealing focus from edit inputs)
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [])

  const msgClass = `ispf-short-msg ispf-short-msg--${shortMsgType}`

  return (
    <div className="ispf-screen" onClick={() => inputRef.current?.focus()}>
      {/* Hamburger drawer overlay */}
      <div
        className={`ispf-drawer-overlay${drawerOpen ? ' ispf-drawer-overlay--open' : ''}`}
        onClick={() => setDrawerOpen(false)}
      >
        <div className="ispf-drawer" onClick={e => e.stopPropagation()}>
          <div className="ispf-drawer-title">z/OS ISPF — Menu</div>
          {actionItems.map((item) => (
            <button
              key={item}
              className="ispf-drawer-item"
              onClick={() => { setDrawerOpen(false); onActionItem?.(item) }}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Action bar */}
      <div className="ispf-action-bar">
        {/* Hamburger — only visible on mobile via CSS */}
        <button
          className="ispf-hamburger"
          onClick={(e) => { e.stopPropagation(); setDrawerOpen(true) }}
          aria-label="Menu"
        >
          ≡
        </button>
        {actionItems.map((item) => (
          <button key={item} className="ispf-action-item" onClick={() => onActionItem?.(item)}>
            {item}
          </button>
        ))}
        {/* Panel title shown in action bar on mobile (hidden on desktop via CSS) */}
        <span className="ispf-mobile-title" style={{
          color: 'var(--z-action-fg)', fontSize: 13, fontFamily: 'var(--font)',
          flex: 1, textAlign: 'center', pointerEvents: 'none',
        }}>
          {panelTitle}
        </span>
      </div>

      {/* Title row */}
      <div className="ispf-title-row">
        <span className="ispf-panel-title"> {panelTitle}</span>
        <span className="ispf-title-right">
          {shortMsg && <span className={msgClass}> {shortMsg}</span>}
          {rowInfo && <span>  {rowInfo}</span>}
        </span>
      </div>

      {/* Command line */}
      <div className="ispf-cmd-row">
        <span className="ispf-cmd-label"> {commandLabel}{'===>'}{' '}</span>
        <input
          ref={inputRef}
          className="ispf-cmd-input"
          type="text"
          value={commandValue}
          onChange={(e) => onCommandChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
        {scrollValue !== undefined && (
          <>
            <span className="ispf-scroll-label"> Scroll{'===>'}{' '}</span>
            <span className="ispf-scroll-value">{scrollValue}</span>
          </>
        )}
      </div>

      {/* Short msg shown below command on mobile (title-right is hidden) */}
      {shortMsg && (
        <div className="ispf-mobile-short-msg" style={{
          display: 'none', padding: '0 8px', fontSize: 11,
        }}>
          <span className={msgClass}>{shortMsg}</span>
        </div>
      )}

      {/* Long message */}
      {longMsg && (
        longMsgHighlight
          ? <div className="ispf-long-msg ispf-long-msg--highlight" style={{
              background: 'rgba(170,0,0,0.2)',
              border: '1px solid var(--z-red)',
              color: 'var(--z-yellow)',
              padding: '2px 4px',
              margin: '2px 0',
            }}>{' *** '}{longMsg}{' ***'}</div>
          : <div className="ispf-long-msg"> {longMsg}</div>
      )}

      {/* Top separator */}
      <div className="ispf-sep-line">
        {'─'.repeat(120)}
      </div>

      {/* Body */}
      <div className="ispf-body">
        {children}
      </div>

      {/* Bottom separator */}
      <div className="ispf-sep-line">
        {'─'.repeat(120)}
      </div>

      {/* PF Keys — desktop */}
      <div className="ispf-pfkeys">
        {row1.length > 0 && (
          <div className="ispf-pfkey-row">
            {row1.map((k) => (
              <span key={k.label} className="ispf-pfkey" onClick={k.handler}>
                <span className="ispf-pfkey-label">{k.label}</span>
                <span className="ispf-pfkey-eq">=</span>
                <span className="ispf-pfkey-val">{k.action}{'  '}</span>
              </span>
            ))}
          </div>
        )}
        {row2.length > 0 && (
          <div className="ispf-pfkey-row">
            {row2.map((k) => (
              <span key={k.label} className="ispf-pfkey" onClick={k.handler}>
                <span className="ispf-pfkey-label">{k.label}</span>
                <span className="ispf-pfkey-eq">=</span>
                <span className="ispf-pfkey-val">{k.action}{'  '}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Mobile bottom bar — 4 touch-friendly PF keys */}
      <div className="ispf-mobile-bar">
        {mobileKeys.map((k) => (
          <button
            key={k.label}
            className="ispf-mobile-key"
            onClick={(e) => { e.stopPropagation(); k.handler?.() }}
          >
            <span className="ispf-mobile-key-label">{k.label}</span>
            <span className="ispf-mobile-key-action">{k.action}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
