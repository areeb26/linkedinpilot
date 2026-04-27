import React from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { useChartData } from '@/hooks/useChartData'
import { useUiStore } from '@/store/uiStore'

// Skeleton bar for loading state
function SkeletonBar({ height = '100%' }) {
  return (
    <div
      className="w-full rounded-lg bg-muted/40 animate-pulse"
      style={{ height }}
    />
  )
}

const ActivityChart = () => {
  const { data: chartData = [], isLoading, error } = useChartData()
  const timeFilter = useUiStore((s) => s.timeFilter)

  // Determine x-axis label format based on time window
  const formatXAxis = (value) => {
    if (timeFilter <= 7) return value  // "Apr 25" already short
    // For longer windows, show only every Nth label to avoid crowding
    return value
  }

  const periodLabel =
    timeFilter === 1 ? 'today' :
    timeFilter === 7 ? 'the last 7 days' :
    timeFilter === 30 ? 'the last 30 days' :
    'the last 3 months'

  return (
    <div className="bg-[var(--color-surface-strong)] p-[var(--space-4)] rounded-xs border border-[var(--color-border)] shadow-elevation-1 animate-slide-up stagger-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-[var(--space-4)]">
        <div>
          <h3 className="text-[var(--color-text-on-strong)] text-lg font-semibold tracking-tight">Activity Overview</h3>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
            Your outreach performance over {periodLabel}
          </p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {[
            { label: 'Connections',   color: 'bg-[var(--color-surface-raised)]' },
            { label: 'Messages',      color: 'bg-[oklch(var(--warning))]' },
            { label: 'Profile Views', color: 'bg-[oklch(var(--info))]' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
              <span className="text-xs font-medium text-[var(--color-text-secondary)]">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ width: '100%', height: 280 }}>
        {isLoading ? (
          <div className="flex items-end gap-1 h-full px-2 pb-6">
            {Array.from({ length: Math.min(timeFilter, 14) }).map((_, i) => (
              <SkeletonBar key={i} height={`${30 + Math.random() * 60}%`} />
            ))}
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center text-sm text-[var(--color-text-secondary)]">
            Failed to load chart data
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <p>No activity data yet.</p>
            <p className="text-xs">Start a campaign to see your outreach performance here.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="var(--color-border)"
              />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
                dy={10}
                interval={timeFilter <= 7 ? 0 : timeFilter <= 30 ? 4 : 9}
                tickFormatter={formatXAxis}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-surface-strong)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '16px',
                  color: 'var(--color-text-on-strong)',
                  fontSize: '12px',
                }}
                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                formatter={(value, name) => {
                  const labels = {
                    connectionsSent: 'Connections',
                    messagesSent: 'Messages',
                    profileViews: 'Profile Views',
                  }
                  return [value, labels[name] ?? name]
                }}
              />
              <Area
                type="monotone"
                dataKey="connectionsSent"
                stroke="var(--color-surface-raised)"
                fill="var(--color-surface-raised)"
                fillOpacity={0.15}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="messagesSent"
                stroke="oklch(var(--warning))"
                fill="oklch(var(--warning))"
                fillOpacity={0.15}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="profileViews"
                stroke="oklch(var(--info))"
                fill="oklch(var(--info))"
                fillOpacity={0.15}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

export default ActivityChart
