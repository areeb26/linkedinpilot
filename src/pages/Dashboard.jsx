import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import ActivityChart from '../components/ActivityChart';
import StatCard from '../components/StatCard';
import { Target, Users, TrendingUp, Clock, Share2, Download } from 'lucide-react';

const iconMap = {
  target: Target,
  users: Users,
  trending: TrendingUp,
  clock: Clock,
};

export default function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Header with improved hierarchy and spacing */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in pb-2">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Track your LinkedIn outreach performance and growth.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center p-1 bg-card/50 rounded-xl border border-border/60">
            {['1d', '1w', '1m', '3m'].map((label, idx) => (
              <button
                key={idx}
                className={cn(
                  "px-3.5 py-1.5 text-sm font-medium rounded-lg transition-all duration-200",
                  idx === 1
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
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

      {/* Primary Stats Grid - improved spacing and rhythm */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Key Metrics</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 animate-slide-up">
          {[ 
            { label: "Connections Sent", value: 134, color: "purple", trend: 12 },
            { label: "Accepted", value: 87, color: "emerald", trend: 8 },
            { label: "Messages", value: 367, color: "orange", trend: 24 },
            { label: "Replies", value: 54, color: "pink", trend: -3 },
            { label: "Opportunities", value: "$12k", color: "cyan", trend: 18 },
          ].map((stat, i) => (
            <div key={stat.label} className={`stagger-${i + 1}`}>
              <StatCard
                color={stat.color}
                value={stat.value}
                subtitle={stat.label}
                trend={stat.trend}
                isLoading={false}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Activity Chart - improved card styling */}
      <section className="animate-slide-up stagger-2">
        <ActivityChart />
      </section>

      {/* Secondary Stats - refined layout */}
      <section className="space-y-3 animate-slide-up stagger-3">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Campaign Overview</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Active Campaigns', value: '12', icon: 'target', change: '+2 this week' },
            { label: 'Total Leads', value: '1,234', icon: 'users', change: '+156 this month' },
            { label: 'Growth Rate', value: '+14%', icon: 'trending', change: '+3% vs last month' },
            { label: 'Pending Actions', value: '3', icon: 'clock', change: 'Requires attention' },
          ].map((stat) => {
            const IconComponent = iconMap[stat.icon];
            return (
              <Card key={stat.label} className="group overflow-hidden">
                <CardHeader className="pb-3 pt-5 px-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{stat.label}</CardTitle>
                    {IconComponent && <IconComponent size={16} className="text-muted-foreground/50 group-hover:text-primary/60 transition-colors" />}
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-5 px-5">
                  <p className="text-2xl font-bold text-foreground group-hover:text-primary transition-colors tabular-nums">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1.5">{stat.change}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  )
}
