import { useState, useCallback, useRef, useEffect } from 'react'
import { execCommand } from '../api/terminal'
import { useCommandHistory } from './useCommandHistory'

export type LineType = 'stdout' | 'stderr' | 'system' | 'prompt'

export interface TermLine {
  id: number
  type: LineType
  text: string
}

let lineCounter = 0

function mkLine(type: LineType, text: string): TermLine {
  return { id: lineCounter++, type, text }
}

const BANNER = [
  '╔══════════════════════════════════════════════════════════════════════════╗',
  '║          MVS 3.8J - HERCULES MAINFRAME SIMULATOR                        ║',
  '║          z/OS UNIX System Services (USS)                                 ║',
  '║          Inspired by jaymoseley.com & IBM z/OS documentation             ║',
  '╚══════════════════════════════════════════════════════════════════════════╝',
  '',
  'Type "help" for available commands.',
  'Type "ds list" to browse MVS datasets.',
  '',
]

export function useTerminal(sessionId: string, initialCwd: string, updateCwd: (c: string) => void) {
  const [lines, setLines] = useState<TermLine[]>(() =>
    BANNER.map((t) => mkLine('system', t))
  )
  const [isLoading, setIsLoading] = useState(false)
  const history = useCommandHistory()

  const cwd = useRef(initialCwd)

  useEffect(() => {
    cwd.current = initialCwd
  }, [initialCwd])

  const appendLines = useCallback((newLines: TermLine[]) => {
    setLines((prev) => [...prev, ...newLines])
  }, [])

  const executeCommand = useCallback(async (raw: string) => {
    history.push(raw)

    // Show the prompt + command typed
    const promptLine = mkLine('prompt', `${cwd.current} $ ${raw}`)
    appendLines([promptLine])

    if (raw.trim() === '') return

    setIsLoading(true)
    try {
      const result = await execCommand(raw, sessionId)

      if (result.output === '__CLEAR__') {
        setLines([])
        setIsLoading(false)
        return
      }

      const type: LineType = result.exit_code !== 0 ? 'stderr' : 'stdout'
      const outputLines = result.output
        .split('\n')
        .map((t) => mkLine(type, t))

      // Remove trailing empty line if output ends with \n
      if (outputLines.length > 0 && outputLines[outputLines.length - 1].text === '') {
        outputLines.pop()
      }

      if (outputLines.length > 0) {
        appendLines(outputLines)
      }

      if (result.new_cwd !== cwd.current) {
        cwd.current = result.new_cwd
        updateCwd(result.new_cwd)
      }
    } catch (e) {
      appendLines([mkLine('stderr', 'Terminal error: could not reach backend')])
    } finally {
      setIsLoading(false)
    }
  }, [sessionId, appendLines, history, updateCwd])

  return {
    lines,
    isLoading,
    executeCommand,
    navigateUp: history.navigateUp,
    navigateDown: history.navigateDown,
    resetHistory: history.reset,
  }
}
