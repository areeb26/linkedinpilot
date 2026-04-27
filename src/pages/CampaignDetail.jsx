import { useState, useRef, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useCampaign,
  useCampaignLeads,
  useCampaignAccounts,
  useCampaignAnalytics,
  useLaunchCampaign,
  usePauseCampaign,
  useDuplicateCampaign,
  useSendConnectionRequest
} from '@/hooks/useCampaigns'
import { useQueryClient } from '@tanstack/react-query'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { supabase } from '@/lib/supabase'
import LeadUploadModal from '@/components/campaigns/LeadUploadModal'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Copy,
  ExternalLink,
  ChevronDown,
  Users,
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

// Custom Nodes — defined at module level so ReactFlow never sees a new object reference
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

const edgeTypes = {}

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
  
  const _launchMutation = useLaunchCampaign()
  const _pauseMutation = usePauseCampaign()
  const duplicateMutation = useDuplicateCampaign()
  
  if (campaignLoading) {
    return (
      <div className="min-h-screen bg-background">
        {/* Breadcrumb Skeleton */}
        <div className="px-6 py-3 border-b border-border bg-background">
          <Skeleton className="h-4 w-64" />
        </div>
        
        {/* Header Skeleton */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-40" />
              <Skeleton className="h-9 w-32" />
            </div>
          </div>
        </div>

        {/* Tabs Skeleton */}
        <div className="px-6 border-b border-border">
          <div className="flex items-center gap-6">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-24" />
            ))}
          </div>
        </div>

        {/* Content Skeleton */}
        <div className="p-6">
          <div className="grid grid-cols-5 gap-4 mb-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-card border-border p-4 rounded-lg border">
                <Skeleton className="h-3 w-24 mb-2" />
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-1 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
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
      {/* Breadcrumb Navigation */}
      <div className="px-6 py-3 border-b border-border bg-background">
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Dashboard
          </button>
          <span className="text-muted-foreground">/</span>
          <button
            onClick={() => navigate('/campaigns')}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Campaigns
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="text-foreground">{id}</span>
        </div>
      </div>

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
              onClick={() => duplicateMutation.mutate(id)}
              disabled={duplicateMutation.isPending}
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
        {activeTab === 'analytics' && <AnalyticsTab stats={campaignStats} isLoading={analyticsLoading} />}
        {activeTab === 'leads' && <LeadsTab leads={campaignLeads} accounts={accounts} campaignId={id} isLoading={leadsLoading} />}
        {activeTab === 'accounts' && <AccountsTab accounts={accounts} campaignId={id} isLoading={accountsLoading} />}
        {activeTab === 'sequences' && <SequencesTab nodes={nodes} edges={edges} />}
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
function LeadsTab({ leads, accounts, campaignId, isLoading }) {
  const [statusFilter, _setStatusFilter] = useState('all')
  const [showUpload, setShowUpload] = useState(false)
  const sendConnection = useSendConnectionRequest()
  const queryClient = useQueryClient()
  
  // Use first active account as default sender; campaigns can have multiple
  const defaultAccount = accounts?.find(a => a.status === 'active') || 
                         accounts?.find(a => a.status === 'warming') ||
                         accounts?.[0]

  const filteredLeads = statusFilter === 'all'
    ? leads
    : leads.filter(lead => lead.connection_status === statusFilter || lead.status === statusFilter)

  // Progress badge component
  const ProgressBadge = ({ lead }) => {
    const status = lead.connection_status || 'none'
    
    const badges = {
      'none': { label: 'Pending', icon: '⏳', bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300' },
      'pending': { label: 'In Progress', icon: '🔵', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-300' },
      'connected': { label: 'Connection Accepted', icon: '✅', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-300' },
      'replied': { label: 'Contacted', icon: '💬', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-300' },
      'failed': { label: 'Failed', icon: '❌', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300' }
    }
    
    const badge = badges[status] || badges['none']
    
    return (
      <div className="flex flex-col gap-1">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${badge.bg} ${badge.text} ${badge.border}`}>
          <span>{badge.icon}</span>
          {badge.label}
        </span>
      </div>
    )
  }

  // Lead status dropdown component
  const LeadStatusDropdown = ({ lead }) => {
    const [isOpen, setIsOpen] = useState(false)
    const [currentStatus, setCurrentStatus] = useState(lead.tags?.[0] || 'Lead')
    
    const statuses = [
      { value: 'Lead', icon: '🔵', color: 'text-blue-600' },
      { value: 'Interested', icon: '✅', color: 'text-green-600' },
      { value: 'Meeting booked', icon: '📅', color: 'text-purple-600' },
      { value: 'Meeting complete', icon: '✔️', color: 'text-teal-600' },
      { value: 'Closed', icon: '🎯', color: 'text-emerald-600' },
      { value: 'Wrong person', icon: '⚠️', color: 'text-orange-600' },
      { value: 'Not Interested', icon: '❌', color: 'text-red-600' },
      { value: 'No Response', icon: '💤', color: 'text-gray-500' }
    ]
    
    const currentStatusObj = statuses.find(s => s.value === currentStatus) || statuses[0]
    
    const updateLeadStatus = async (newStatus) => {
      try {
        await supabase
          .from('leads')
          .update({ tags: [newStatus] })
          .eq('id', lead.id)
        
        setCurrentStatus(newStatus)
        setIsOpen(false)
        queryClient.invalidateQueries({ queryKey: ['campaign-leads'] })
        toast.success(`Lead status updated to ${newStatus}`)
      } catch (error) {
        toast.error('Failed to update lead status')
      }
    }
    
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium hover:bg-secondary transition-colors"
        >
          <span className={currentStatusObj.color}>{currentStatusObj.icon}</span>
          <span className="text-foreground">{currentStatus}</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>
        
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute right-0 mt-1 w-48 bg-card border border-border rounded-lg shadow-lg z-20 py-1">
              {statuses.map((status) => (
                <button
                  key={status.value}
                  onClick={() => updateLeadStatus(status.value)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors flex items-center gap-2 ${
                    currentStatus === status.value ? 'bg-secondary' : ''
                  }`}
                >
                  <span className={status.color}>{status.icon}</span>
                  <span className="text-foreground">{status.value}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
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
          <Button variant="outline" size="sm" className="border-border bg-background text-muted-foreground" onClick={() => queryClient.invalidateQueries({ queryKey: ['campaign-leads'] })}>
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
              <th className="text-left py-3 px-4 text-muted-foreground text-xs font-medium">Lead</th>
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
                <td colSpan={7} className="p-0">
                  <div className="py-16 px-8">
                    <div className="max-w-4xl mx-auto text-center space-y-8">
                      <div>
                        <h3 className="text-2xl font-semibold text-foreground mb-2">Select Leads Source</h3>
                        <p className="text-muted-foreground">Choose where you want to get your leads from</p>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-6">
                        {/* Upload CSV */}
                        <Card className="p-6 hover:border-primary transition-colors cursor-pointer group" onClick={() => setShowUpload(true)}>
                          <div className="space-y-4">
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                              <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <h4 className="font-semibold text-foreground mb-2">Upload CSV</h4>
                              <p className="text-sm text-muted-foreground">Import leads from a CSV file with LinkedIn URLs and optional information.</p>
                            </div>
                            <Button variant="link" className="text-primary p-0 h-auto font-medium group-hover:underline">
                              Select →
                            </Button>
                          </div>
                        </Card>

                        {/* Lead Database */}
                        <Card className="p-6 hover:border-primary transition-colors cursor-pointer group opacity-60">
                          <div className="space-y-4">
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                              <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <h4 className="font-semibold text-foreground mb-2">Lead Database</h4>
                              <p className="text-sm text-muted-foreground">Select from your existing leads database. Filter by tags, sources, or other criteria.</p>
                            </div>
                            <Button variant="link" className="text-muted-foreground p-0 h-auto font-medium" disabled>
                              Coming Soon
                            </Button>
                          </div>
                        </Card>

                        {/* Prospect Extractor */}
                        <Card className="p-6 hover:border-primary transition-colors cursor-pointer group" onClick={() => window.location.href = '/prospect-extractor'}>
                          <div className="space-y-4">
                            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                              <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <h4 className="font-semibold text-foreground mb-2">Prospect Extractor</h4>
                              <p className="text-sm text-muted-foreground">Use our LinkedIn scraper to find and collect new leads based on your search criteria and filters.</p>
                            </div>
                            <Button variant="link" className="text-primary p-0 h-auto font-medium group-hover:underline">
                              Select →
                            </Button>
                          </div>
                        </Card>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredLeads.map((lead) => {
                return (
                  <tr key={lead.id} className="border-b border-border last:border-0 hover:bg-secondary">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex-shrink-0">
                          {lead.avatar_url ? (
                            <img
                              src={lead.avatar_url}
                              alt={lead.full_name || ''}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.currentTarget.style.display = 'none' }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs font-medium text-muted-foreground">
                              {(lead.first_name?.[0] || lead.full_name?.[0] || '?').toUpperCase()}
                            </div>
                          )}
                        </div>
                        <span className="text-foreground text-sm">
                          {lead.first_name || lead.full_name?.split(' ')[0] || lead.profile_url?.split('/in/')[1]?.split('/')[0] || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-foreground text-sm">{lead.last_name || lead.full_name?.split(' ').slice(1).join(' ') || ''}</td>
                    <td className="py-3 px-4">
                      <ProgressBadge lead={lead} />
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
                      <LeadStatusDropdown lead={lead} />
                    </td>
                    <td className="py-3 px-4">
                      {lead.connection_status === 'none' || !lead.connection_status ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-border bg-transparent text-foreground text-xs h-7 px-2"
                          disabled={sendConnection.isPending}
                          onClick={() => {
                            if (!defaultAccount) {
                              toast.error('No active LinkedIn account connected. Go to LinkedIn Accounts and connect one first.')
                              return
                            }
                            sendConnection.mutate({
                              leadId: lead.id,
                              profileUrl: lead.profile_url,
                              linkedinAccountId: defaultAccount.id,
                              note: null,
                              campaignId: campaignId,
                            })
                          }}
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
function AccountsTab({ accounts, campaignId: _campaignId }) {
  const accountList = accounts || []
  const hasAccounts = accountList.length > 0

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

      {/* Per-account limits display */}
      {hasAccounts && (
        <div>
          <h3 className="text-foreground font-medium mb-1">Safety Limits</h3>
          <p className="text-muted-foreground text-sm mb-6">
            Strict safety limits enforced to protect your accounts.
          </p>

          <div className="space-y-4">
            {accountList.map((account) => (
              <Card key={account.id} className="bg-card border-border p-5 space-y-4">
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
                    Today: {account.today_connections ?? 0}/5 connections · {account.today_messages ?? 0}/5 messages
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-secondary/30 rounded-lg border border-border/50">
                    <span className="text-muted-foreground text-[10px] uppercase tracking-wider block mb-1">Daily Connection Limit</span>
                    <span className="text-foreground font-bold">5</span>
                  </div>
                  <div className="p-3 bg-secondary/30 rounded-lg border border-border/50">
                    <span className="text-muted-foreground text-[10px] uppercase tracking-wider block mb-1">Daily Message Limit</span>
                    <span className="text-foreground font-bold">5</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Sequences Tab
function SequencesTab({ nodes, edges }) {
  const reactFlowInstance = useRef(null)
  
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
  
  // Ensure nodes have proper positioning — memoized so ReactFlow sees stable references
  const positionedNodes = useMemo(() =>
    nodes.map((node, index) => ({
      ...node,
      position: node.position || { x: 100, y: index * 100 },
    })),
    [nodes]
  )

  // Memoize edge decoration to avoid creating a new array on every render
  const decoratedEdges = useMemo(() =>
    edges.map(e => ({
      ...e,
      markerEnd: { type: MarkerType.ArrowClosed, color: 'oklch(0.65 0.15 65)' }
    })),
    [edges]
  )

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
          edges={decoratedEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
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
  
  const activeDays = campaign?.settings?.schedule?.days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const currentTimezone = campaign?.timezone || campaign?.settings?.schedule?.timezone || 'UTC'
  const activeHours = campaign?.settings?.schedule?.activeHours || {}

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
              {activeHours.start || '9:00 AM'}
            </div>
          </div>
          <div className="pt-6">
            <span className="text-muted-foreground">to</span>
          </div>
          <div className="flex-1">
            <label className="text-muted-foreground text-sm block mb-2">to</label>
            <div className="bg-secondary border border-border rounded-lg px-4 py-3 text-foreground">
              {activeHours.end || '5:00 PM'}
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
          <div className="flex-1 bg-secondary border border-border rounded-lg px-4 py-3 text-foreground">
            {currentTimezone}
          </div>
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
