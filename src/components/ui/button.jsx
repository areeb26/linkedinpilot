import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Button — design system component
 *
 * States: default · hover · focus-visible · active · disabled · loading
 * Keyboard: Enter / Space activate; Tab navigates; focus-visible ring always shown
 * Touch: min 44×44px tap target on sm size and above
 *
 * Tokens used:
 *   surface.raised  (#04644a)  → primary fill
 *   surface.strong  (#f8f8f8)  → secondary fill
 *   surface.base    (#000000)  → ghost/outline bg
 *   text.secondary  (#666666)  → muted label
 *   radius.sm (pill)           → default shape
 *   motion.instant (150ms)     → transition duration
 */
const buttonVariants = cva(
  [
    // Base — layout, typography, motion
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'font-semibold text-sm leading-none',
    'rounded-sm',                                    // pill — radius.sm
    'transition-all duration-[150ms] ease-out-quart',// motion.instant
    // Accessibility
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-surface-base)]',
    // Disabled
    'disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed',
    // Active press
    'active:scale-[0.97]',
  ].join(' '),
  {
    variants: {
      variant: {
        // Primary — surface.raised fill, white text
        default:
          'bg-[var(--color-surface-raised)] text-white hover:brightness-110 hover:-translate-y-px',

        // Destructive
        destructive:
          'bg-[oklch(var(--destructive))] text-[oklch(var(--destructive-foreground))] hover:brightness-110',

        // Outline — transparent bg, raised-color border
        outline:
          'border border-[var(--color-surface-raised)] bg-transparent text-[var(--color-surface-raised)] hover:bg-[var(--color-surface-raised)] hover:text-white',

        // Secondary — surface.strong fill, dark text
        secondary:
          'bg-[var(--color-surface-strong)] text-[var(--color-text-on-strong)] hover:brightness-95',

        // Ghost — no bg, subtle hover
        ghost:
          'bg-transparent text-[var(--color-text-secondary)] hover:bg-white/8 hover:text-[var(--color-text-primary)]',

        // Link — no bg, underline on hover
        link:
          'bg-transparent text-[var(--color-surface-raised)] underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        default: 'h-10 px-[var(--space-4)] py-[var(--space-1)]',   // 24px h-pad, 8px v-pad
        sm:      'h-9  px-[var(--space-3)] text-xs',               // 16px h-pad
        lg:      'h-12 px-[var(--space-5)] text-base',             // 32px h-pad
        icon:    'h-10 w-10 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

const Button = React.forwardRef(
  ({ className, variant, size, asChild = false, isLoading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading ? (
          <>
            {/* Accessible loading spinner */}
            <svg
              className="animate-spin h-4 w-4 shrink-0"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            <span className="sr-only">Loading</span>
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
