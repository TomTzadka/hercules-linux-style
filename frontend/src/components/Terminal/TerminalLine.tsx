import React from 'react'
import type { TermLine } from '../../hooks/useTerminal'

interface Props {
  line: TermLine
}

export function TerminalLine({ line }: Props) {
  return (
    <div className={`term-line term-line--${line.type}`}>
      {line.text || '\u00A0'}
    </div>
  )
}
