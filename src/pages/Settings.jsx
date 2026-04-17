import React, { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Progress } from "@/components/ui/progress"
import { 
  Building2, Users, CreditCard, Puzzle, 
  Save, Mail, Trash2, Shield, Zap, Globe, 
  ExternalLink, Key, Loader2, AlertCircle 
} from "lucide-react"
import { useWorkspace, useUpdateWorkspace, useUpdateSettings } from "@/hooks/useWorkspace"
import { useTeam, useInvitations, useInviteMember, useRemoveMember } from "@/hooks/useTeam"
import { useUsageStats } from "@/hooks/useUsageStats"

export default function Settings() {
  const [activeTab, setActiveTab] = useState("workspace")

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-black text-foreground tracking-tighter uppercase">Protocol Settings</h1>
        <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest">Workspace Governance & Integration Hub</p>
      </div>

      <Tabs defaultValue="workspace" orientation="vertical" className="flex flex-row gap-12 mt-8">
        <TabsList className="flex flex-col h-auto bg-transparent border-none p-0 w-64 shrink-0 space-y-2">
          <SettingsTabTrigger value="workspace" icon={Building2} label="Workspace" />
          <SettingsTabTrigger value="team" icon={Users} label="Team Members" />
          <SettingsTabTrigger value="billing" icon={CreditCard} label="Billing & Usage" />
          <SettingsTabTrigger value="integrations" icon={Puzzle} label="API Integrations" />
        </TabsList>

        <div className="flex-1 max-w-4xl">
          <TabsContent value="workspace" className="mt-0">
            <WorkspaceSection />
          </TabsContent>
          <TabsContent value="team" className="mt-0">
            <TeamSection />
          </TabsContent>
          <TabsContent value="billing" className="mt-0">
            <BillingSection />
          </TabsContent>
          <TabsContent value="integrations" className="mt-0">
            <IntegrationsSection />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

function SettingsTabTrigger({ value, icon: Icon, label }) {
  return (
    <TabsTrigger 
      value={value} 
      className="flex items-center justify-start gap-4 px-4 py-3 border-none bg-transparent rounded-xl text-muted-foreground font-bold uppercase tracking-widest text-[10px] transition-all data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:shadow-xl group"
    >
      <Icon className="w-4 h-4 group-data-[state=active]:text-info" />
      {label}
    </TabsTrigger>
  )
}

// --- Sections ---

function WorkspaceSection() {
  const { data: workspace, isLoading } = useWorkspace()
  const updateWorkspace = useUpdateWorkspace()
  const updateSettings = useUpdateSettings()
  const [name, setName] = useState(workspace?.name || "")

  if (isLoading) return <div className="animate-pulse space-y-8"><div className="h-32 bg-white/5 rounded-2xl" /></div>

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="grid gap-6">
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest">Global Profile</h3>
          <p className="text-xs text-[#444]">Configure your workspace identifying information.</p>
        </div>
        
        <div className="p-8 rounded-2xl bg-[#1e1e1e] border border-white/5 space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-[#444] ml-1">Workspace Name</Label>
            <Input 
              value={name || workspace?.name}
              onChange={(e) => setName(e.target.value)}
              className="bg-white/5 border-white/5 h-12 text-sm font-medium focus:border-blue-500/50" 
            />
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase text-[#444] ml-1">Localization (Timezone)</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <select className="bg-white/5 border border-white/5 rounded-lg h-12 px-4 text-sm text-white focus:outline-none focus:border-blue-500/50">
                <option value="UTC">UTC (Universal Time)</option>
                <option value="EST">EST (Eastern Standard Time)</option>
                <option value="GMT">GMT (Greenwich Mean Time)</option>
              </select>
            </div>
            <p className="text-[9px] text-[#444] font-bold uppercase mt-2">All campaign schedules follow this timezone.</p>
          </div>

          <Button 
            onClick={() => updateWorkspace.mutate({ name })}
            className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-[0.2em] px-8 h-12"
          >
            {updateWorkspace.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3 mr-2" />}
            Persist Changes
          </Button>
        </div>
      </div>
    </div>
  )
}

function TeamSection() {
  const { data: members = [] } = useTeam()
  const { data: invitations = [] } = useInvitations()
  const inviteMember = useInviteMember()
  const [email, setEmail] = useState("")

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest">Collaborators</h3>
          <p className="text-xs text-[#444]">Manage team access and roles.</p>
        </div>
        <Button className="bg-white/5 hover:bg-white/10 text-white text-[9px] font-bold uppercase px-4 h-10 border border-white/5">
          <Mail className="w-3 h-3 mr-2" /> Invite Member
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl bg-[#1e1e1e] border border-white/5">
        <table className="w-full text-left">
          <thead className="bg-white/5">
             <tr>
               <th className="px-6 py-4 text-[9px] font-black text-[#444] uppercase tracking-widest">User</th>
               <th className="px-6 py-4 text-[9px] font-black text-[#444] uppercase tracking-widest">Role</th>
               <th className="px-6 py-4 text-[9px] font-black text-[#444] uppercase tracking-widest">Access Status</th>
               <th className="px-6 py-4 text-[9px] font-black text-[#444] uppercase tracking-widest text-right">Actions</th>
             </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {members.map(member => (
              <tr key={member.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-black text-[10px]">
                      {member.user_id.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white">Team Member</span>
                      <span className="text-[10px] text-[#444]">ID: {member.user_id.substring(0, 8)}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-[10px] font-bold text-blue-400 border border-blue-500/20 bg-blue-500/5 px-2 py-0.5 rounded uppercase tracking-tighter">
                    {member.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                   <div className="flex items-center gap-2">
                     <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                     <span className="text-[10px] font-bold text-green-400 uppercase">Active</span>
                   </div>
                </td>
                <td className="px-6 py-4 text-right">
                   <Button variant="ghost" size="icon" className="h-8 w-8 text-[#444] hover:text-red-400 hover:bg-red-400/10">
                    <Trash2 className="w-3.5 h-3.5" />
                   </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BillingSection() {
  const { data: usage } = useUsageStats()
  const { data: workspace } = useWorkspace()

  const plans = [
    { name: "Starter", price: "$49", features: ["3 Connected Seats", "2,500 Actions/mo", "Basic Analytics"], current: workspace?.plan === 'starter' },
    { name: "Pro", price: "$99", features: ["10 Connected Seats", "Unlimited Actions", "AI Reply Suggest"], current: workspace?.plan === 'pro' || workspace?.plan === 'free' },
    { name: "Agency", price: "$299", features: ["Unlimited Seats", "White Labeling", "Dedicated Proxy"], current: workspace?.plan === 'agency' },
  ]

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <UsageCard label="Monthly Actions" current={usage?.actions_this_month || 0} limit={2500} unit="Actions" />
        <UsageCard label="Active Seats" current={usage?.seats_used || 0} limit={workspace?.seats || 5} unit="Profiles" />
        <UsageCard label="Lead Database" current={usage?.leads_total || 0} limit={10000} unit="Prospects" />
      </div>

      <div className="space-y-6 pt-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-widest">Expansion Tiers</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map(plan => (
            <div key={plan.name} className={`p-8 rounded-3xl border ${plan.current ? 'bg-blue-600/5 border-blue-500/20 shadow-[0_0_40px_rgba(59,130,246,0.1)]' : 'bg-[#1e1e1e] border-white/5'} flex flex-col gap-6`}>
               <div className="space-y-1">
                 <p className="text-[10px] font-black uppercase text-blue-400 tracking-[0.2em]">{plan.name}</p>
                 <div className="flex items-baseline gap-1">
                   <p className="text-3xl font-black text-white tracking-tighter">{plan.price}</p>
                   <p className="text-[10px] text-[#444] font-bold uppercase">/mo</p>
                 </div>
               </div>
               <div className="space-y-3">
                 {plan.features.map(f => (
                   <div key={f} className="flex items-center gap-2">
                     <Zap className="w-3 h-3 text-[#444]" />
                     <span className="text-[11px] text-[#888] font-medium">{f}</span>
                   </div>
                 ))}
               </div>
               <Button 
                disabled={plan.current && workspace?.plan !== 'free'}
                className={`w-full h-11 uppercase text-[10px] font-black tracking-widest ${plan.current && workspace?.plan !== 'free' ? 'bg-blue-600/20 text-blue-400 cursor-not-allowed' : 'bg-white/5 hover:bg-blue-600 hover:text-white border border-white/5'}`}
               >
                 {plan.current && workspace?.plan !== 'free' ? 'Active Plan' : 'Select Protocol'}
               </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function UsageCard({ label, current, limit, unit }) {
  const percent = Math.min((current / limit) * 100, 100)
  return (
    <div className="p-6 rounded-2xl bg-[#1e1e1e] border border-white/5 space-y-4">
      <div className="flex justify-between items-start">
        <p className="text-[10px] font-black uppercase text-[#444] tracking-widest">{label}</p>
        <div className="p-1 px-1.5 rounded bg-blue-500/10 border border-blue-500/20 text-[9px] font-black text-blue-400">
          {Math.round(percent)}%
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <p className="text-2xl font-black text-white tracking-tighter">{current.toLocaleString()}</p>
          <p className="text-[10px] font-bold text-[#444] uppercase">/ {limit.toLocaleString()} {unit}</p>
        </div>
        <Progress value={percent} className="h-1.5 bg-white/5" indicatorClassName="bg-blue-500" />
      </div>
    </div>
  )
}

function IntegrationsSection() {
  const { data: workspace } = useWorkspace()
  const updateSettings = useUpdateSettings()
  
  const [keys, setKeys] = useState({
    gemini: workspace?.settings?.[0]?.gemini_api_key_enc || "",
    hunter: workspace?.settings?.[0]?.hunter_api_key_enc || ""
  })

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
       <div className="grid gap-8">
          <IntegrationCard 
            title="Google Gemini AI" 
            desc="Power your inbound reply suggestions and content drafting."
            icon={Zap}
            color="text-purple-400"
          >
             <div className="flex gap-4">
                <Input 
                  type="password"
                  placeholder="Enter your Gemini API Key..." 
                  value={keys.gemini}
                  onChange={(e) => setKeys({...keys, gemini: e.target.value})}
                  className="bg-white/5 border-white/5 h-11 text-sm flex-1"
                />
                <Button className="bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase h-11 border border-white/5 px-6">
                  Test
                </Button>
             </div>
          </IntegrationCard>

          <IntegrationCard 
            title="Hunter.io" 
            desc="Real-time professional email extraction and verification."
            icon={Globe}
            color="text-orange-400"
          >
             <div className="flex gap-4">
                <Input 
                  type="password"
                  placeholder="Enter your Hunter.io API Key..." 
                  value={keys.hunter}
                  onChange={(e) => setKeys({...keys, hunter: e.target.value})}
                  className="bg-white/5 border-white/5 h-11 text-sm flex-1"
                />
                <Button className="bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase h-11 border border-white/5 px-6">
                  Verify
                </Button>
             </div>
          </IntegrationCard>

          <IntegrationCard 
            title="Outbound Webhooks" 
            desc="Send campaign events (replied, connected) to external systems."
            icon={Zap}
            color="text-blue-400"
          >
             <div className="space-y-4">
                <div className="flex gap-4">
                  <Input 
                    placeholder="https://hooks.zapier.com/..." 
                    className="bg-white/5 border-white/5 h-11 text-sm flex-1"
                  />
                  <Button className="bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase h-11 border border-white/5 px-6">
                    Connect
                  </Button>
                </div>
                <div className="flex items-center gap-6">
                   <WebhookAction label="New Reply" />
                   <WebhookAction label="New Connection" />
                   <WebhookAction label="Campaign Start" />
                </div>
             </div>
          </IntegrationCard>
       </div>

       <div className="p-8 rounded-2xl bg-[#1e1e1e] border border-white/5 flex items-center justify-between">
          <div className="space-y-1">
             <p className="text-xs font-bold text-white uppercase">Integration Security</p>
             <p className="text-[10px] text-[#444]">All keys are stored using vault-level encryption.</p>
          </div>
          <Button 
            onClick={() => updateSettings.mutate({ 
              gemini_api_key_enc: keys.gemini,
              hunter_api_key_enc: keys.hunter
            })}
            className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest px-8"
          >
            Update Integrations
          </Button>
       </div>
    </div>
  )
}

function IntegrationCard({ title, desc, icon: Icon, color, children }) {
  return (
    <div className="p-8 rounded-2xl bg-[#1e1e1e] border border-white/5 space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex gap-4">
          <div className={`w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center ${color}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white uppercase tracking-tighter">{title}</h4>
            <p className="text-xs text-[#444] font-medium leading-relaxed">{desc}</p>
          </div>
        </div>
      </div>
      <div>{children}</div>
    </div>
  )
}

function WebhookAction({ label }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded bg-blue-600/20 border border-blue-500/40 flex items-center justify-center">
        <div className="w-1 h-1 bg-blue-400 rounded-full" />
      </div>
      <span className="text-[10px] font-bold text-[#444] uppercase tracking-tighter">{label}</span>
    </div>
  )
}
