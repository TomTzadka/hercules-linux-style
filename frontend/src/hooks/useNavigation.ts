import { useState, useCallback } from 'react'

export type PanelId =
  | 'login'
  | 'primary'
  | 'dslist'
  | 'members'
  | 'view'
  | 'edit'
  | 'command'
  | 'sdsf'
  | 'uss'

export interface PanelParams {
  filter?: string
  dsn?: string
  member?: string
  ussPath?: string
  content?: string
  title?: string
  label?: string    // display label for browse header
}

export interface PanelEntry {
  id: PanelId
  params: PanelParams
}

export function useNavigation(initial: PanelEntry = { id: 'login', params: {} }) {
  const [stack, setStack] = useState<PanelEntry[]>([initial])

  const current = stack[stack.length - 1]

  const push = useCallback((panel: PanelEntry) => {
    setStack((prev) => [...prev, panel])
  }, [])

  const pop = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
  }, [])

  const replace = useCallback((panel: PanelEntry) => {
    setStack((prev) => [...prev.slice(0, -1), panel])
  }, [])

  const reset = useCallback((panel: PanelEntry) => {
    setStack([panel])
  }, [])

  return { current, stack, push, pop, replace, reset }
}
