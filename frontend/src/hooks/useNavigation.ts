import { useState, useCallback } from 'react'

export type PanelId =
  | 'login'
  | 'primary'
  | 'dslist'
  | 'members'
  | 'view'
  | 'edit'
  | 'settings'
  | 'command'
  | 'sdsf'
  | 'uss'
  | 'utilities'    // Option 3 sub-menu
  | 'foreground'   // Option 4
  | 'batch'        // Option 5
  | 'allocate'     // Utility 3.2
  | 'movecopy'     // Utility 3.3
  | 'searchfor'    // Utility 3.13

export interface PanelParams {
  filter?: string
  dsn?: string
  member?: string
  ussPath?: string
  content?: string
  title?: string
  label?: string       // display label for browse header
  sourceDsn?: string   // for movecopy panel
  sourceMember?: string
  targetDsn?: string
  mode?: string        // 'COPY' | 'MOVE'
  searchDsn?: string   // for searchfor panel
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
