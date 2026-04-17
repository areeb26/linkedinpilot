import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const colorVariants = {
  purple: 'bg-primary',
  yellow: 'bg-warning',
  orange: 'bg-warning/80',
  pink: 'bg-accent',
  cyan: 'bg-info',
  emerald: 'bg-success',
};

const StatCard = ({ label, value, subtitle, color = 'purple', trend = 12, isLoading = false }) => {
  const accentClass = colorVariants[color] || colorVariants.purple;
  const isPositive = trend >= 0;

  if (isLoading) {
    return (
      <Card className="bg-card border-border overflow-hidden animate-pulse-subtle">
        <div className={cn('h-0.5 w-full', accentClass)} />
        <CardContent className="p-4">
          <div className="h-3 w-24 bg-muted rounded mb-2" />
          <div className="h-7 w-20 bg-muted/50 rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      'overflow-hidden transition-all duration-200 ease-out-quart',
      'group cursor-default border-border/60'
    )}>
      <div className={cn('h-0.5 w-full', accentClass)} />
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">
              {label || subtitle}
            </p>
            <p className="font-display mt-1.5 text-2xl font-bold text-foreground tabular-nums tracking-tight">
              {value}
            </p>
          </div>
          <div className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold shrink-0',
            'transition-all duration-200',
            isPositive
              ? 'bg-success/15 text-success group-hover:bg-success/20'
              : 'bg-destructive/15 text-destructive group-hover:bg-destructive/20'
          )}>
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>{isPositive ? '+' : ''}{trend}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StatCard;
