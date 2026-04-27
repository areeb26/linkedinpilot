import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Input — design system component
 *
 * States: default · hover · focus-visible · disabled · error (via aria-invalid)
 * Keyboard: Tab to focus; focus-visible ring always shown
 * Tokens:
 *   surface.base   (#000000) → input background
 *   color.border             → default border
 *   color.ring               → focus ring color (#04644a)
 *   radius.xs (16px)         → corner radius
 *   space.3 (16px)           → horizontal padding
 *   font-size.sm (14px)      → input text size
 *   motion.instant (150ms)   → transition
 *
 * Anti-patterns:
 *   ✗ Do not hide focus-visible outline
 *   ✗ Do not use placeholder as the only label — always pair with <label>
 *   ✗ Do not use raw hex values
 */
const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        // Layout
        'flex h-10 w-full',
        'px-[var(--space-3)] py-[var(--space-1)]',
        // Typography
        'text-sm font-normal',
        'text-[var(--color-text-primary)]',
        'placeholder:text-[var(--color-text-secondary)]',
        // Surface
        'bg-[var(--color-input)]',
        'rounded-xs',                                        // radius.xs = 16px
        'border border-[var(--color-border)]',
        // Transitions
        'transition-all duration-[150ms] ease-out-quart',   // motion.instant
        // Hover
        'hover:border-[var(--color-ring)]/50',
        // Focus-visible — never hidden
        'focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
        'focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-base)]',
        'focus-visible:border-[var(--color-ring)]',
        // Error state (aria-invalid)
        'aria-[invalid=true]:border-[oklch(var(--destructive))]',
        'aria-[invalid=true]:focus-visible:ring-[oklch(var(--destructive))]',
        // Disabled
        'disabled:cursor-not-allowed disabled:opacity-40',
        // File input reset
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        className
      )}
      {...props}
    />
  )
})
Input.displayName = 'Input'

export { Input }
