import React, { useState } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogClose 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { 
  Search, 
  Heart, 
  Building2, 
  Bookmark, 
  Database, 
  X, 
  ChevronRight, 
  ChevronLeft,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react'
import { StepIndicator } from './StepIndicator'
import { SourceCard } from './SourceCard'
import { cn } from '@/lib/utils'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-hot-toast'
import { useLinkedInAccounts } from '@/hooks/useLinkedInAccounts'
import { Link } from 'react-router-dom'

const STEPS = [
  { title: 'Source', description: 'Choose scraping method' },
  { title: 'Account', description: 'Select LinkedIn account' },
  { title: 'URL', description: 'Paste LinkedIn URL' },
  { title: 'Campaign', description: 'Name your campaign' },
  { title: 'Enrichment', description: 'Data options' },
  { title: 'Review', description: 'Confirm details' }
]

const SOURCES = [
  { id: 'search', title: 'Search Link', description: 'Scrape from standard LinkedIn search results', icon: Search },
  { id: 'engagement', title: 'Post Engagements', description: 'Extract users who commented or liked a post', icon: Heart },
  { id: 'nav-search', title: 'Sales Navigator Search', description: 'Use Sales Navigator search results', icon: Building2, isNew: true },
  { id: 'nav-saved', title: 'Sales Navigator Saved Search', description: 'Use a saved Sales Navigator search', icon: Bookmark, isNew: true },
  { id: 'nav-list', title: 'Sales Navigator List', description: 'Extract leads from a Sales Navigator list', icon: Database, isNew: true },
]

export function LeadExtractorWizard({ isOpen, onOpenChange }) {
  const { workspaceId } = useWorkspaceStore()
  const { data: accounts, isLoading: isLoadingAccounts } = useLinkedInAccounts()
  
  const [step, setStep] = useState(1)
  const [selectedSource, setSelectedSource] = useState('search')
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [url, setUrl] = useState('')
  const [campaignName, setCampaignName] = useState('')
  const [campaignDesc, setCampaignDesc] = useState('')
  const [enrichOptions, setEnrichOptions] = useState({
    email: true,
    phone: false
  })
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleNext = () => {
    if (step === 2 && !selectedAccountId) {
      toast.error('Please select a LinkedIn account')
      return
    }
    if (step === 3 && !url) {
      toast.error('Please provide a LinkedIn URL')
      return
    }
    if (step === 4 && !campaignName) {
      toast.error('Please provide a campaign name')
      return
    }
    setStep(s => Math.min(s + 1, 6))
  }
  
  const handleBack = () => setStep(s => Math.max(s - 1, 1))

  // Maps wizard source IDs to content script extraction types
  const SOURCE_TO_EXTRACTION_TYPE = {
    'search': 'search',
    'engagement': 'engagement',
    'nav-search': 'nav-search',
    'nav-saved': 'nav-saved',
    'nav-list': 'nav-list',
  }

  const handleSubmit = async () => {
    if (isSubmitting) return
    setIsSubmitting(true)

    const extractionType = SOURCE_TO_EXTRACTION_TYPE[selectedSource] || 'search'

    try {
      // 1. Create the campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert([{
          workspace_id: workspaceId,
          linkedin_account_id: selectedAccountId,
          name: campaignName,
          description: campaignDesc,
          status: 'active',
          type: 'lead-extractor',
          settings: {
            source: selectedSource,
            target_url: url,
            enrichment: enrichOptions
          }
        }])
        .select()
        .single()

      if (campaignError) throw campaignError

      // 2. Queue the action for the extension
      const { data: queuedAction, error: queueError } = await supabase
        .from('action_queue')
        .insert([{
          workspace_id: workspaceId,
          linkedin_account_id: selectedAccountId,
          campaign_id: campaign.id,
          action_type: 'scrapeLeads',
          payload: {
            url: url,
            campaignId: campaign.id,
            extractionType,
            enrichment: enrichOptions,
            action_queue_id: null, // Placeholder initially
          },
          status: 'pending'
        }])
        .select()
        .single()

      if (queueError) throw queueError

      // Update the payload with the actual action_queue_id
      const { error: updatePayloadError } = await supabase
        .from('action_queue')
        .update({
          payload: {
            url: url,
            campaignId: campaign.id,
            extractionType,
            enrichment: enrichOptions,
            action_queue_id: queuedAction.id, // Now set the actual ID
          },
        })
        .eq('id', queuedAction.id)
        .eq('workspace_id', workspaceId) // Add workspace_id for RLS

      if (updatePayloadError) throw updatePayloadError

      toast.success('Extraction started! Check the extension for progress.')
      onOpenChange(false)
      // Reset state
      setStep(1)
      setUrl('')
      setCampaignName('')
      setCampaignDesc('')
    } catch (error) {
      console.error('Error starting extraction:', error)
      toast.error(`Failed to start extraction: ${error.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            {SOURCES.map((source) => (
              <SourceCard
                key={source.id}
                {...source}
                isActive={selectedSource === source.id}
                onClick={() => setSelectedSource(source.id)}
              />
            ))}
          </div>
        )
      case 2:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-white font-semibold flex items-center justify-center gap-2">
                <Database className="h-5 w-5 text-purple-500" /> Select LinkedIn Account
              </h3>
              <p className="text-xs text-[#94a3b8] mt-1">
                Choose the account that will perform the extraction.
              </p>
            </div>

            {isLoadingAccounts ? (
              <div className="py-20 text-center">
                <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-sm text-[#94a3b8]">Loading your accounts...</p>
              </div>
            ) : !accounts || accounts.length === 0 ? (
              <div className="py-12 px-6 text-center border border-dashed border-white/10 rounded-2xl bg-white/2">
                <Building2 className="h-12 w-12 text-[#94a3b8] mx-auto mb-4 opacity-20" />
                <h4 className="text-white font-medium mb-1">No Accounts Connected</h4>
                <p className="text-xs text-[#94a3b8] mb-6">
                  You need at least one connected LinkedIn account to extract leads.
                </p>
                <Button asChild className="bg-purple-600 hover:bg-purple-700 text-white">
                  <Link to="/linkedin-accounts">Connect Account</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {accounts.map((acc) => (
                  <div 
                    key={acc.id}
                    onClick={() => setSelectedAccountId(acc.id)}
                    className={cn(
                      "p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between group",
                      selectedAccountId === acc.id 
                        ? "bg-purple-600/10 border-purple-500/50" 
                        : "bg-white/5 border-white/5 hover:border-white/10"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-white/5 border border-white/10 overflow-hidden flex-shrink-0">
                        {acc.avatar_url ? (
                          <img src={acc.avatar_url} alt={acc.full_name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-xs font-bold text-[#94a3b8]">
                            {acc.full_name?.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-medium text-white truncate">{acc.full_name}</h4>
                        <p className="text-[10px] text-[#94a3b8] truncate">{acc.headline}</p>
                      </div>
                    </div>
                    
                    <div className={cn(
                      "h-5 w-5 rounded-full border flex items-center justify-center transition-colors",
                      selectedAccountId === acc.id ? "bg-purple-500 border-purple-500" : "border-white/20 group-hover:border-white/30"
                    )}>
                      {selectedAccountId === acc.id && <div className="h-2 w-2 rounded-full bg-white" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      case 3:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <label className="text-sm font-medium text-white">Search Link URLs</label>
                <span className="text-xs text-[#94a3b8]">0 URLs added</span>
              </div>
              <Input 
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.linkedin.com/search/results/people/?keywords=..."
                className="bg-[#1e1e1e] border-white/10 h-12 focus-visible:ring-purple-500"
              />
              <p className="text-xs text-red-400 flex items-center gap-1.5 px-1">
                <X className="h-3 w-3" /> Please paste the URL from your browser
              </p>
            </div>

            <Button variant="ghost" className="w-full justify-start text-purple-400 hover:text-purple-300 hover:bg-white/5 font-medium -ml-4">
              <span className="text-xl mr-2">+</span> Add Another URL
            </Button>

            <div className="border border-white/5 rounded-xl overflow-hidden bg-white/2">
              <button 
                onClick={() => setIsInstructionsOpen(!isInstructionsOpen)}
                className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center text-[#94a3b8]">
                    <Search className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-white">How to get the correct URL</span>
                </div>
                {isInstructionsOpen ? <ChevronUp className="h-4 w-4 text-[#94a3b8]" /> : <ChevronDown className="h-4 w-4 text-[#94a3b8]" />}
              </button>
              
              {isInstructionsOpen && (
                <div className="px-4 pb-4 pt-0 space-y-4">
                  <ol className="space-y-3">
                    {[
                      "Go to LinkedIn.com and log into your account",
                      "Click on the search bar at the top of the page",
                      "Type your search keywords (e.g., job titles, skills, company names)",
                      "Click 'See all people results' or press Enter",
                      "Apply any additional filters (location, industry, etc.)",
                      "Copy the URL from your browser's address bar",
                      "Paste it in the field above"
                    ].map((inst, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="flex-shrink-0 h-5 w-5 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold text-[#94a3b8]">
                          {i + 1}
                        </span>
                        <span className="text-[#94a3b8]">{inst}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="p-3 bg-white/5 rounded-lg space-y-2">
                    <p className="text-[10px] text-[#94a3b8] font-bold uppercase tracking-wider">Example URL:</p>
                    <p className="text-xs text-[#94a3b8]/60 break-all leading-relaxed font-mono">
                      https://www.linkedin.com/search/results/people/?keywords=prospeo&origin=SWITCH_SEARCH_VERTICAL&sid=mcw
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      case 4:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Campaign Name</label>
              <Input 
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g., Marketing Managers in London"
                className="bg-[#1e1e1e] border-white/10 h-12 focus-visible:ring-purple-500 text-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-white">Description (Optional)</label>
              <Input 
                value={campaignDesc}
                onChange={(e) => setCampaignDesc(e.target.value)}
                placeholder="Briefly describe the goal of this extraction"
                className="bg-[#1e1e1e] border-white/10 h-12 focus-visible:ring-purple-500 text-white"
              />
            </div>
            
            <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10 flex gap-4 mt-8">
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <Bookmark className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-white mb-1">Why name your campaign?</h4>
                <p className="text-xs text-[#94a3b8] leading-relaxed">
                  Campaigns help you organize your leads and track the performance of different search criteria over time.
                </p>
              </div>
            </div>
          </div>
        )
      case 5:
        return (
          <div className="space-y-4">
            <div 
              onClick={() => setEnrichOptions(prev => ({ ...prev, email: !prev.email }))}
              className={cn(
                "p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between group",
                enrichOptions.email ? "bg-purple-600/10 border-purple-500/50" : "bg-white/5 border-white/5 hover:border-white/10"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "h-10 w-10 rounded-lg flex items-center justify-center transition-colors",
                  enrichOptions.email ? "bg-purple-500 text-white" : "bg-white/5 text-[#94a3b8]"
                )}>
                  <Search className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-white mb-0.5">Email Discovery</h4>
                  <p className="text-xs text-[#94a3b8]">Find verified professional emails for leads</p>
                </div>
              </div>
              <div className={cn(
                "h-5 w-5 rounded border flex items-center justify-center transition-colors",
                enrichOptions.email ? "bg-purple-500 border-purple-500" : "border-white/20 group-hover:border-white/30"
              )}>
                {enrichOptions.email && <ChevronDown className="h-3 w-3 text-white transform rotate-45 border-b-2 border-r-2" style={{ border: 'none', borderBottom: '2px solid white', borderRight: '2px solid white' }} />}
                {enrichOptions.email && <div className="w-2.5 h-1.5 border-b-2 border-l-2 border-white -rotate-45 mb-0.5" />}
              </div>
            </div>

            <div 
              onClick={() => setEnrichOptions(prev => ({ ...prev, phone: !prev.phone }))}
              className={cn(
                "p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between group",
                enrichOptions.phone ? "bg-purple-600/10 border-purple-500/50" : "bg-white/5 border-white/5 hover:border-white/10"
              )}
            >
              <div className="flex items-center gap-4">
                <div className={cn(
                  "h-10 w-10 rounded-lg flex items-center justify-center transition-colors",
                  enrichOptions.phone ? "bg-purple-500 text-white" : "bg-white/5 text-[#94a3b8]"
                )}>
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-medium text-white mb-0.5">Phone Enrichment</h4>
                  <p className="text-xs text-[#94a3b8]">Identify potential phone numbers for outreach</p>
                </div>
              </div>
              <div className={cn(
                "h-5 w-5 rounded border flex items-center justify-center transition-colors",
                enrichOptions.phone ? "bg-purple-500 border-purple-500" : "border-white/20 group-hover:border-white/30"
              )}>
                 {enrichOptions.phone && <div className="w-2.5 h-1.5 border-b-2 border-l-2 border-white -rotate-45 mb-0.5" />}
              </div>
            </div>

            <div className="mt-8 p-4 rounded-xl bg-white/5 border border-white/5">
              <p className="text-xs text-[#94a3b8] italic">
                Note: Enrichment uses additional credits per successfully discovered data point.
              </p>
            </div>
          </div>
        )
      case 6:
        return (
          <div className="space-y-6">
            <div className="rounded-2xl border border-white/5 bg-white/2 overflow-hidden">
              <div className="p-4 border-b border-white/5 bg-white/2">
                <h4 className="text-sm font-medium text-white flex items-center gap-2">
                  <Bookmark className="h-4 w-4 text-purple-400" /> Review Extraction Details
                </h4>
              </div>
              <div className="p-0">
                <div className="grid grid-cols-2">
                  {[
                    { label: 'Source', value: SOURCES.find(s => s.id === selectedSource)?.title },
                    { label: 'Account', value: accounts?.find(a => a.id === selectedAccountId)?.full_name || 'Not selected' },
                    { label: 'Campaign', value: campaignName || 'Unnamed Campaign' },
                    { label: 'Target URL', value: url ? (url.length > 25 ? url.substring(0, 25) + '...' : url) : 'Not specified' },
                    { label: 'Enrichment', value: `${enrichOptions.email ? 'Emails' : ''}${enrichOptions.email && enrichOptions.phone ? ' & ' : ''}${enrichOptions.phone ? 'Phones' : ''}` || 'None' }
                  ].map((item, i) => (
                    <div key={i} className={cn(
                      "p-4 flex flex-col gap-1",
                      i < 2 && "border-b border-white/5",
                      i % 2 === 0 && "border-r border-white/5"
                    )}>
                      <span className="text-[10px] uppercase tracking-wider text-[#94a3b8] font-bold">{item.label}</span>
                      <span className="text-sm text-white truncate">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-purple-600/10 border border-purple-500/20 text-center">
              <p className="text-sm text-purple-300">
                Clicking "Confirm" will trigger the Chrome extension to begin scraping LinkedIn search results.
              </p>
            </div>
          </div>
        )
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 bg-[#0f0f0f] border-white/5 overflow-hidden flex h-[600px]">
        {/* Sidebar */}
        <div className="w-[280px] bg-[#1a1a1a] p-6 border-r border-white/5 flex flex-col">
          <div className="mb-8">
            <div className="flex items-center gap-2 text-white mb-1">
              <Sparkles className="h-5 w-5 text-purple-500" />
              <h2 className="text-lg font-bold">Extract Leads</h2>
            </div>
            <p className="text-[#94a3b8] text-xs">Create a new extraction campaign</p>
          </div>
          
          <StepIndicator currentStep={step} steps={STEPS} />
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col h-full">
          <div className="flex-1 overflow-y-auto p-8 pt-6">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold text-white">{STEPS[step-1].title}</h2>
              <DialogClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-[#94a3b8] hover:text-white hover:bg-white/5">
                  <X className="h-5 w-5" />
                </Button>
              </DialogClose>
            </div>

            {renderStepContent()}
          </div>

          <div className="p-6 border-t border-white/5 flex items-center justify-end gap-3 bg-[#0f0f0f]/80 backdrop-blur-sm">
            <Button 
              variant="ghost" 
              onClick={handleBack}
              disabled={step === 1}
              className="text-[#94a3b8] hover:text-white hover:bg-white/5 px-6"
            >
              <ChevronLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <Button 
              onClick={step === 6 ? handleSubmit : handleNext}
              disabled={isSubmitting}
              className="bg-purple-600 hover:bg-purple-700 text-white px-8 rounded-lg font-semibold shadow-lg shadow-purple-500/20 transition-all min-w-[120px]"
            >
              {isSubmitting ? 'Starting...' : step === 6 ? 'Confirm' : 'Next'} <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
