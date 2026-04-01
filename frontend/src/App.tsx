import React, { useEffect } from 'react'
import { useSession } from './hooks/useSession'
import { useNavigation } from './hooks/useNavigation'

import { LoginPanel } from './components/ISPF/panels/LoginPanel'
import { PrimaryMenu } from './components/ISPF/panels/PrimaryMenu'
import { DatasetList } from './components/ISPF/panels/DatasetList'
import { MemberList } from './components/ISPF/panels/MemberList'
import { ContentViewer } from './components/ISPF/panels/ContentViewer'
import { CommandShell } from './components/ISPF/panels/CommandShell'
import { SDSFPanel } from './components/ISPF/panels/SDSFPanel'
import { USSBrowser } from './components/ISPF/panels/USSBrowser'
import { EditPanel } from './components/ISPF/panels/EditPanel'
import { SettingsPanel, loadSettings } from './components/ISPF/panels/SettingsPanel'
import { UtilitiesMenu } from './components/ISPF/panels/UtilitiesMenu'
import { ForegroundPanel } from './components/ISPF/panels/ForegroundPanel'
import { BatchPanel } from './components/ISPF/panels/BatchPanel'
import { AllocatePanel } from './components/ISPF/panels/AllocatePanel'
import { MoveCopyPanel } from './components/ISPF/panels/MoveCopyPanel'
import { SearchForPanel } from './components/ISPF/panels/SearchForPanel'
import { DB2Panel } from './components/ISPF/panels/DB2Panel'
import { CICSPanel } from './components/ISPF/panels/CICSPanel'

import './styles/global.css'
import './styles/ispf.css'

export default function App() {
  const { session, loading, createSession, updateCwd } = useSession()
  const nav = useNavigation({ id: 'login', params: {} })

  // Apply saved color theme on mount
  useEffect(() => { loadSettings() }, [])

  // PF3 global key handler → go back
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F3') { e.preventDefault(); nav.pop() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [nav])

  // Swipe-right gesture → go back (mobile)
  useEffect(() => {
    let touchStartX = 0
    const onTouchStart = (e: TouchEvent) => { touchStartX = e.touches[0].clientX }
    const onTouchEnd = (e: TouchEvent) => {
      const deltaX = e.changedTouches[0].clientX - touchStartX
      if (deltaX > 80 && touchStartX < 60) nav.pop()
    }
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [nav])

  if (loading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#000', color: '#00aa00', fontFamily: 'IBM Plex Mono, monospace',
        fontSize: 14,
      }}>
        Connecting to MVS38J...
      </div>
    )
  }

  const { current } = nav
  const sessionId = session?.sessionId ?? ''
  const cwd = session?.cwd ?? '/'
  const username = session?.username ?? 'HERC01'

  // Render the current panel
  switch (current.id) {

    case 'login':
      return (
        <LoginPanel
          onLogin={async (_userid, password) => {
            const ok = await createSession(password)
            if (ok) nav.replace({ id: 'primary', params: {} })
            return ok
          }}
        />
      )

    case 'primary':
      return (
        <PrimaryMenu
          username={username}
          onNavigate={(panel) => nav.push(panel)}
          onLogout={() => nav.reset({ id: 'login', params: {} })}
        />
      )

    case 'dslist':
      return (
        <DatasetList
          initialFilter={current.params.filter}
          onNavigate={(panel) => nav.push(panel)}
          onBack={() => nav.pop()}
        />
      )

    case 'members':
      return (
        <MemberList
          dsn={current.params.dsn!}
          username={username}
          onNavigate={(panel) => nav.push(panel)}
          onBack={() => nav.pop()}
        />
      )

    case 'edit':
      return (
        <EditPanel
          ussPath={current.params.ussPath}
          dsn={current.params.dsn}
          member={current.params.member}
          sessionId={sessionId}
          onBack={() => nav.pop()}
        />
      )

    case 'view':
      return (
        <ContentViewer
          dsn={current.params.dsn}
          member={current.params.member}
          ussPath={current.params.ussPath}
          label={current.params.label}
          content={current.params.content}
          onBack={() => nav.pop()}
        />
      )

    case 'command':
      return (
        <CommandShell
          sessionId={sessionId}
          cwd={cwd}
          username={username}
          updateCwd={updateCwd}
          onBack={() => nav.pop()}
        />
      )

    case 'sdsf':
      return (
        <SDSFPanel
          sessionId={sessionId}
          onNavigate={(panel) => nav.push(panel)}
          onBack={() => nav.pop()}
        />
      )

    case 'settings':
      return (
        <SettingsPanel onBack={() => nav.pop()} username={username} />
      )

    case 'uss':
      return (
        <USSBrowser
          path={current.params.ussPath ?? `/u/${username.toLowerCase()}`}
          title={current.params.title ?? 'VIEW'}
          sessionId={sessionId}
          onNavigate={(panel, cwdHint) => {
            if (cwdHint) nav.replace({ id: 'uss', params: { ...current.params, ussPath: cwdHint } })
            nav.push(panel)
          }}
          onBack={() => nav.pop()}
        />
      )

    case 'utilities':
      return (
        <UtilitiesMenu
          onNavigate={(panel) => nav.push(panel)}
          onBack={() => nav.pop()}
        />
      )

    case 'foreground':
      return (
        <ForegroundPanel
          onBack={() => nav.pop()}
        />
      )

    case 'batch':
      return (
        <BatchPanel
          username={username}
          onBack={() => nav.pop()}
        />
      )

    case 'allocate':
      return (
        <AllocatePanel
          onBack={() => nav.pop()}
        />
      )

    case 'movecopy':
      return (
        <MoveCopyPanel
          sourceDsn={current.params.sourceDsn}
          sourceMember={current.params.sourceMember}
          onBack={() => nav.pop()}
        />
      )

    case 'searchfor':
      return (
        <SearchForPanel
          initialDsn={current.params.searchDsn ?? ''}
          onBack={() => nav.pop()}
        />
      )

    case 'db2':
      return (
        <DB2Panel
          onBack={() => nav.pop()}
        />
      )

    case 'cics':
      return (
        <CICSPanel
          onBack={() => nav.pop()}
        />
      )

    default:
      return (
        <PrimaryMenu
          username={username}
          onNavigate={(panel) => nav.push(panel)}
          onLogout={() => nav.reset({ id: 'login', params: {} })}
        />
      )
  }
}
