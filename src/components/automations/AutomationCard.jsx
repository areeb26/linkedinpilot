import React from "react"
import { Card } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToggleAutomation } from "@/hooks/useAutomations"
import { MoreVertical, Settings, Users, BarChart3, Zap, Clock, MessageSquare } from "lucide-react"
import { formatDistanceToNow } from "date-fns"

export function AutomationCard({ automation, onEdit }) {
  const toggleMutation = useToggleAutomation()

  const typeConfig = {
    post_comment: { icon: MessageSquare, color: "text-blue-400", border: "border-l-blue-400", label: "Comment Trigger" },
    post_reaction: { icon: Zap, color: "text-purple-400", border: "border-l-purple-400", label: "Post Engagement" },
    profile_view: { icon: Users, color: "text-green-400", border: "border-l-green-400", label: "Profile Interaction" }
  }

  const { icon: Icon, color, border, label } = typeConfig[automation.trigger_type] || { icon: Zap, color: "text-gray-400", border: "border-l-gray-400", label: automation.trigger_type }

  return (
    <Card className={`relative bg-[#1e1e1e] border-white/5 border-l-4 ${border} overflow-hidden group`}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Icon className={`w-4 h-4 ${color}`} />
              <Badge variant="outline" className="text-[10px] uppercase tracking-widest bg-white/5 border-white/10 font-bold">
                {label}
              </Badge>
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">{automation.name}</h3>
          </div>
          <div className="flex items-center gap-3">
            <Switch 
              checked={automation.status === 'active'} 
              onCheckedChange={() => toggleMutation.mutate({ id: automation.id, status: automation.status })}
              disabled={toggleMutation.isPending}
            />
          </div>
        </div>

        {/* Config Summary */}
        <div className="p-3 bg-white/5 rounded-xl border border-white/5">
          <p className="text-xs text-[#94a3b8] leading-relaxed">
            {automation.description || 'No description provided.'}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-[#444] font-bold">Total Runs</p>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-white tracking-tighter">{automation.run_count || 0}</span>
              <span className="text-[10px] text-green-400 font-bold">+12%</span>
            </div>
          </div>
          <div className="space-y-1 text-right">
            <p className="text-[10px] uppercase tracking-widest text-[#444] font-bold">Success Rate</p>
            <div className="flex items-baseline gap-2 justify-end">
              <span className="text-xl font-bold text-white tracking-tighter">98%</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-2 pt-2">
          <Button 
            onClick={() => onEdit(automation)}
            variant="outline" 
            className="flex-1 bg-white/5 border-white/10 hover:bg-white/10 text-xs font-bold text-white h-10 uppercase tracking-widest"
          >
            <Settings className="w-3 h-3 mr-2" />
            Edit
          </Button>
          <Button 
            variant="outline" 
            className="flex-1 bg-white/5 border-white/10 hover:bg-white/10 text-xs font-bold text-white h-10 uppercase tracking-widest"
          >
            <Users className="w-3 h-3 mr-2" />
            View Leads
          </Button>
        </div>
      </div>

      {/* Last Triggered Overlay */}
      {automation.last_triggered_at && (
        <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-black/40 rounded-full border border-white/10">
            <Clock className="w-2.5 h-2.5 text-[#444]" />
            <span className="text-[8px] text-[#444] font-bold uppercase tracking-tighter">
              {formatDistanceToNow(new Date(automation.last_triggered_at))} ago
            </span>
          </div>
        </div>
      )}
    </Card>
  )
}
