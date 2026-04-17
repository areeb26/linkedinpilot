import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  useCampaign,
  useCampaignLeads,
  useCampaignAccounts,
  useCampaignAnalytics,
  useLaunchCampaign,
  usePauseCampaign,
  useDuplicateCampaign,
  useUpdateAccountLimits,
  useSendConnectionRequest
} from '@/hooks/useCampaigns'
import LeadUploadModal from '@/components/campaigns/LeadUploadModal'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Copy,
  ExternalLink,
  ChevronDown,
  Users,
  GitBranch,
  Calendar,
  Plus,
  Minus,
  Maximize2,
  Workflow
} from 'lucide-react'
import ReactFlow, { 
  Background, 
  Controls,
  MarkerType
} from 'reactflow'
import 'reactflow/dist/style.css'

// Custom Nodes
import TriggerNode from '@/components/campaigns/nodes/TriggerNode'
import ActionNode from '@/components/campaigns/nodes/ActionNode'
import ConditionNode from '@/components/campaigns/nodes/ConditionNode'
import EndNode from '@/components/campaigns/nodes/EndNode'

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  end: EndNode,
}

const TABS = [
  { id: 'analytics', label: 'Analytics' },
  { id: 'leads', label: 'Leads' },
  { id: 'accounts', label: 'LinkedIn Accounts' },
  { id: 'sequences', label: 'Sequences' },
  { id: 'schedule', label: 'Schedule' },
]

export default function CampaignDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('analytics')
  
  const { data: campaign, isLoading: campaignLoading } = useCampaign(id)
  const { data: leads, isLoading: leadsLoading } = useCampaignLeads(id)
  const { data: accounts, isLoading: accountsLoading } = useCampaignAccounts(id)
  const { data: analytics, isLoading: analyticsLoading } = useCampaignAnalytics(id)
  
  const launchMutation = useLaunchCampaign()
  const pauseMutation = usePauseCampaign()
  const duplicateMutation = useDuplicateCampaign()
  
  const isLoading = campaignLoading || leadsLoading || accountsLoading || analyticsLoading

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!campaign) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Campaign not found</p>
          <Button onClick={() => navigate('/campaigns')} variant="outline">
            Back to Campaigns
          </Button>
        </div>
      </div>
    )
  }

  const nodes = campaign?.sequence_json?.nodes || []
  const edges = campaign?.sequence_json?.edges || []
  const campaignLeads = leads || []
  const campaignAccounts = accounts || []
  const campaignStats = analytics || {
    connections_sent: 0,
    connections_accepted: 0,
    messages_sent: 0,
    replies_received: 0,
    opportunities: 0
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active': 
        return (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-success text-success-foreground">
            Active
          </span>
        )
      case 'paused': 
        return (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-warning text-warning-foreground">
            Paused
          </span>
        )
      case 'draft': 
        return (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
            Draft
          </span>
        )
      default: 
        return (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
            {status}
          </span>
        )
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-xl font-semibold text-foreground">{campaign.name}</h1>
            {getStatusBadge(campaign.status)}
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              className="border-border bg-background text-foreground hover:bg-secondary"
            >
              <Copy className="w-4 h-4 mr-2" /> Duplicate Campaign
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate(`/campaigns/${id}/edit`)}
              className="border-border bg-background text-foreground hover:bg-secondary"
            >
              Edit Campaign
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 border-b border-border">
        <div className="flex items-center gap-6">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 text-sm font-medium transition-all border-b-2 ${
                  isActive 
                    ? 'text-foreground border-primary' 
                    : 'text-muted-foreground border-transparent hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'analytics' && <AnalyticsTab stats={campaignStats} />}
        {activeTab === 'leads' && <LeadsTab leads={campaignLeads} accounts={campaignAccounts} campaignId={id} />}
        {activeTab === 'accounts' && <AccountsTab accounts={campaignAccounts} campaignId={id} />}
        {activeTab === 'sequences' && <SequencesTab nodes={nodes} edges={edges} nodeTypes={nodeTypes} />}
        {activeTab === 'schedule' && <ScheduleTab campaign={campaign} />}
      </div>
    </div>
  )
}

// Analytics Tab
function AnalyticsTab({ stats }) {
  const metrics = [
    { label: 'Connections Sent', value: stats?.connections_sent || 0 },
    { label: 'Connections Allocated', value: stats?.connections_accepted || 0 },
    { label: 'Messages Sent', value: stats?.messages_sent || 0 },
    { label: 'Reply Received', value: stats?.replies_received || 0 },
    { label: 'Opportunities', value: stats?.opportunities || 0 },
  ]

  return (
    <div className="space-y-6">
      {/* Stats Grid - 5 columns like SendPilot */}
      <div className="grid grid-cols-5 gap-4">
        {metrics.map((metric) => (
          <Card key={metric.label} className="bg-card border-border p-4">
            <div className="text-muted-foreground text-xs mb-1">{metric.label}</div>
            <div className="text-2xl font-semibold text-foreground">{metric.value}</div>
            <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary rounded-full"
                style={{ width: `${Math.min((metric.value / 50) * 100, 100)}%` }}
              />
            </div>
          </Card>
        ))}
      </div>

      {/* Activity Chart */}
      <Card className="bg-card border-border p-6">
        <div className="mb-6">
          <h3 className="text-foreground font-medium">Activity</h3>
        </div>
        <div className="h-64 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Activity chart will appear here</p>
        </div>
      </Card>
    </div>
  )
}

// Leads Tab
function LeadsTab({ leads, accounts, campaignId }) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [showUpload, setShowUpload] = useState(false)
  const sendConnection = useSendConnectionRequest()
  // Use first active account as default sender; campaigns can have multiple
  const defaultAccount = accounts?.find(a => a.status === 'active') || accounts?.[0]
  
  const filteredLeads = statusFilter === 'all' 
    ? leads 
    : leads.filter(lead => lead.connection_status === statusFilter || lead.status === statusFilter)

  // Map connection_status to progress label
  const getProgress = (lead) => {
    const status = lead.connection_status || lead.status || 'pending'
    switch (status) {
      case 'connected': return 'CONNECTION_ACCEPTED'
      case 'pending': return 'CONNECTION_SENT'
      case 'none': return 'PENDING'
      default: return status.toUpperCase().replace('_', ' ')
    }
  }

  // Get progress color
  const getProgressColor = (progress) => {
    switch (progress) {
      case 'CONNECTION_ACCEPTED': return 'text-success'
      case 'MESSAGE_SENT': return 'text-info'
      case 'CONNECTION_SENT': return 'text-warning'
      case 'PENDING': return 'text-muted-foreground'
      default: return 'text-muted-foreground'
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-medium text-foreground">Leads</h2>
          <p className="text-muted-foreground text-sm">Manage and track your campaign leads</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="border-border bg-background text-muted-foreground" onClick={() => window.location.reload()}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setShowUpload(true)}
            className="bg-primary hover:bg-purple-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Upload Leads
          </Button>
          <Button variant="outline" size="sm" className="border-border bg-background text-muted-foreground">
            {statusFilter === 'all' ? 'All Statuses' : statusFilter}
            <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="bg-card border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-muted-foreground text-xs font-medium">First name</th>
              <th className="text-left py-3 px-4 text-muted-foreground text-xs font-medium">Last name</th>
              <th className="text-left py-3 px-4 text-muted-foreground text-xs font-medium">Progress</th>
              <th className="text-left py-3 px-4 text-muted-foreground text-xs font-medium">LinkedIn</th>
              <th className="text-left py-3 px-4 text-muted-foreground text-xs font-medium">Notes</th>
              <th className="text-left py-3 px-4 text-muted-foreground text-xs font-medium">Lead status</th>
              <th className="text-left py-3 px-4 text-muted-foreground text-xs font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4" />
                  <p>No leads enrolled in this campaign</p>
                </td>
              </tr>
            ) : (
              filteredLeads.map((lead) => {
                const progress = getProgress(lead)
                const progressColor = getProgressColor(progress)
                return (
                  <tr key={lead.id} className="border-b border-border last:border-0 hover:bg-secondary">
                    <td className="py-3 px-4 text-foreground text-sm">{lead.first_name || lead.full_name?.split(' ')[0] || '-'}</td>
                    <td className="py-3 px-4 text-foreground text-sm">{lead.last_name || lead.full_name?.split(' ').slice(1).join(' ') || '-'}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs ${progressColor}`}>
                        {progress}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <a href={lead.profile_url} target="_blank" rel="noopener noreferrer" className="text-info text-sm flex items-center gap-1 hover:underline">
                        {lead.profile_url?.substring(0, 25)}...
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-info text-sm">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                        </svg>
                        {lead.notes || 'Lead'}
                        <ChevronDown className="w-3 h-3" />
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-info text-sm">
                        Lead
                        <ChevronDown className="w-3 h-3" />
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {lead.connection_status === 'none' || !lead.connection_status ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-border bg-transparent text-foreground hoves-condaryite/5 text-xs h-7 px-2"
                          disabled={!defaultAccount || sendConnection.isPending}
                          onClick={() => sendConnection.mutate({
                            leadId: lead.id,
                            profileUrl: lead.profile_url,
                            linkedinAccountId: defaultAccount?.id,
                            note: null,
                          })}
                        >
                          Connect
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-xs capitalize">{lead.connection_status}</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </Card>

      {showUpload && (
        <LeadUploadModal campaignId={campaignId} onClose={() => setShowUpload(false)} />
      )}
    </div>
  )
}

// Accounts Tab
function AccountsTab({ accounts, campaignId }) {
  const accountList = accounts || []
  const hasAccounts = accountList.length > 0
  const updateLimits = useUpdateAccountLimits()

  // Per-account local limit state: { [accountId]: { connection, message } }
  const [localLimits, setLocalLimits] = useState(() =>
    Object.fromEntries(
      accountList.map(a => [a.id, { connection: a.limits?.connection ?? 20, message: a.limits?.message ?? 50 }])
    )
  )

  const setLimit = (accountId, key, value) => {
    setLocalLimits(prev => ({ ...prev, [accountId]: { ...prev[accountId], [key]: value } }))
  }

  const saveLimits = (account) => {
    const { connection, message } = localLimits[account.id] || {}
    updateLimits.mutate({ accountId: account.id, connectionLimit: connection, messageLimit: message })
  }

  const InteractiveSlider = ({ accountId, limitKey, max = 50 }) => {
    const value = localLimits[accountId]?.[limitKey] ?? (limitKey === 'connection' ? 20 : 50)
    return (
      <div className="flex items-center gap-4">
        <input
          type="range"
          min={1}
          max={max}
          value={value}
          onChange={e => setLimit(accountId, limitKey, Number(e.target.value))}
          className="flex-1 accent-primary cursor-pointer"
        />
        <span className="text-foreground text-sm w-8 text-right">{value}</span>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Accounts to use */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-foreground font-medium">Accounts to use</h2>
        </div>
        <p className="text-muted-foreground text-sm mb-4">LinkedIn accounts sending from this campaign</p>

        <div className="flex items-center justify-between mb-2">
          <span className="text-muted-foreground text-sm">Available Accounts</span>
          <span className="text-muted-foreground text-sm">{accountList.length} selected</span>
        </div>

        {hasAccounts ? (
          <Card className="bg-card border-border p-4 mb-6 space-y-3">
            {accountList.map((account) => (
              <div key={account.id} className="flex items-center gap-3">
                <img
                  src={account.avatar_url || 'https://via.placeholder.com/40'}
                  alt={account.full_name}
                  className="w-10 h-10 rounded-full"
                />
                <div className="flex-1">
                  <div className="text-foreground text-sm font-medium">{account.full_name}</div>
                  <div className="text-muted-foreground text-xs">{account.headline}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-info text-foreground text-xs rounded">Free</span>
                  {account.status === 'active' && (
                    <span className="px-2 py-0.5 bg-primary text-foreground text-xs rounded">Active</span>
                  )}
                </div>
              </div>
            ))}
          </Card>
        ) : (
          <Card className="bg-card border-border p-8 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No LinkedIn accounts connected</p>
            <p className="text-muted-foreground text-sm mt-1">Connect an account to start this campaign</p>
          </Card>
        )}
      </div>

      {/* Per-account limit ranges */}
      {hasAccounts && (
        <div>
          <h3 className="text-foreground font-medium mb-1">Limit ranges</h3>
          <p className="text-muted-foreground text-sm mb-6">
            Daily limits per account. Stay safe — LinkedIn flags sudden spikes.
          </p>

          <div className="space-y-8">
            {accountList.map((account) => (
              <Card key={account.id} className="bg-card border-border p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img
                      src={account.avatar_url || 'https://via.placeholder.com/32'}
                      alt={account.full_name}
                      className="w-8 h-8 rounded-full"
                    />
                    <span className="text-foreground text-sm font-medium">{account.full_name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Today: {account.today_connections ?? 0} connections · {account.today_messages ?? 0} messages
                  </div>
                </div>

                {/* Connection limit */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted-foreground text-sm">Connection requests / day</span>
                    <span className="text-primary text-sm font-medium">
                      {localLimits[account.id]?.connection ?? account.limits?.connection}
                    </span>
                  </div>
                  <InteractiveSlider accountId={account.id} limitKey="connection" max={50} />
                  <div className="flex justify-between text-muted-foreground text-xs mt-1">
                    <span>1</span><span>50</span>
                  </div>
                </div>

                {/* Message limit */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-muted-foreground text-sm">Messages / day</span>
                    <span className="text-primary text-sm font-medium">
                      {localLimits[account.id]?.message ?? account.limits?.message}
                    </span>
                  </div>
                  <InteractiveSlider accountId={account.id} limitKey="message" max={100} />
                  <div className="flex justify-between text-muted-foreground text-xs mt-1">
                    <span>1</span><span>100</span>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => saveLimits(account)}
                  disabled={updateLimits.isPending}
                  className="bg-primary hover:bg-purple-700 text-foreground"
                >
                  {updateLimits.isPending ? 'Saving...' : 'Save limits'}
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Sequences Tab
function SequencesTab({ nodes, edges, nodeTypes }) {
  const reactFlowInstance = React.useRef(null)
  
  const onInit = (instance) => {
    reactFlowInstance.current = instance
  }
  
  const onZoomIn = () => {
    reactFlowInstance.current?.zoomIn()
  }
  
  const onZoomOut = () => {
    reactFlowInstance.current?.zoomOut()
  }
  
  const onFitView = () => {
    reactFlowInstance.current?.fitView({ padding: 0.2 })
  }
  
  // Ensure nodes have proper positioning
  const positionedNodes = nodes.map((node, index) => ({
    ...node,
    position: node.position || { x: 100, y: index * 100 },
  }))

  return (
    <div className="h-[600px] flex flex-col">
      {/* Sequence Flow Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
          <Workflow className="w-4 h-4 text-foreground" />
        </div>
        <h2 className="text-foreground font-medium">Sequence Flow</h2>
      </div>

      {/* Flow Diagram Container */}
      <Card className="flex-1 bg-background border-border overflow-hidden relative">
        {/* Zoom Controls - Left Side */}
        <div className="absolute left-4 top-4 flex flex-col gap-1 z-10">
          <button 
            onClick={onZoomIn}
            className="w-8 h-8 rounded bg-secondary border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button 
            onClick={onZoomOut}
            className="w-8 h-8 rounded bg-secondary border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button 
            onClick={onFitView}
            className="w-8 h-8 rounded bg-secondary border border-border flex items-center justify-center text-foreground hover:bg-muted transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        <ReactFlow
          nodes={positionedNodes}
          edges={edges.map(e => ({
            ...e,
            markerEnd: { type: MarkerType.ArrowClosed, color: 'oklch(0.65 0.15 65)' }
          }))}
          nodeTypes={nodeTypes}
          onInit={onInit}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
          minZoom={0.1}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        >
          <Background color="#444" gap={20} size={1} />
          <Controls 
            className="!bg-secondary !border-border"
            style={{ right: 16, left: 'auto' }}
          />
        </ReactFlow>

        {/* Save to Templates - Bottom Right */}
        <div className="absolute bottom-4 right-4 z-10">
          <Button 
            variant="outline" 
            size="sm"
            className="border-border bg-secondary text-muted-foreground hover:text-foreground"
          >
            Save to Templates
          </Button>
        </div>
      </Card>
    </div>
  )
}

// Schedule Tab
function ScheduleTab({ campaign }) {
  const days = [
    { id: 'Monday', label: 'Mondays' },
    { id: 'Tuesday', label: 'Tuesdays' },
    { id: 'Wednesday', label: 'Wednesdays' },
    { id: 'Thursday', label: 'Thursdays' },
    { id: 'Friday', label: 'Fridays' },
    { id: 'Saturday', label: 'Saturdays' },
    { id: 'Sunday', label: 'Sundays' },
  ]
  
  const timezones = [
    { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
    { value: 'America/New_York', label: 'EST - Eastern Standard Time (New York)' },
    { value: 'America/Chicago', label: 'CST - Central Standard Time (Chicago)' },
    { value: 'America/Denver', label: 'MST - Mountain Standard Time (Denver)' },
    { value: 'America/Los_Angeles', label: 'PST - Pacific Standard Time (Los Angeles)' },
    { value: 'America/Toronto', label: 'EST - Eastern Time (Toronto)' },
    { value: 'America/Vancouver', label: 'PST - Pacific Time (Vancouver)' },
    { value: 'America/Mexico_City', label: 'CST - Central Time (Mexico City)' },
    { value: 'America/Sao_Paulo', label: 'BRT - Brasilia Time (Sao Paulo)' },
    { value: 'America/Buenos_Aires', label: 'ART - Argentina Time (Buenos Aires)' },
    { value: 'Europe/London', label: 'GMT - Greenwich Mean Time (London)' },
    { value: 'Europe/Paris', label: 'CET - Central European Time (Paris)' },
    { value: 'Europe/Berlin', label: 'CET - Central European Time (Berlin)' },
    { value: 'Europe/Madrid', label: 'CET - Central European Time (Madrid)' },
    { value: 'Europe/Rome', label: 'CET - Central European Time (Rome)' },
    { value: 'Europe/Amsterdam', label: 'CET - Central European Time (Amsterdam)' },
    { value: 'Europe/Moscow', label: 'MSK - Moscow Standard Time' },
    { value: 'Europe/Istanbul', label: 'TRT - Turkey Time (Istanbul)' },
    { value: 'Asia/Dubai', label: 'GST - Gulf Standard Time (Dubai)' },
    { value: 'Asia/Karachi', label: 'PKT - Pakistan Standard Time (Karachi)' },
    { value: 'Asia/Mumbai', label: 'IST - India Standard Time (Mumbai)' },
    { value: 'Asia/Delhi', label: 'IST - India Standard Time (Delhi)' },
    { value: 'Asia/Kolkata', label: 'IST - India Standard Time (Kolkata)' },
    { value: 'Asia/Dhaka', label: 'BST - Bangladesh Standard Time (Dhaka)' },
    { value: 'Asia/Bangkok', label: 'ICT - Indochina Time (Bangkok)' },
    { value: 'Asia/Jakarta', label: 'WIB - Western Indonesia Time (Jakarta)' },
    { value: 'Asia/Singapore', label: 'SGT - Singapore Time' },
    { value: 'Asia/Hong_Kong', label: 'HKT - Hong Kong Time' },
    { value: 'Asia/Shanghai', label: 'CST - China Standard Time (Shanghai)' },
    { value: 'Asia/Beijing', label: 'CST - China Standard Time (Beijing)' },
    { value: 'Asia/Taipei', label: 'CST - Taiwan Standard Time (Taipei)' },
    { value: 'Asia/Tokyo', label: 'JST - Japan Standard Time (Tokyo)' },
    { value: 'Asia/Seoul', label: 'KST - Korea Standard Time (Seoul)' },
    { value: 'Asia/Manila', label: 'PST - Philippine Time (Manila)' },
    { value: 'Australia/Perth', label: 'AWST - Australian Western Time (Perth)' },
    { value: 'Australia/Adelaide', label: 'ACST - Australian Central Time (Adelaide)' },
    { value: 'Australia/Darwin', label: 'ACST - Australian Central Time (Darwin)' },
    { value: 'Australia/Brisbane', label: 'AEST - Australian Eastern Time (Brisbane)' },
    { value: 'Australia/Sydney', label: 'AEST - Australian Eastern Time (Sydney)' },
    { value: 'Australia/Melbourne', label: 'AEST - Australian Eastern Time (Melbourne)' },
    { value: 'Pacific/Auckland', label: 'NZST - New Zealand Time (Auckland)' },
    { value: 'Pacific/Fiji', label: 'FJT - Fiji Time' },
    { value: 'Pacific/Honolulu', label: 'HST - Hawaii Standard Time' },
    { value: 'America/Anchorage', label: 'AKST - Alaska Standard Time' },
    { value: 'Atlantic/Reykjavik', label: 'GMT - Greenwich Mean Time (Reykjavik)' },
    { value: 'Africa/Cairo', label: 'EET - Eastern European Time (Cairo)' },
    { value: 'Africa/Johannesburg', label: 'SAST - South Africa Standard Time' },
    { value: 'Africa/Lagos', label: 'WAT - West Africa Time (Lagos)' },
    { value: 'Africa/Nairobi', label: 'EAT - East Africa Time (Nairobi)' },
    { value: 'Asia/Tehran', label: 'IRST - Iran Standard Time' },
    { value: 'Asia/Baghdad', label: 'AST - Arabia Standard Time (Baghdad)' },
    { value: 'Asia/Riyadh', label: 'AST - Arabia Standard Time (Riyadh)' },
    { value: 'Asia/Jerusalem', label: 'IST - Israel Standard Time' },
  ]
  
  const activeDays = campaign?.schedule?.days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const currentTimezone = campaign?.schedule?.timezone || 'Asia/Karachi'

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-medium text-foreground mb-1">Schedule messages</h2>
      <p className="text-muted-foreground text-sm mb-6">View campaign schedule settings</p>

      {/* Time Range */}
      <div className="mb-8">
        <h3 className="text-foreground font-medium mb-2">Time range</h3>
        <p className="text-muted-foreground text-sm mb-4">Campaign messages are scheduled during this time range</p>
        
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-muted-foreground text-sm block mb-2">from</label>
            <div className="bg-secondary border border-border rounded-lg px-4 py-3 text-foreground">
              {campaign?.schedule?.time_from || '9:00 AM'}
            </div>
          </div>
          <div className="pt-6">
            <span className="text-muted-foreground">to</span>
          </div>
          <div className="flex-1">
            <label className="text-muted-foreground text-sm block mb-2">to</label>
            <div className="bg-secondary border border-border rounded-lg px-4 py-3 text-foreground">
              {campaign?.schedule?.time_to || '5:00 PM'}
            </div>
          </div>
        </div>
      </div>

      {/* Timezone */}
      <div className="mb-8">
        <h3 className="text-foreground font-medium mb-2">Timezone</h3>
        <p className="text-muted-foreground text-sm mb-4">Campaign timezone setting</p>
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-muted-foreground flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <select 
            className="flex-1 bg-secondary border border-border rounded-lg px-4 py-3 text-foreground appearance-none cursor-pointer focus:outline-none focus:border-purple-500"
            value={currentTimezone}
            disabled
          >
            {timezones.map((tz) => (
              <option key={tz.value} value={tz.value} className="bg-secondary text-foreground">
                {tz.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Days */}
      <div>
        <h3 className="text-foreground font-medium mb-2">Days</h3>
        <p className="text-muted-foreground text-sm mb-4">Campaign messages are sent on these days</p>
        <div className="flex flex-wrap gap-3">
          {days.map((day) => {
            const isActive = activeDays.includes(day.id)
            return (
              <div key={day.id} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                  isActive ? 'bg-primary' : 'border border-muted'
                }`}>
                  {isActive && (
                    <svg className="w-3 h-3 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={`text-sm ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {day.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
