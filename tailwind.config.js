/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // ─── Typography ────────────────────────────────────────────────────────
      fontFamily: {
        // Primary stack: Serotiva with sans-serif fallback
        sans: ['Serotiva', 'sans-serif'],
        // Keep display alias pointing to same stack for headings
        display: ['Serotiva', 'sans-serif'],
      },
      fontSize: {
        xs:  ['13px', { lineHeight: '20px' }],
        sm:  ['14px', { lineHeight: '20px' }],
        md:  ['16px', { lineHeight: '24px' }],
        base:['16px', { lineHeight: '24px' }],
        lg:  ['18px', { lineHeight: '28px' }],
        xl:  ['20px', { lineHeight: '28px' }],
        '2xl': ['48px', { lineHeight: '56px', letterSpacing: '-0.02em' }],
        '3xl': ['60px', { lineHeight: '68px', letterSpacing: '-0.03em' }],
      },
      fontWeight: {
        base: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },

      // ─── Semantic color tokens (mapped to CSS vars) ─────────────────────────
      colors: {
        border:     'var(--color-border)',
        input:      'var(--color-input)',
        ring:       'var(--color-ring)',
        background: 'var(--color-surface-base)',
        foreground: 'var(--color-text-primary)',
        primary: {
          DEFAULT:    'var(--color-surface-raised)',
          foreground: 'var(--color-text-on-raised)',
        },
        secondary: {
          DEFAULT:    'var(--color-surface-strong)',
          foreground: 'var(--color-text-primary)',
        },
        destructive: {
          DEFAULT:    'oklch(var(--destructive))',
          foreground: 'oklch(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT:    'var(--color-surface-muted)',
          foreground: 'var(--color-text-secondary)',
        },
        accent: {
          DEFAULT:    'var(--color-surface-raised)',
          foreground: 'var(--color-text-on-raised)',
        },
        success: {
          DEFAULT:    'oklch(var(--success))',
          foreground: 'oklch(var(--success-foreground))',
        },
        warning: {
          DEFAULT:    'oklch(var(--warning))',
          foreground: 'oklch(var(--warning-foreground))',
        },
        info: {
          DEFAULT:    'oklch(var(--info))',
          foreground: 'oklch(var(--info-foreground))',
        },
        popover: {
          DEFAULT:    'var(--color-surface-base)',
          foreground: 'var(--color-text-primary)',
        },
        card: {
          DEFAULT:    'var(--color-surface-strong)',
          foreground: 'var(--color-text-primary)',
        },
      },

      // ─── Spacing scale (spec tokens) ────────────────────────────────────────
      // space.1=8px  space.2=12px  space.3=16px  space.4=24px
      // space.5=32px space.6=36px  space.7=40px  space.8=60px
      spacing: {
        'ds-1': '8px',
        'ds-2': '12px',
        'ds-3': '16px',
        'ds-4': '24px',
        'ds-5': '32px',
        'ds-6': '36px',
        'ds-7': '40px',
        'ds-8': '60px',
      },

      // ─── Border radius ───────────────────────────────────────────────────────
      // radius.xs=16px  radius.sm=very large (pill)
      borderRadius: {
        xs:  '16px',
        sm:  '9999px',   // pill — radius.sm=26843500px → effectively pill
        md:  '12px',
        lg:  '16px',
        xl:  '20px',
        '2xl': '24px',
        full: '9999px',
      },

      // ─── Motion ──────────────────────────────────────────────────────────────
      // motion.duration.instant=150ms  motion.duration.fast=300ms
      transitionDuration: {
        instant: '150ms',
        fast:    '300ms',
      },
      transitionTimingFunction: {
        'out-quart': 'cubic-bezier(0.25, 1, 0.5, 1)',
        'out-quint': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'out-expo':  'cubic-bezier(0.16, 1, 0.3, 1)',
      },

      // ─── Animations ──────────────────────────────────────────────────────────
      keyframes: {
        'fade-in': {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%':   { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-subtle': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.7' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'fade-in':      'fade-in 0.3s cubic-bezier(0.25, 1, 0.5, 1) forwards',
        'slide-up':     'slide-up 0.3s cubic-bezier(0.25, 1, 0.5, 1) forwards',
        'scale-in':     'scale-in 0.15s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
        shimmer:        'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [],
}
