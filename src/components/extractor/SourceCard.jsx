import React from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function SourceCard({ 
  icon: Icon, 
  title, 
  description, 
  isNew, 
  isActive, 
  onClick 
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 p-4 rounded-xl border text-left transition-all w-full group",
        isActive 
          ? "bg-purple-600/10 border-purple-500/50 ring-1 ring-purple-500/50" 
          : "bg-[var(--color-surface-strong)] border-[var(--color-border)] hover:border-[var(--color-ring)] hover:bg-[var(--color-input)]"
      )}
    >
      <div className={cn(
        "h-12 w-12 rounded-lg flex items-center justify-center transition-colors shrink-0",
        isActive ? "bg-purple-600 text-white" : "bg-[var(--color-input)] text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]"
      )}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-[var(--color-text-primary)]">{title}</h3>
          {isNew && (
            <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-none text-[10px] px-1.5 py-0 uppercase font-bold tracking-wider">
              NEW
            </Badge>
          )}
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] mt-0.5 line-clamp-1">{description}</p>
      </div>
    </button>
  )
}
