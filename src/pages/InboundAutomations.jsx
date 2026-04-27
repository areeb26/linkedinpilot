import React, { useState } from "react"
import { useAutomations } from "@/hooks/useAutomations"
import { AutomationCard } from "@/components/automations/AutomationCard"
import { AutomationConfigDrawer } from "@/components/automations/AutomationConfigDrawer"
import { Sheet } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Plus, Search, Zap, MousePointer2, MessageSquare, UserPlus, Check, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useReceivedInvitations, useHandleInvitation } from "@/hooks/useUnipileInvitations"
import { useLinkedInAccounts } from "@/hooks/useLinkedInAccounts"

export default function InboundAutomations() {
  const { data: automations = [], isLoading: _isLoading } = useAutomations()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingAutomation, setEditingAutomation] = useState(null)
  const [search, setSearch] = useState("")

  const { data: linkedInAccounts = [] } = useLinkedInAccounts()
  const activeAccount = linkedInAccounts.find(a => a.unipile_account_id)
  const accountId = activeAccount?.unipile_account_id ?? null
  const { data: receivedInvitations = [], isLoading: loadingInvitations } = useReceivedInvitations(accountId)

  const handleEdit = (automation) => {
    setEditingAutomation(automation)
    setIsDrawerOpen(true)
  }

  const handleNew = (triggerType = "post_comment") => {
    setEditingAutomation({
      trigger_type: triggerType,
      action_type: "send_message",
      action_config: { message_body: "" }
    })
    setIsDrawerOpen(true)
  }

  const filtered = automations.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase())
  )

  const templateSlots = [
    { type: "post_comment", icon: MessageSquare, title: "Post Comment Reply", desc: "Instantly DM anyone who comments on your post." },
    { type: "post_reaction", icon: MousePointer2, title: "Interaction Capture", desc: "Automate outreach to people who like your content." },
    { type: "profile_view", icon: UserPlus, title: "Profile Visit Follow-up", desc: "Turn profile visitors into high-quality leads." }
  ]

  return (
    <div className="space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-info/10 border border-info/20">
              <Zap className="w-4 h-4 text-info" />
            </div>
            <span className="text-[10px] font-bold text-info uppercase tracking-[0.2em]">Live Orchestration</span>
          </div>
          <h1 className="font-display text-4xl font-bold text-foreground tracking-tight">Inbound Automations</h1>
          <p className="text-muted-foreground text-sm">Convert passive engagement into active leads using trigger-based workflows.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-info transition-colors" />
            <Input 
              placeholder="Search active workflows..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-muted border-border focus:border-primary/50 h-12 text-sm"
            />
          </div>
          <Button 
            onClick={() => handleNew()}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold h-12 px-6 uppercase tracking-widest text-xs"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New
          </Button>
        </div>
      </div>

      {/* Stats Quick Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <QuickStat label="Active Workflows" value={automations.filter(a => a.status === 'active').length} />
        <QuickStat label="Total Run Count" value={automations.reduce((acc, a) => acc + (a.run_count || 0), 0)} />
        <QuickStat label="Leads Generated" value="1,284" color="text-[oklch(var(--success))]" />
        <QuickStat label="Response Rate" value="42.5%" color="text-[var(--color-surface-raised)]" />
      </div>

      {/* Main Grid */}
      <div className="space-y-12">
        {/* Received Invitations */}
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] whitespace-nowrap">Received Invitations</h2>
            <div className="h-px w-full bg-border" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">{receivedInvitations.length} pending</span>
          </div>

          {loadingInvitations ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : receivedInvitations.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              No pending invitations
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {receivedInvitations.map(inv => (
                <InvitationCard key={inv.id} invitation={inv} accountId={accountId} />
              ))}
            </div>
          )}
        </div>

        {/* Active Automations */}
        {automations.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <h2 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] whitespace-nowrap">Active Workflows</h2>
              <div className="h-px w-full bg-border" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {filtered.map(automation => (
                <AutomationCard 
                  key={automation.id} 
                  automation={automation} 
                  onEdit={handleEdit} 
                />
              ))}
            </div>
          </div>
        )}

        {/* Setup Slots / Templates */}
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <h2 className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-[0.3em] whitespace-nowrap">Setup Templates</h2>
            <div className="h-px w-full bg-[var(--color-border)]" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 opacity-80 hover:opacity-100 transition-opacity">
            {templateSlots.map(slot => (
              <button
                key={slot.type}
                onClick={() => handleNew(slot.type)}
                className="group relative flex flex-col text-left p-[var(--space-4)] rounded-xs bg-[var(--color-border)] border border-dashed border-[var(--color-border)] hover:border-[var(--color-surface-raised)]/40 hover:bg-[var(--color-surface-raised)]/5 transition-all duration-[150ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
              >
                <div className="w-10 h-10 rounded-xs bg-[var(--color-surface-strong)] border border-[var(--color-border)] flex items-center justify-center mb-[var(--space-3)] group-hover:bg-[var(--color-surface-raised)]/10 group-hover:border-[var(--color-surface-raised)]/20 transition-colors">
                  <slot.icon className="w-5 h-5 text-[var(--color-text-secondary)] group-hover:text-[var(--color-surface-raised)]" />
                </div>
                <h3 className="text-sm font-bold text-[var(--color-text-on-strong)] uppercase tracking-widest mb-1 group-hover:text-[var(--color-surface-raised)]">{slot.title}</h3>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed mb-6">{slot.desc}</p>
                <div className="mt-auto flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-on-strong)]">
                  Get Started
                  <Plus className="w-3 h-3" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Drawer for Config */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <AutomationConfigDrawer 
          automation={editingAutomation} 
          onClose={() => setIsDrawerOpen(false)} 
        />
      </Sheet>
    </div>
  )
}

function InvitationCard({ invitation, accountId }) {
  const { mutate: handleInvitation, isPending } = useHandleInvitation()

  const name = invitation.from?.name ?? invitation.sender_name ?? 'Unknown'
  const headline = invitation.from?.headline ?? ''
  const avatarUrl = invitation.from?.profile_picture_url ?? null
  const note = invitation.message ?? invitation.note ?? null

  return (
    <div className="flex flex-col gap-[var(--space-3)] p-[var(--space-3)] rounded-xs bg-[var(--color-surface-strong)] border border-[var(--color-border)]">
      <div className="flex items-start gap-[var(--space-2)]">
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-10 h-10 rounded-xs object-cover shrink-0 border border-[var(--color-border)]" />
        ) : (
          <div className="w-10 h-10 rounded-xs bg-[var(--color-border)] border border-[var(--color-border)] flex items-center justify-center shrink-0">
            <UserPlus className="w-4 h-4 text-[var(--color-text-secondary)]" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-bold text-[var(--color-text-on-strong)] truncate">{name}</p>
          {headline && (
            <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 leading-relaxed">{headline}</p>
          )}
        </div>
      </div>

      {note && (
        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed border-t border-[var(--color-border)] pt-[var(--space-2)] line-clamp-3">
          {note}
        </p>
      )}

      <div className="flex items-center gap-[var(--space-1)] mt-auto">
        <Button
          size="sm"
          disabled={isPending}
          onClick={() => handleInvitation({ accountId, invitationId: invitation.id, action: 'accept', linkedin_token: invitation.linkedin_token ?? invitation.token })}
          className="flex-1 h-8 text-xs font-bold uppercase tracking-widest"
        >
          <Check className="w-3 h-3 mr-1" />
          Accept
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => handleInvitation({ accountId, invitationId: invitation.id, action: 'decline', linkedin_token: invitation.linkedin_token ?? invitation.token })}
          className="flex-1 h-8 text-xs font-bold uppercase tracking-widest"
        >
          <X className="w-3 h-3 mr-1" />
          Decline
        </Button>
      </div>
    </div>
  )
}

function QuickStat({ label, value, color }) {
  return (
    <div className="p-[var(--space-3)] rounded-xs bg-[var(--color-surface-strong)] border border-[var(--color-border)] space-y-1">
      <p className="text-[9px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest">{label}</p>
      <p className={`text-xl font-black tracking-tighter ${color ?? 'text-[var(--color-text-on-strong)]'}`}>{value}</p>
    </div>
  )
}
