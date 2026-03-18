import React, { useState, useRef, useEffect } from 'react'

interface Props {
  onLogin: (userid: string) => void
}

export function LoginPanel({ onLogin }: Props) {
  const [userid, setUserid] = useState('HERC01')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!userid.trim()) { setMsg('ENTER VALID USERID'); return }
    onLogin(userid.toUpperCase())
  }

  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })

  return (
    <div className="login-screen">
      {/* IBM system header */}
      <div style={{ marginBottom: 8, textAlign: 'center', color: 'var(--z-white)', fontSize: 11 }}>
        ─────────────────────────────────────────────────────────────────────────────
      </div>
      <div className="login-box">
        <div className="login-title">
          TSO/E LOGON
        </div>
        <div className="login-subtitle">
          Enter LOGON parameters below:
        </div>

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <span className="login-label"> Userid         {'===>'}{' '}</span>
            <input
              ref={inputRef}
              className="login-input"
              value={userid}
              onChange={(e) => setUserid(e.target.value.toUpperCase())}
              maxLength={8}
              autoComplete="off"
            />
          </div>
          <div className="login-field">
            <span className="login-label"> Password       {'===>'}{' '}</span>
            <input
              className="login-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="________"
            />
          </div>
          <div className="login-field">
            <span className="login-label"> Procedure name {'===>'}{' '}</span>
            <span style={{ color: 'var(--z-green)' }}>TSOPROC</span>
          </div>
          <div className="login-field">
            <span className="login-label"> Group ident    {'===>'}{' '}</span>
            <span style={{ color: 'var(--z-green)' }}>SYS1</span>
          </div>
          <div className="login-field">
            <span className="login-label"> New password   {'===>'}{' '}</span>
            <span style={{ color: 'var(--z-green)', opacity: 0.3 }}>________</span>
          </div>
          <div className="login-enter">
            {msg
              ? <span style={{ color: 'var(--z-red)' }}>{msg}</span>
              : <span>Press ENTER to log on, or PF3 to exit.</span>
            }
          </div>
          <button type="submit" style={{ display: 'none' }} />
        </form>

        <div className="login-sys-info">
          <div className="login-sys-row">
            <span className="login-sys-key"> System         :</span>
            <span className="login-sys-val"> MVS38J</span>
          </div>
          <div className="login-sys-row">
            <span className="login-sys-key"> ISPF version   :</span>
            <span className="login-sys-val"> 7.1</span>
          </div>
          <div className="login-sys-row">
            <span className="login-sys-key"> Date           :</span>
            <span className="login-sys-val"> {dateStr}</span>
          </div>
          <div className="login-sys-row">
            <span className="login-sys-key"> Time           :</span>
            <span className="login-sys-val"> {timeStr}</span>
          </div>
          <div className="login-sys-row">
            <span className="login-sys-key"> OS             :</span>
            <span className="login-sys-val"> MVS 3.8J / z/OS USS (Hercules)</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 8, textAlign: 'center', color: 'var(--z-cyan)', fontSize: 11 }}>
        ─────────────────────────────────────────────────────────────────────────────<br />
        ISPF/PDF — Press ENTER to logon or F3 to exit
      </div>
    </div>
  )
}
