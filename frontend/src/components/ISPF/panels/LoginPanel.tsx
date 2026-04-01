import React, { useState, useRef, useEffect } from 'react'

interface Props {
  onLogin: (userid: string, password: string) => Promise<boolean>
}

const BOOT_LINES = [
  'IEA000I SYSTEM INITIALIZATION STARTED - MVS 3.8J',
  'IEF403I JES2     - STARTED - TIME=09.00.01',
  'IEF403I SMF      - STARTED - TIME=09.00.02',
  'IEF403I TCPIP    - STARTED - TIME=09.00.03',
  'IEF403I VTAM     - STARTED - TIME=09.00.10',
  'IEF403I RACF     - STARTED - TIME=09.00.15',
  'IEF403I OMVS     - STARTED - TIME=09.00.20',
  'IKJ56500I ENTER USERID -',
]

export function LoginPanel({ onLogin }: Props) {
  const [userid, setUserid] = useState('HERC01')
  const [password, setPassword] = useState('')
  const [acctNmbr, setAcctNmbr] = useState('ACCT#')
  const [msg, setMsg] = useState('')
  const [bootDone, setBootDone] = useState(false)
  const [visibleLines, setVisibleLines] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Simulate boot sequence
  useEffect(() => {
    let i = 0
    const timer = setInterval(() => {
      i++
      setVisibleLines(i)
      if (i >= BOOT_LINES.length) {
        clearInterval(timer)
        setTimeout(() => {
          setBootDone(true)
          setTimeout(() => inputRef.current?.focus(), 50)
        }, 300)
      }
    }, 120)
    return () => clearInterval(timer)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userid.trim()) { setMsg('IKJ56700I ENTER VALID USERID'); return }
    const ok = await onLogin(userid.toUpperCase(), password)
    if (!ok) setMsg('ICH408I USER(' + userid.toUpperCase() + ') GROUP(SYS1) - RACF: INVALID PASSWORD')
  }

  const now = new Date()
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })

  return (
    <div className="login-screen">
      {/* Boot messages */}
      <div style={{
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 12,
        color: 'var(--z-green)',
        marginBottom: 8,
        paddingLeft: 4,
        minHeight: 112,
      }}>
        {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
          <div key={i} style={{
            color: line.startsWith('IEF403') ? 'var(--z-cyan)'
              : line.startsWith('IKJ') ? 'var(--z-yellow)'
              : 'var(--z-green)',
          }}>{line}</div>
        ))}
      </div>

      {bootDone && (
        <>
          <div style={{ marginBottom: 4, textAlign: 'center', color: 'var(--z-white)', fontSize: 11 }}>
            {'─'.repeat(77)}
          </div>
          <div className="login-box">
            <div className="login-title">TSO/E LOGON</div>
            <div className="login-subtitle">
              {`LOGON APPLID: ISPTSO     SYSTEM: MVS38J     ${dateStr}  ${timeStr}`}
            </div>
            <div style={{ color: 'var(--z-yellow)', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, marginBottom: 6 }}>
              {'Enter LOGON parameters below:'}
            </div>

            <form onSubmit={handleSubmit}>
              <div className="login-field">
                <span className="login-label"> Userid          {'===>'}{' '}</span>
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
                <span className="login-label"> Password        {'===>'}{' '}</span>
                <input
                  className="login-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="________"
                />
              </div>
              <div className="login-field">
                <span className="login-label"> Procedure name  {'===>'}{' '}</span>
                <span style={{ color: 'var(--z-green)' }}>TSOPROC</span>
              </div>
              <div className="login-field">
                <span className="login-label"> Group ident     {'===>'}{' '}</span>
                <span style={{ color: 'var(--z-green)' }}>SYS1</span>
              </div>
              <div className="login-field">
                <span className="login-label"> Acct nmbr       {'===>'}{' '}</span>
                <input
                  className="login-input"
                  value={acctNmbr}
                  onChange={(e) => setAcctNmbr(e.target.value.toUpperCase())}
                  maxLength={8}
                  autoComplete="off"
                />
              </div>
              <div className="login-enter">
                {msg
                  ? <span style={{ color: 'var(--z-red)' }}>{msg}</span>
                  : <span>{'PF1/PF13=Help  PF3/PF15=Logoff  PA1=Attention'}</span>
                }
              </div>
              {/* Tap button for mobile — hidden on desktop via CSS */}
              <button type="submit" className="login-mobile-btn">
                ENTER / LOGON
              </button>
              {/* Hidden submit for Enter key on desktop */}
              <button type="submit" style={{ display: 'none' }} />
            </form>
          </div>

          <div style={{ marginTop: 6, textAlign: 'center', color: 'var(--z-cyan)', fontSize: 11 }}>
            {'─'.repeat(77)}<br />
            {'ISPF/PDF — Press ENTER to logon or F3 to exit             IBM z/OS ISPF 7.1'}
          </div>
        </>
      )}
    </div>
  )
}
