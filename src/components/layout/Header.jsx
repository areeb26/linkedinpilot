import { Bell, ChevronDown, Check } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'

const routeMeta = {
  '/dashboard': { section: null, page: 'Dashboard' },
  '/inbox': { section: null, page: 'Unibox' },
  '/linkedin-accounts': { section: 'Campaigns', page: 'LinkedIn Accounts' },
  '/campaigns': { section: 'Campaigns', page: 'Campaigns' },
  '/lead-extractor': { section: 'Campaigns', page: 'Lead Extractor' },
  '/leads': { section: 'Campaigns', page: 'Lead Database' },
  '/content': { section: 'Automations', page: 'Content Assistant' },
  '/inbound': { section: 'Automations', page: 'Inbound Automations' },
  '/settings': { section: 'General', page: 'Settings' },
}

function WorkspaceDropdown({ workspaceName, workspaces, onSelect }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const displayName = workspaceName ?? 'My Workspace'
  const list = workspaces?.length ? workspaces : [{ id: 'default', name: displayName }]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-all duration-200"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-[10px] font-bold text-primary-foreground shadow-sm">
          {displayName.slice(0, 1).toUpperCase()}
        </div>
        <span className="max-w-[140px] truncate font-medium">{displayName}</span>
        <ChevronDown size={14} className={cn('transition-transform duration-200', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border/60 bg-card/95 backdrop-blur-sm py-2 shadow-elevation-3 z-50 animate-scale-in">
          <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
            Workspaces
          </p>
          {list.map((ws) => (
            <button
              key={ws.id}
              onClick={() => { onSelect?.(ws); setOpen(false) }}
              className="flex w-full items-center justify-between px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
            >
              <span className="truncate font-medium">{ws.name}</span>
              {ws.name === displayName && <Check size={14} className="text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function UserAvatar({ user }) {
  const name = user?.user_metadata?.full_name ?? user?.email ?? 'U'
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')

  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-xs font-semibold text-primary-foreground cursor-pointer hover:shadow-lg hover:shadow-primary/25 transition-all duration-300 hover:scale-105 active:scale-95 ring-2 ring-transparent hover:ring-primary/20">
      {initials}
    </div>
  )
}

export function Header() {
  const { pathname } = useLocation()
  const meta = routeMeta[pathname] ?? { section: null, page: 'LinkedPilot' }

  const workspaceName = useWorkspaceStore((s) => s.workspaceName)
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const setWorkspace = useWorkspaceStore((s) => s.setWorkspace)
  const user = useAuthStore((s) => s.user)

  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border/60 bg-background/95 backdrop-blur-sm px-6 sticky top-0 z-30">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm animate-fade-in">
        {meta.section ? (
          <>
            <span className="text-muted-foreground/80 font-medium">{meta.section}</span>
            <span className="text-border">/</span>
            <span className="font-semibold text-foreground">{meta.page}</span>
          </>
        ) : (
          <>
            <span className="font-semibold text-foreground">{meta.page}</span>
            <span className="text-border">/</span>
            <span className="text-muted-foreground/80 font-medium">Overview</span>
          </>
        )}
      </nav>

      {/* Right side controls */}
      <div className="flex items-center gap-1">
        {/* Notification bell */}
        <button className="relative flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-secondary hover:text-foreground transition-all duration-200 hover:scale-105 active:scale-95">
          <Bell size={17} />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary animate-pulse-subtle ring-2 ring-background" />
        </button>

        {/* Workspace selector */}
        <WorkspaceDropdown
          workspaceName={workspaceName}
          workspaces={workspaces}
          onSelect={(ws) => setWorkspace(ws.id, ws.name)}
        />

        {/* User avatar */}
        <UserAvatar user={user} />
      </div>
    </header>
  )
}
