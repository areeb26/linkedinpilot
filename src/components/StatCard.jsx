import { TrendingUp, TrendingDown } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * StatCard — dashboard metric tile
 *
 * Tokens:
 *   surface.strong (#f8f8f8) → card bg (via Card)
 *   surface.raised (#04644a) → positive trend accent
 *   text.secondary (#666666) → label
 *   radius.xs (16px)         → card corners
 *   space.3 (16px)           → internal padding
 *   motion.instant (150ms)   → hover transition
 *
 * States: default · loading (skeleton) · hover (lift)
 */

const accentMap = {
  green:   'bg-[var(--color-surface-raised)]',
  purple:  'bg-[oklch(var(--info))]',
  yellow:  'bg-[oklch(var(--warning))]',
  orange:  'bg-[oklch(var(--warning))]',
  pink:    'bg-[oklch(var(--accent))]',
  cyan:    'bg-[oklch(var(--info))]',
  emerald: 'bg-[oklch(var(--success))]',
}

const StatCard = ({
  label,
  value,
  subtitle,
  color = 'green',
  trend = 0,
  isLoading = false,
}) => {
  const accentClass = accentMap[color] ?? accentMap.green
  const isPositive = trend >= 0

  if (isLoading) {
    return (
      <Card className="overflow-hidden animate-pulse-subtle">
        {/* Top accent bar */}
        <div className={cn('h-[3px] w-full', accentClass)} aria-hidden="true" />
        <CardContent className="p-[var(--space-3)]">
          <div className="h-3 w-24 rounded-sm bg-[var(--color-border)] mb-[var(--space-2)]" />
          <div className="h-7 w-20 rounded-sm bg-[var(--color-border)]/60" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className={cn(
        'overflow-hidden cursor-default group',
        'hover:-translate-y-[2px] hover:shadow-elevation-2',
        'transition-all duration-[150ms] ease-out-quart',
      )}
    >
      {/* Top accent bar */}
      <div className={cn('h-[3px] w-full', accentClass)} aria-hidden="true" />

      <CardContent className="p-[var(--space-3)]">
        <div className="flex items-start justify-between gap-[var(--space-2)]">
          <div className="flex-1 min-w-0">
            {/* Label */}
            <p
              className={cn(
                'text-xs font-semibold uppercase tracking-wider',
                'text-[var(--color-text-secondary)]',
                'group-hover:text-[var(--color-text-on-strong)]',
                'transition-colors duration-[150ms]',
              )}
            >
              {label ?? subtitle}
            </p>

            {/* Value */}
            <p
              className={cn(
                'mt-[var(--space-1)] text-2xl font-bold tabular-nums tracking-tight',
                'text-[var(--color-text-on-strong)]',
              )}
            >
              {value}
            </p>
          </div>

          {/* Trend badge */}
          <div
            className={cn(
              'flex items-center gap-1 px-[var(--space-1)] py-[2px]',
              'rounded-sm text-xs font-semibold shrink-0',
              'transition-all duration-[150ms]',
              isPositive
                ? 'bg-[oklch(var(--success)/0.15)] text-[oklch(var(--success))]'
                : 'bg-[oklch(var(--destructive)/0.15)] text-[oklch(var(--destructive))]',
            )}
            aria-label={`Trend: ${isPositive ? '+' : ''}${trend}%`}
          >
            {isPositive
              ? <TrendingUp  size={12} aria-hidden="true" />
              : <TrendingDown size={12} aria-hidden="true" />
            }
            <span>{isPositive ? '+' : ''}{trend}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default StatCard
