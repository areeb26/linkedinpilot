import { Bell, ChevronDown, Check } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'

const routeMeta = {
  '/dashboard':        { section: null,          page: 'Dashboard' },
  '/inbox':            { section: null,          page: 'Unibox' },
  '/linkedin-accounts':{ section: 'Campaigns',   page: 'LinkedIn Accounts' },
  '/campaigns':        { section: 'Campaigns',   page: 'Campaigns' },
  '/prospect-extractor': { section: 'Campaigns',   page: 'Prospect Extractor' },
  '/leads':            { section: 'Campaigns',   page: 'Lead Database' },
  '/content':          { section: 'Automations', page: 'Content Assistant' },
  '/inbound':          { section: 'Automations', page: 'Inbound Automations' },
  '/settings':         { section: 'General',     page: 'Settings' },
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
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex items-center gap-[var(--space-1)]',
          'rounded-sm px-[var(--space-2)] py-[6px]',          // pill shape
          'text-sm text-[var(--color-text-secondary)]',
          'hover:bg-white/8 hover:text-[var(--color-text-primary)]',
          'transition-all duration-[150ms] ease-out-quart',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
        )}
      >
        <div
          className={cn(
            'flex h-6 w-6 items-center justify-center',
            'rounded-xs bg-[var(--color-surface-raised)]',
            'text-[10px] font-bold text-white',
          )}
          aria-hidden="true"
        >
          {displayName.slice(0, 1).toUpperCase()}
        </div>
        <span className="max-w-[140px] truncate font-medium">{displayName}</span>
        <ChevronDown
          size={14}
          className={cn('transition-transform duration-[150ms]', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Select workspace"
          className={cn(
            'absolute right-0 top-full mt-[var(--space-1)] w-56 z-50',
            'rounded-xs border border-[var(--color-border)]',
            'bg-[var(--color-surface-base)]/95 backdrop-blur-sm',
            'py-[var(--space-1)] shadow-elevation-3 animate-scale-in',
          )}
        >
          <p className="px-[var(--space-2)] py-[var(--space-1)] text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            Workspaces
          </p>
          {list.map((ws) => (
            <button
              key={ws.id}
              role="option"
              aria-selected={ws.name === displayName}
              onClick={() => { onSelect?.(ws); setOpen(false) }}
              className={cn(
                'flex w-full items-center justify-between',
                'px-[var(--space-2)] py-[10px]',
                'text-sm text-[var(--color-text-secondary)]',
                'hover:bg-white/6 hover:text-[var(--color-text-primary)]',
                'transition-colors duration-[150ms]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-inset',
              )}
            >
              <span className="truncate font-medium">{ws.name}</span>
              {ws.name === displayName && (
                <Check size={14} className="text-[var(--color-surface-raised)]" aria-hidden="true" />
              )}
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
    <div
      className={cn(
        'flex h-9 w-9 items-center justify-center',
        'rounded-xs bg-[var(--color-surface-raised)]',
        'text-xs font-semibold text-white',
        'cursor-pointer',
        'hover:brightness-110 transition-all duration-[150ms] ease-out-quart',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
      )}
      role="button"
      tabIndex={0}
      aria-label={`User menu for ${name}`}
    >
      {initials}
    </div>
  )
}

export function Header() {
  const { pathname } = useLocation()
  const meta = routeMeta[pathname] ?? { section: null, page: 'LinkedPilot' }

  const workspaceName = useWorkspaceStore((s) => s.workspaceName)
  const workspaces    = useWorkspaceStore((s) => s.workspaces)
  const setWorkspace  = useWorkspaceStore((s) => s.setWorkspace)
  const user          = useAuthStore((s) => s.user)

  return (
    <header
      className={cn(
        'flex h-14 flex-shrink-0 items-center justify-between',
        'border-b border-[var(--color-border)]',
        'bg-[var(--color-surface-base)]/95 backdrop-blur-sm',
        'px-[var(--space-4)] sticky top-0 z-30',
      )}
    >
      {/* Breadcrumb */}
      <nav className="flex items-center gap-[var(--space-1)] text-sm animate-fade-in" aria-label="Breadcrumb">
        {meta.section ? (
          <>
            <span className="text-[var(--color-text-secondary)] font-medium">{meta.section}</span>
            <span className="text-[var(--color-border)]" aria-hidden="true">/</span>
            <span className="font-semibold text-[var(--color-text-primary)]">{meta.page}</span>
          </>
        ) : (
          <>
            <span className="font-semibold text-[var(--color-text-primary)]">{meta.page}</span>
            <span className="text-[var(--color-border)]" aria-hidden="true">/</span>
            <span className="text-[var(--color-text-secondary)] font-medium">Overview</span>
          </>
        )}
      </nav>

      {/* Right controls */}
      <div className="flex items-center gap-[4px]">
        {/* Notification bell */}
        <button
          className={cn(
            'relative flex h-9 w-9 items-center justify-center',
            'rounded-xs',
            'text-[var(--color-text-secondary)]',
            'hover:bg-white/8 hover:text-[var(--color-text-primary)]',
            'transition-all duration-[150ms] ease-out-quart',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
          )}
          aria-label="Notifications"
        >
          <Bell size={17} aria-hidden="true" />
          {/* Unread indicator */}
          <span
            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--color-surface-raised)] animate-pulse-subtle ring-2 ring-[var(--color-surface-base)]"
            aria-label="Unread notifications"
          />
        </button>

        {/* Theme toggle */}
        <ThemeToggle />

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
