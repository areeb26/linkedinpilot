import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Skeleton — loading placeholder component
 *
 * Used to indicate content is loading with an animated shimmer effect.
 * Tokens:
 *   surface.raised → skeleton background
 *   motion.instant (150ms) → animation duration
 *
 * Usage:
 *   <Skeleton className="h-4 w-[250px]" />
 *   <Skeleton className="h-12 w-12 rounded-full" />
 */
const Skeleton = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'animate-pulse rounded-md bg-[var(--color-surface-raised)]',
      className
    )}
    {...props}
  />
))
Skeleton.displayName = 'Skeleton'

export { Skeleton }
