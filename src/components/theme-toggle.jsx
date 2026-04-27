import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useTheme } from '@/components/theme-provider'
import { cn } from '@/lib/utils'

export function ThemeToggle() {
  const { setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'h-9 w-9 rounded-xs',
            'text-[var(--color-text-secondary)]',
            'hover:bg-white/8 hover:text-[var(--color-text-primary)]',
          )}
          aria-label="Toggle color theme"
        >
          {/* Sun — visible in dark mode */}
          <Sun
            className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
            aria-hidden="true"
          />
          {/* Moon — visible in light mode */}
          <Moon
            className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
            aria-hidden="true"
          />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className={cn(
          'rounded-xs border border-[var(--color-border)]',
          'bg-[var(--color-surface-base)]/95 backdrop-blur-sm',
          'shadow-elevation-3 animate-scale-in',
        )}
      >
        <DropdownMenuItem
          onClick={() => setTheme('light')}
          className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] focus:text-[var(--color-text-primary)] cursor-pointer"
        >
          <Sun className="mr-2 h-4 w-4" aria-hidden="true" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme('dark')}
          className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] focus:text-[var(--color-text-primary)] cursor-pointer"
        >
          <Moon className="mr-2 h-4 w-4" aria-hidden="true" />
          Dark
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
