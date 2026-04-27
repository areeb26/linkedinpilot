import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Card — design system component
 *
 * States: default · hover (subtle lift) · focus-visible (when interactive)
 * Tokens:
 *   surface.strong (#f8f8f8) → card background
 *   surface.base   (#000000) → page background (ring offset)
 *   radius.xs (16px)         → card corner radius
 *   space.4 (24px)           → internal padding
 *   motion.instant (150ms)   → hover transition
 *
 * Anti-patterns:
 *   ✗ Do not nest cards more than one level deep
 *   ✗ Do not use raw hex values — use CSS var tokens
 *   ✗ Do not suppress focus-visible on interactive cards
 */
const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-xs',                                          // radius.xs = 16px
      'bg-[var(--color-surface-strong)]',                    // surface.strong
      'text-[var(--color-text-on-strong)]',
      'border border-[var(--color-border)]',
      'shadow-elevation-1',
      'transition-all duration-[150ms] ease-out-quart',      // motion.instant
      className
    )}
    {...props}
  />
))
Card.displayName = 'Card'

const CardHeader = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col gap-[var(--space-1)] p-[var(--space-4)]', className)}
    {...props}
  />
))
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      'text-lg font-semibold leading-none tracking-tight',
      'text-[var(--color-text-on-strong)]',
      className
    )}
    {...props}
  />
))
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      'text-sm text-[var(--color-text-secondary)]',
      className
    )}
    {...props}
  />
))
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('px-[var(--space-4)] pb-[var(--space-4)] pt-0', className)}
    {...props}
  />
))
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'flex items-center px-[var(--space-4)] pb-[var(--space-4)] pt-0',
      className
    )}
    {...props}
  />
))
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
