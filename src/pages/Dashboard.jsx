import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import ActivityChart from '../components/ActivityChart'
import StatCard from '../components/StatCard'
import { Target, Users, TrendingUp, Clock, Share2, Download } from 'lucide-react'
import { useDashboardStats } from '@/hooks/useDashboardStats'
import { useCampaigns } from '@/hooks/useCampaigns'
import { useLeads } from '@/hooks/useLeads'
import { useSentInvitations } from '@/hooks/useUnipileInvitations'
import { useLinkedInAccounts } from '@/hooks/useLinkedInAccounts'
import { useUiStore } from '@/store/uiStore'

const iconMap = {
  target: Target,
  users: Users,
  trending: TrendingUp,
  clock: Clock,
}

// Map timeFilter days → button label
const TIME_BUTTONS = [
  { label: '1d', days: 1 },
  { label: '1w', days: 7 },
  { label: '1m', days: 30 },
  { label: '3m', days: 90 },
]

export default function Dashboard() {
  const timeFilter = useUiStore((s) => s.timeFilter)
  const setTimeFilter = useUiStore((s) => s.setTimeFilter)

  // Real data sources
  const { data: stats, isLoading: statsLoading } = useDashboardStats()
  const { data: campaigns = [] } = useCampaigns()
  const { data: leadsData } = useLeads({ page: 1 })
  const { data: linkedInAccounts = [] } = useLinkedInAccounts()

  // Pending invites from Unipile (first connected account)
  const activeAccount = linkedInAccounts.find(a => a.unipile_account_id)
  const accountId = activeAccount?.unipile_account_id ?? null
  const { data: sentInvitations = [] } = useSentInvitations(accountId)

  // Derived values
  // Use displayStatus (set in useCampaigns) so campaigns that have processed all
  // leads are not counted as active even if the DB status is still 'active'
  const activeCampaigns = campaigns.filter(c => (c.displayStatus ?? c.status) === 'active').length
  const totalLeads = leadsData?.count ?? 0
  const pendingInvites = sentInvitations.length

  // Acceptance rate trend (compare to previous period — approximate as flat for now)
  const acceptanceTrend = stats?.acceptanceRate ?? 0
  const replyTrend = stats?.replyRate ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in pb-2">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">Dashboard</h1>
          <p className="text-[var(--color-text-secondary)] text-sm">Track your LinkedIn outreach performance and growth.</p>
        </div>
        <div className="flex items-center gap-[var(--space-2)]">
          {/* Time filter */}
          <div className="inline-flex items-center p-1 bg-[var(--color-surface-strong)] rounded-xs border border-[var(--color-border)]">
            {TIME_BUTTONS.map(({ label, days }) => (
              <button
                key={label}
                onClick={() => setTimeFilter(days)}
                className={cn(
                  'px-3.5 py-1.5 text-sm font-medium rounded-xs transition-all duration-[150ms]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
                  timeFilter === days
                    ? 'bg-[var(--color-surface-raised)] text-white shadow-sm'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-on-strong)] hover:bg-[var(--color-border)]'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Download size={14} />
            Export
          </Button>
          <Button size="sm" className="gap-2">
            <Share2 size={14} />
            Share
          </Button>
        </div>
      </div>

      {/* Primary Stats */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Key Metrics</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 animate-slide-up">
          <div className="stagger-1">
            <StatCard
              color="purple"
              value={statsLoading ? '—' : stats?.connectionsSent ?? 0}
              subtitle="Connections Sent"
              trend={0}
              isLoading={statsLoading}
            />
          </div>
          <div className="stagger-2">
            <StatCard
              color="emerald"
              value={statsLoading ? '—' : stats?.connectionsAccepted ?? 0}
              subtitle="Accepted"
              trend={acceptanceTrend}
              isLoading={statsLoading}
            />
          </div>
          <div className="stagger-3">
            <StatCard
              color="orange"
              value={statsLoading ? '—' : stats?.messagesSent ?? 0}
              subtitle="Messages"
              trend={0}
              isLoading={statsLoading}
            />
          </div>
          <div className="stagger-4">
            <StatCard
              color="pink"
              value={statsLoading ? '—' : stats?.repliesReceived ?? 0}
              subtitle="Replies"
              trend={replyTrend}
              isLoading={statsLoading}
            />
          </div>
          <div className="stagger-5">
            <StatCard
              color="cyan"
              value={statsLoading ? '—' : stats?.profileViews ?? 0}
              subtitle="Profile Views"
              trend={0}
              isLoading={statsLoading}
            />
          </div>
        </div>
      </section>

      {/* Activity Chart — real data from actions_log */}
      <section className="animate-slide-up stagger-2">
        <ActivityChart />
      </section>

      {/* Campaign Overview */}
      <section className="space-y-3 animate-slide-up stagger-3">
        <h2 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">Campaign Overview</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Active Campaigns',  value: activeCampaigns,                                                                icon: 'target',  change: `${campaigns.length} total` },
            { label: 'Total Leads',       value: totalLeads.toLocaleString(),                                                    icon: 'users',   change: 'In your database' },
            { label: 'Acceptance Rate',   value: statsLoading ? '—' : `${stats?.acceptanceRate ?? 0}%`,                         icon: 'trending', change: statsLoading ? '' : `${stats?.connectionsSent ?? 0} sent → ${stats?.connectionsAccepted ?? 0} accepted (total)` },
            { label: 'Pending Invites',   value: pendingInvites,                                                                 icon: 'clock',   change: 'Awaiting response' },
          ].map((stat) => {
            const IconComponent = iconMap[stat.icon]
            return (
              <Card key={stat.label} className="group overflow-hidden">
                <CardHeader className="pb-3 pt-5 px-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
                      {stat.label}
                    </CardTitle>
                    {IconComponent && (
                      <IconComponent
                        size={16}
                        className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-surface-raised)] transition-colors"
                      />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-5 px-5">
                  <p className="text-2xl font-bold text-[var(--color-text-on-strong)] group-hover:text-[var(--color-surface-raised)] transition-colors tabular-nums">
                    {stat.value}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1.5">{stat.change}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>
    </div>
  )
}
