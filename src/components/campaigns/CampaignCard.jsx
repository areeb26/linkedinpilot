import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { MoreVertical, Play, Pause, Edit2, Copy, Trash2, Users, CheckCircle, MessageSquare, DollarSign } from 'lucide-react'
import { useLaunchCampaign, usePauseCampaign, useDuplicateCampaign, useDeleteCampaign } from '@/hooks/useCampaigns'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

const statusStyles = {
  active: { dot: 'bg-success', bg: 'bg-success/10', text: 'text-success', ring: 'ring-success/20' },
  paused: { dot: 'bg-warning', bg: 'bg-warning/10', text: 'text-warning', ring: 'ring-warning/20' },
  draft: { dot: 'bg-info', bg: 'bg-info/10', text: 'text-info', ring: 'ring-info/20' },
  completed: { dot: 'bg-primary', bg: 'bg-primary/10', text: 'text-primary', ring: 'ring-primary/20' },
  archived: { dot: 'bg-muted-foreground', bg: 'bg-muted', text: 'text-muted-foreground', ring: 'ring-muted' },
}

export default function CampaignCard({ campaign }) {
  const launchMutation = useLaunchCampaign()
  const pauseMutation = usePauseCampaign()
  const duplicateMutation = useDuplicateCampaign()
  const deleteMutation = useDeleteCampaign()

  const { stats = {} } = campaign
  const style = statusStyles[campaign.status] || statusStyles.draft

  return (
    <Card className="bg-card border-border hover:border-primary/30 transition-all duration-200 group overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className={cn('w-2 h-2 rounded-full animate-pulse-subtle', style.dot)} />
              <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors tracking-tight line-clamp-1">
                {campaign.name}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-muted text-muted-foreground border-none text-[10px] uppercase font-semibold tracking-wide">
                {campaign.type}
              </Badge>
              <span className={cn('text-[10px] font-semibold uppercase tracking-wide', style.text)}>
                {campaign.status}
              </span>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-secondary text-muted-foreground transition-colors">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-card border-border text-foreground animate-scale-in">
              <DropdownMenuItem asChild>
                <Link to={`/campaigns/${campaign.id}`} className="flex items-center gap-2 cursor-pointer hover:text-foreground">
                  <Edit2 className="w-4 h-4" /> View Campaign
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={`/campaigns/${campaign.id}/edit`} className="flex items-center gap-2 cursor-pointer hover:text-foreground">
                  <Edit2 className="w-4 h-4" /> Edit Campaign
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => duplicateMutation.mutate(campaign.id)} className="flex items-center gap-2 cursor-pointer">
                <Copy className="w-4 h-4" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => deleteMutation.mutate(campaign.id)} className="flex items-center gap-2 text-destructive cursor-pointer focus:text-destructive">
                <Trash2 className="w-4 h-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <StatBox icon={Users} label="Enrolled" value={stats.enrolled || 0} color="primary" />
          <StatBox icon={CheckCircle} label="Accepted" value={`${Math.round(stats.acceptedRate || 0)}%`} color="success" />
          <StatBox icon={MessageSquare} label="Replied" value={`${Math.round(stats.repliedRate || 0)}%`} color="warning" />
          <StatBox icon={DollarSign} label="Pipeline" value={`$${(stats.pipelineValue || 0).toLocaleString()}`} color="accent" />
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            <span>Progress</span>
            <span className="text-foreground">{Math.round(stats.acceptedRate || 0)}%</span>
          </div>
          <Progress value={stats.acceptedRate || 0} className="h-1.5 bg-muted" />
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex -space-x-2">
             {/* Mock avatars for linked accounts */}
            <div className="w-7 h-7 rounded-full bg-primary border-2 border-card flex items-center justify-center text-[10px] font-bold text-primary-foreground">
              LP
            </div>
          </div>

          <div className="flex gap-2">
            {campaign.status === 'active' ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-border bg-background text-muted-foreground hover:bg-secondary hover:text-foreground"
                onClick={() => pauseMutation.mutate(campaign.id)}
              >
                <Pause className="w-3 h-3 mr-2" /> Pause
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-8 bg-primary hover:bg-primary/90 text-primary-foreground border-none px-4"
                onClick={() => launchMutation.mutate(campaign.id)}
                disabled={campaign.status === 'completed'}
              >
                <Play className="w-3 h-3 mr-2 fill-current" /> Launch
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

function StatBox({ icon: Icon, label, value, color }) {
  const colors = {
    primary: 'text-primary bg-primary/10',
    success: 'text-success bg-success/10',
    warning: 'text-warning bg-warning/10',
    accent: 'text-accent bg-accent/10',
  }

  const colorClass = colors[color] || colors.primary

  return (
    <div className="p-3 rounded-lg bg-muted/50 space-y-1.5 group/stat hover:bg-muted transition-colors duration-200">
      <div className="flex items-center gap-2">
        <Icon className={cn('w-3 h-3', colorClass.split(' ')[0])} />
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-lg font-semibold text-foreground tracking-tight tabular-nums">{value}</div>
    </div>
  )
}
