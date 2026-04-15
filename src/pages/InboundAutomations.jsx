import React, { useState } from "react"
import { useAutomations } from "@/hooks/useAutomations"
import { AutomationCard } from "@/components/automations/AutomationCard"
import { AutomationConfigDrawer } from "@/components/automations/AutomationConfigDrawer"
import { Sheet } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Zap, MousePointer2, MessageSquare, UserPlus } from "lucide-react"
import { Input } from "@/components/ui/input"

export default function InboundAutomations() {
  const { data: automations = [], isLoading } = useAutomations()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingAutomation, setEditingAutomation] = useState(null)
  const [search, setSearch] = useState("")

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
            <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Zap className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-[0.2em]">Live Orchestration</span>
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">Inbound Automations</h1>
          <p className="text-[#94a3b8] text-sm">Convert passive engagement into active leads using trigger-based workflows.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative group min-w-[300px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#444] group-focus-within:text-blue-500 transition-colors" />
            <Input 
              placeholder="Search active workflows..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-white/5 border-white/5 focus:border-blue-500/50 h-12 text-sm"
            />
          </div>
          <Button 
            onClick={() => handleNew()}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold h-12 px-6 uppercase tracking-widest text-xs"
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
        <QuickStat label="Leads Generated" value="1,284" color="text-green-400" />
        <QuickStat label="Response Rate" value="42.5%" color="text-purple-400" />
      </div>

      {/* Main Grid */}
      <div className="space-y-12">
        {/* Active Automations */}
        {automations.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <h2 className="text-[10px] font-bold text-[#444] uppercase tracking-[0.3em] whitespace-nowrap">Active Workflows</h2>
              <div className="h-px w-full bg-white/5" />
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
            <h2 className="text-[10px] font-bold text-[#444] uppercase tracking-[0.3em] whitespace-nowrap">Setup Templates</h2>
            <div className="h-px w-full bg-white/5" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 opacity-80 hover:opacity-100 transition-opacity">
            {templateSlots.map(slot => (
              <button 
                key={slot.type}
                onClick={() => handleNew(slot.type)}
                className="group relative flex flex-col text-left p-6 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 hover:border-blue-500/30 hover:bg-white/[0.04] transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 group-hover:bg-blue-500/10 group-hover:border-blue-500/20 transition-colors">
                  <slot.icon className="w-5 h-5 text-[#444] group-hover:text-blue-400" />
                </div>
                <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-1 group-hover:text-blue-400">{slot.title}</h3>
                <p className="text-xs text-[#666] leading-relaxed mb-6">{slot.desc}</p>
                <div className="mt-auto flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[#444] group-hover:text-white">
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

function QuickStat({ label, value, color = "text-white" }) {
  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-1">
      <p className="text-[9px] font-bold text-[#444] uppercase tracking-widest">{label}</p>
      <p className={`text-xl font-black ${color} tracking-tighter`}>{value}</p>
    </div>
  )
}
