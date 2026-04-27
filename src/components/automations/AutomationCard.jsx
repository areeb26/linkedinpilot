import React from "react"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToggleAutomation } from "@/hooks/useAutomations"
import { Settings, Users, Zap, Clock, MessageSquare } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

// Trigger type config — all colors use design tokens
const typeConfig = {
  post_comment: {
    icon: MessageSquare,
    color: 'text-[oklch(var(--info))]',
    border: 'border-l-[oklch(var(--info))]',
    label: 'Comment Trigger',
  },
  post_reaction: {
    icon: Zap,
    color: 'text-[var(--color-surface-raised)]',
    border: 'border-l-[var(--color-surface-raised)]',
    label: 'Post Engagement',
  },
  profile_view: {
    icon: Users,
    color: 'text-[oklch(var(--success))]',
    border: 'border-l-[oklch(var(--success))]',
    label: 'Profile Interaction',
  },
}

export function AutomationCard({ automation, onEdit }) {
  const toggleMutation = useToggleAutomation()

  const { icon: Icon, color, border, label } = typeConfig[automation.trigger_type] ?? {
    icon: Zap,
    color: 'text-[var(--color-text-secondary)]',
    border: 'border-l-[var(--color-border)]',
    label: automation.trigger_type,
  }

  return (
    <Card className={`relative border-l-4 ${border} overflow-hidden group`}>
      <div className="p-[var(--space-4)] space-y-[var(--space-4)]">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-[var(--space-1)]">
              <Icon className={`w-4 h-4 ${color}`} aria-hidden="true" />
              <Badge variant="outline" className="text-[10px] uppercase tracking-widest bg-[var(--color-border)] border-[var(--color-border)] font-bold text-[var(--color-text-secondary)]">
                {label}
              </Badge>
            </div>
            <h3 className="text-lg font-bold text-[var(--color-text-on-strong)] tracking-tight">{automation.name}</h3>
          </div>
          <Switch
            checked={automation.status === 'active'}
            onCheckedChange={() => toggleMutation.mutate({ id: automation.id, status: automation.status })}
            disabled={toggleMutation.isPending}
            aria-label={`Toggle ${automation.name}`}
          />
        </div>

        {/* Description */}
        <div className="p-[var(--space-2)] bg-[var(--color-border)] rounded-xs border border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            {automation.description || 'No description provided.'}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-[var(--space-3)]">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-secondary)] font-bold">Total Runs</p>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-[var(--color-text-on-strong)] tracking-tighter">{automation.run_count || 0}</span>
              <span className="text-[10px] text-[oklch(var(--success))] font-bold">+12%</span>
            </div>
          </div>
          <div className="space-y-1 text-right">
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-secondary)] font-bold">Success Rate</p>
            <div className="flex items-baseline gap-2 justify-end">
              <span className="text-xl font-bold text-[var(--color-text-on-strong)] tracking-tighter">98%</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-[var(--space-1)] pt-[var(--space-1)]">
          <Button
            onClick={() => onEdit(automation)}
            variant="outline"
            className="flex-1 text-xs font-bold h-10 uppercase tracking-widest"
          >
            <Settings className="w-3 h-3 mr-2" aria-hidden="true" />
            Edit
          </Button>
          <Button
            variant="outline"
            className="flex-1 text-xs font-bold h-10 uppercase tracking-widest"
          >
            <Users className="w-3 h-3 mr-2" aria-hidden="true" />
            View Leads
          </Button>
        </div>
      </div>

      {/* Last triggered overlay */}
      {automation.last_triggered_at && (
        <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--color-surface-base)]/60 rounded-sm border border-[var(--color-border)]">
            <Clock className="w-2.5 h-2.5 text-[var(--color-text-secondary)]" aria-hidden="true" />
            <span className="text-[8px] text-[var(--color-text-secondary)] font-bold uppercase tracking-tighter">
              {formatDistanceToNow(new Date(automation.last_triggered_at))} ago
            </span>
          </div>
        </div>
      )}
    </Card>
  )
}
