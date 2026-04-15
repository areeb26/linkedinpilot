import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const colorVariants = {
  purple: 'from-primary/90 via-primary/50 to-primary/20',
  yellow: 'from-warning/90 via-warning/50 to-warning/20',
  orange: 'from-orange-500/90 via-orange-500/50 to-orange-500/20',
  pink: 'from-pink-500/90 via-pink-500/50 to-pink-500/20',
  cyan: 'from-info/90 via-info/50 to-info/20',
  emerald: 'from-success/90 via-success/50 to-success/20',
};

const glowVariants = {
  purple: 'group-hover:shadow-primary/25',
  yellow: 'group-hover:shadow-warning/25',
  orange: 'group-hover:shadow-orange-500/25',
  pink: 'group-hover:shadow-pink-500/25',
  cyan: 'group-hover:shadow-info/25',
  emerald: 'group-hover:shadow-success/25',
};

const StatCard = ({ label, value, subtitle, color = 'purple', trend = 12, isLoading = false }) => {
  const gradientClass = colorVariants[color] || colorVariants.purple;
  const glowClass = glowVariants[color] || glowVariants.purple;
  const isPositive = trend >= 0;

  if (isLoading) {
    return (
      <Card className="bg-card border-border overflow-hidden animate-pulse-subtle">
        <div className={cn('h-1 w-full bg-gradient-to-r', gradientClass)} />
        <CardContent className="p-5">
          <div className="h-3 w-24 bg-muted rounded mb-3" />
          <div className="h-8 w-20 bg-muted/50 rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      'overflow-hidden transition-all duration-300 ease-out-quart',
      'hover:-translate-y-1.5 hover:shadow-xl',
      glowClass,
      'group cursor-default border-border/60'
    )}>
      <div className={cn('h-1.5 w-full bg-gradient-to-r transition-all duration-300 group-hover:h-2', gradientClass)} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">
              {label || subtitle}
            </p>
            <p className="mt-2.5 text-3xl font-bold text-foreground tabular-nums tracking-tight group-hover:text-gradient bg-gradient-to-r from-foreground to-foreground bg-clip-text">
              {value}
            </p>
          </div>
          <div className={cn(
            'flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0',
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
