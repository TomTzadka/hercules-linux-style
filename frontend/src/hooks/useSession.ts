import { useState } from 'react'
import client, { setSessionId } from '../api/client'

export interface Session {
  sessionId: string
  cwd: string
  username: string
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(false)

  const createSession = async (password: string = ''): Promise<boolean> => {
    setLoading(true)
    try {
      const res = await client.post('/session/new', { password })
      if (!res.data.ok) {
        setLoading(false)
        return false
      }
      const { session_id, cwd, username } = res.data.data
      setSessionId(session_id)
      setSession({ sessionId: session_id, cwd, username })
      setLoading(false)
      return true
    } catch {
      setLoading(false)
      return false
    }
  }

  const updateCwd = (newCwd: string) => {
    setSession((prev) => prev ? { ...prev, cwd: newCwd } : prev)
  }

  return { session, loading, createSession, updateCwd }
}
