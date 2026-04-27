import React from 'react'
import { Button } from '@/components/ui/button'
import { Trash2, X } from 'lucide-react'

export function BulkActionBar({ selectedCount, onClear, onDelete }) {
  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center gap-4 px-6 py-3 bg-[var(--color-surface-strong)] border border-purple-500/30 rounded-full shadow-2xl shadow-purple-500/10">
        <span className="text-sm font-medium text-[var(--color-text-primary)] whitespace-nowrap">
          <span className="bg-purple-600 px-2 py-0.5 rounded text-xs mr-2">{selectedCount}</span>
          Leads Selected
        </span>
        
        <div className="w-px h-6 bg-[var(--color-border)]" />
        
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-red-400 hover:text-red-300 hover:bg-red-400/10 h-8" 
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4 mr-2" /> Delete
          </Button>
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-input)] h-8" 
            onClick={onClear}
          >
            <X className="h-4 w-4 mr-2" /> Clear
          </Button>
        </div>
      </div>
    </div>
  )
}
