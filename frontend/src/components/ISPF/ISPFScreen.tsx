import React, { useRef, useEffect, KeyboardEvent } from 'react'

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
  longMsg?: string
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

export function ISPFScreen({
  panelTitle,
  rowInfo,
  shortMsg,
  shortMsgType = 'info',
  longMsg,
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

  // Split PF keys into rows of 6
  const row1 = pfKeys.slice(0, 6)
  const row2 = pfKeys.slice(6, 12)

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const val = commandValue
      onCommandChange('')
      onCommandSubmit(val)
    }
    onKeyDown?.(e)
  }

  // Focus input on mount and after each render
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  })

  const msgClass = `ispf-short-msg ispf-short-msg--${shortMsgType}`

  return (
    <div className="ispf-screen" onClick={() => inputRef.current?.focus()}>
      {/* Action bar */}
      <div className="ispf-action-bar">
        {actionItems.map((item) => (
          <button key={item} className="ispf-action-item" onClick={() => onActionItem?.(item)}>
            {item}
          </button>
        ))}
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

      {/* Long message */}
      {longMsg !== undefined && (
        <div className="ispf-long-msg"> {longMsg}</div>
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

      {/* PF Keys */}
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
    </div>
  )
}
