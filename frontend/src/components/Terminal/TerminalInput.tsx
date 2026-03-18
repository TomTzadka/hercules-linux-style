import React, { useState, useRef, useEffect } from 'react'

interface Props {
  cwd: string
  username: string
  isLoading: boolean
  onSubmit: (cmd: string) => void
  onArrowUp: (current: string) => string
  onArrowDown: (current: string) => string
}

export function TerminalInput({ cwd, username, isLoading, onSubmit, onArrowUp, onArrowDown }: Props) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!isLoading) inputRef.current?.focus()
  }, [isLoading])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = value
      setValue('')
      onSubmit(cmd)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setValue(onArrowUp(value))
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setValue(onArrowDown(value))
    }
  }

  return (
    <div className="term-input-row" onClick={() => inputRef.current?.focus()}>
      <span className="term-prompt-label">
        {username}@MVS38J:{cwd} ${' '}
      </span>
      {isLoading ? (
        <span className="term-loading">PLEASE WAIT...</span>
      ) : (
        <input
          ref={inputRef}
          className="term-input"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          autoComplete="off"
          spellCheck={false}
        />
      )}
      {!isLoading && <span className="term-cursor" />}
    </div>
  )
}
