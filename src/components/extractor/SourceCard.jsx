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
          : "bg-[#1e1e1e] border-white/5 hover:border-white/10 hover:bg-[#252525]"
      )}
    >
      <div className={cn(
        "h-12 w-12 rounded-lg flex items-center justify-center transition-colors shrink-0",
        isActive ? "bg-purple-600 text-white" : "bg-white/5 text-[#94a3b8] group-hover:text-white"
      )}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-white">{title}</h3>
          {isNew && (
            <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-none text-[10px] px-1.5 py-0 uppercase font-bold tracking-wider">
              NEW
            </Badge>
          )}
        </div>
        <p className="text-sm text-[#94a3b8] mt-0.5 line-clamp-1">{description}</p>
      </div>
    </button>
  )
}
