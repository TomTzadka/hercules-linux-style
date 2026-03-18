import { useState, useEffect } from 'react'
import client from '../api/client'

export interface Session {
  sessionId: string
  cwd: string
  username: string
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    client.post('/session/new').then((res) => {
      const { session_id, cwd, username } = res.data.data
      setSession({ sessionId: session_id, cwd, username })
      setLoading(false)
    })
  }, [])

  const updateCwd = (newCwd: string) => {
    setSession((prev) => prev ? { ...prev, cwd: newCwd } : prev)
  }

  return { session, loading, updateCwd }
}
