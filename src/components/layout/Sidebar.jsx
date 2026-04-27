import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Inbox,
  Users,
  Send,
  Search,
  Database,
  Sparkles,
  Zap,
  Settings,
  Plus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useAuthStore } from '@/store/authStore'

const navGroups = [
  {
    label: null,
    items: [
      { to: '/dashboard',        icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/inbox',            icon: Inbox,           label: 'Unibox' },
    ],
  },
  {
    label: 'CAMPAIGNS',
    items: [
      { to: '/linkedin-accounts', icon: Users,    label: 'LinkedIn Accounts' },
      { to: '/campaigns',         icon: Send,     label: 'Campaigns' },
      { to: '/prospect-extractor', icon: Search,   label: 'Prospect Extractor' },
      { to: '/leads',             icon: Database, label: 'Lead Database' },
    ],
  },
  {
    label: 'AUTOMATIONS',
    items: [
      { to: '/content', icon: Sparkles, label: 'Content Assistant' },
      { to: '/inbound', icon: Zap,      label: 'Inbound Automations' },
    ],
  },
  {
    label: 'GENERAL',
    items: [
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
]

function UserInitials({ name }) {
  if (!name) return '?'
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

export function Sidebar({ collapsed, onToggle }) {
  const navigate = useNavigate()
  const workspaceName = useWorkspaceStore((s) => s.workspaceName)
  const user = useAuthStore((s) => s.user)

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'User'
  const initials = <UserInitials name={displayName} />
  const workspace = workspaceName ?? 'My Workspace'

  return (
    <aside
      className={cn(
        'relative flex h-screen flex-col',
        'bg-[var(--color-surface-base)]',
        'border-r border-[var(--color-border)]',
        'transition-all duration-[300ms] ease-out-quart',
        collapsed ? 'w-[60px]' : 'w-[240px]'
      )}
    >
      {/* Collapse toggle — keyboard accessible */}
      <button
        onClick={onToggle}
        className={cn(
          'absolute -right-3 top-[52px] z-10',
          'flex h-6 w-6 items-center justify-center',
          'rounded-full',
          'bg-[var(--color-surface-strong)] border border-[var(--color-border)]',
          'text-[var(--color-text-secondary)]',
          'hover:text-[var(--color-text-primary)] hover:scale-110',
          'transition-all duration-[150ms] ease-out-quart',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
        )}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Logo */}
      <div className="flex h-14 items-center border-b border-[var(--color-border)] px-[var(--space-3)]">
        <div className="flex items-center gap-[var(--space-2)] overflow-hidden">
          <div
            className={cn(
              'flex h-8 w-8 flex-shrink-0 items-center justify-center',
              'rounded-xs',                                    // radius.xs = 16px
              'bg-[var(--color-surface-raised)]',
            )}
          >
            <span className="text-xs font-bold text-white">LP</span>
          </div>
          {!collapsed && (
            <span className="text-[15px] font-bold tracking-tight text-[var(--color-text-primary)]">
              linkedpilot
            </span>
          )}
        </div>
      </div>

      {/* Create Campaign CTA */}
      <div className={cn('px-[var(--space-2)] pt-[var(--space-3)] pb-[var(--space-1)]', collapsed && 'px-[var(--space-1)]')}>
        {collapsed ? (
          <button
            onClick={() => navigate('/campaigns')}
            className={cn(
              'flex h-9 w-full items-center justify-center',
              'rounded-xs bg-[var(--color-surface-raised)] text-white',
              'hover:brightness-110 transition-all duration-[150ms] ease-out-quart',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
            )}
            aria-label="Create campaign"
          >
            <Plus size={16} />
          </button>
        ) : (
          <button
            onClick={() => navigate('/campaigns')}
            className={cn(
              'flex w-full items-center justify-center gap-2',
              'rounded-sm',                                    // pill — radius.sm
              'bg-[var(--color-surface-raised)] text-white',
              'px-[var(--space-3)] py-[var(--space-1)]',
              'text-sm font-semibold',
              'hover:brightness-110 active:scale-[0.97]',
              'transition-all duration-[150ms] ease-out-quart',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
            )}
          >
            <Plus size={16} />
            Create campaign
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-smooth py-[var(--space-3)] px-[var(--space-1)] space-y-[var(--space-1)]"
        aria-label="Main navigation"
      >
        {navGroups.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'pt-[var(--space-2)]' : ''}>
            {group.label && !collapsed && (
              <p className="mb-[var(--space-1)] px-[var(--space-2)] text-[10px] font-semibold tracking-widest text-[var(--color-text-secondary)] uppercase select-none">
                {group.label}
              </p>
            )}
            {group.label && collapsed && (
              <div className="mx-auto mb-[var(--space-1)] h-px w-6 bg-[var(--color-border)]" />
            )}
            <ul className="space-y-[2px]" role="list">
              {group.items.map(({ to, icon: Icon, label }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    title={collapsed ? label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center rounded-xs',
                        'transition-all duration-[150ms] ease-out-quart',
                        'relative overflow-hidden',
                        // Focus-visible — always visible
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-inset',
                        collapsed
                          ? 'h-10 w-full justify-center px-0'
                          : 'gap-[var(--space-2)] px-[var(--space-2)] py-[10px]',
                        isActive
                          ? 'bg-[var(--color-surface-raised)] text-white font-semibold'
                          : 'text-[var(--color-text-secondary)] hover:bg-white/6 hover:text-[var(--color-text-primary)]'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {/* Active indicator bar */}
                        {isActive && !collapsed && (
                          <span
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-white rounded-r-full"
                            aria-hidden="true"
                          />
                        )}
                        <Icon size={17} className="flex-shrink-0" aria-hidden="true" />
                        {!collapsed && (
                          <span className="text-sm font-medium">{label}</span>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* User profile */}
      <div className="border-t border-[var(--color-border)] p-[var(--space-2)]">
        {collapsed ? (
          <div className="flex justify-center">
            <div
              className={cn(
                'flex h-9 w-9 items-center justify-center',
                'rounded-xs bg-[var(--color-surface-raised)]',
                'text-xs font-semibold text-white flex-shrink-0',
              )}
              aria-label={`User: ${displayName}`}
            >
              {initials}
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'flex items-center gap-[var(--space-2)]',
              'rounded-xs px-[var(--space-2)] py-[10px]',
              'hover:bg-white/6 transition-all duration-[150ms] ease-out-quart cursor-pointer',
            )}
          >
            <div
              className={cn(
                'flex h-9 w-9 items-center justify-center flex-shrink-0',
                'rounded-xs bg-[var(--color-surface-raised)]',
                'text-xs font-semibold text-white',
              )}
              aria-hidden="true"
            >
              {initials}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-semibold text-[var(--color-text-primary)] leading-tight">
                {workspace}
              </p>
              <p className="text-[11px] text-[var(--color-text-secondary)] font-medium">Free plan</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
