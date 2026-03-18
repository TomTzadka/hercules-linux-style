import React, { useEffect, useRef } from 'react'
import { TerminalLine } from './TerminalLine'
import type { TermLine } from '../../hooks/useTerminal'

interface Props {
  lines: TermLine[]
}

export function TerminalOutput({ lines }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  return (
    <div className="term-output">
      {lines.map((line) => (
        <TerminalLine key={line.id} line={line} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
