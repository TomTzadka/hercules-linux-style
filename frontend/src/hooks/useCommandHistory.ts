import { useState, useCallback } from 'react'

const MAX_HISTORY = 100

export function useCommandHistory() {
  const [history, setHistory] = useState<string[]>([])
  const [index, setIndex] = useState<number>(-1)

  const push = useCallback((cmd: string) => {
    if (!cmd.trim()) return
    setHistory((prev) => {
      const next = [cmd, ...prev.filter((c) => c !== cmd)].slice(0, MAX_HISTORY)
      return next
    })
    setIndex(-1)
  }, [])

  const navigateUp = useCallback((current: string): string => {
    setIndex((prev) => {
      const next = Math.min(prev + 1, history.length - 1)
      return next
    })
    const next = Math.min(index + 1, history.length - 1)
    return history[next] ?? current
  }, [history, index])

  const navigateDown = useCallback((current: string): string => {
    const next = Math.max(index - 1, -1)
    setIndex(next)
    return next === -1 ? '' : history[next] ?? current
  }, [history, index])

  const reset = useCallback(() => setIndex(-1), [])

  return { push, navigateUp, navigateDown, reset, history }
}
