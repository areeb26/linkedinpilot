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
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/inbox', icon: Inbox, label: 'Unibox' },
    ],
  },
  {
    label: 'CAMPAIGNS',
    items: [
      { to: '/linkedin-accounts', icon: Users, label: 'LinkedIn Accounts' },
      { to: '/campaigns', icon: Send, label: 'Campaigns' },
      { to: '/lead-extractor', icon: Search, label: 'Lead Extractor' },
      { to: '/leads', icon: Database, label: 'Lead Database' },
    ],
  },
  {
    label: 'AUTOMATIONS',
    items: [
      { to: '/content', icon: Sparkles, label: 'Content Assistant' },
      { to: '/inbound', icon: Zap, label: 'Inbound Automations' },
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
        'relative flex h-screen flex-col bg-card border-r border-border transition-all duration-300 ease-out-quart',
        collapsed ? 'w-[60px]' : 'w-[240px]'
      )}
    >
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-[52px] z-10 flex h-6 w-6 items-center justify-center rounded-full bg-secondary border border-border text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-110"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Logo */}
      <div className="flex h-14 items-center border-b border-border px-4">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-primary">
            <span className="text-xs font-bold text-primary-foreground">LP</span>
          </div>
          {!collapsed && (
            <span className="font-display text-[15px] font-bold tracking-tight text-foreground">
              linkedpilot
            </span>
          )}
        </div>
      </div>

      {/* Create Campaign button */}
      <div className={cn('px-3 pt-4 pb-2', collapsed && 'px-2')}>
        {collapsed ? (
          <button
            onClick={() => navigate('/campaigns')}
            className="flex h-9 w-full items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200"
            aria-label="Create campaign"
          >
            <Plus size={16} />
          </button>
        ) : (
          <button
            onClick={() => navigate('/campaigns')}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all duration-200"
          >
            <Plus size={16} />
            Create campaign
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-smooth py-4 px-2 space-y-1">
        {navGroups.map((group, gi) => (
          <div key={gi} className={gi > 0 ? 'pt-2' : ''}>
            {group.label && !collapsed && (
              <p className="mb-2 px-3 text-[10px] font-semibold tracking-widest text-muted-foreground/70 uppercase">
                {group.label}
              </p>
            )}
            {group.label && collapsed && (
              <div className="mx-auto mb-2 h-px w-6 bg-border" />
            )}
            <ul className="space-y-1">
              {group.items.map(({ to, icon: Icon, label }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    title={collapsed ? label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center rounded-xl transition-all duration-250 ease-out-quart relative overflow-hidden',
                        collapsed ? 'h-10 w-full justify-center px-0' : 'gap-3 px-3 py-2.5',
                        isActive
                          ? 'bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20'
                          : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && !collapsed && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-foreground rounded-r-full" />
                        )}
                        <Icon size={17} className={cn('flex-shrink-0 transition-transform duration-200', !isActive && 'group-hover:scale-110')} />
                        {!collapsed && <span className="text-sm font-medium">{label}</span>}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* User profile card */}
      <div className="border-t border-border/60 p-3">
        {collapsed ? (
          <div className="flex justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-xs font-semibold text-primary-foreground flex-shrink-0">
              {initials}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-secondary/80 transition-all duration-200 cursor-pointer group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-xs font-semibold text-primary-foreground flex-shrink-0 group-hover:bg-primary/90 transition-all duration-200">
              {initials}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-semibold text-foreground leading-tight">
                {workspace}
              </p>
              <p className="text-[11px] text-muted-foreground font-medium">Free plan</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
