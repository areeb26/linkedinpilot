import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { LeadExtractionModal } from '@/components/extractor/LeadExtractionModal'
import { useExtractions, useExtractionLeads, extractionKeys } from '@/hooks/useExtractions'
import { useCampaigns } from '@/hooks/useCampaigns'
import { useAddLeadsToCampaign } from '@/hooks/useLeads'
import { useLinkedInAccounts } from '@/hooks/useLinkedInAccounts'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { 
  Search, 
  Rocket, 
  Plus, 
  MoreHorizontal,
  ChevronLeft,
  Download,
  ExternalLink,
  FileText,
  Send,
  Trash2,
  User,
  Building2,
  MapPin,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'react-hot-toast'

export default function LeadExtractor() {
  const navigate = useNavigate()
  const [isExtractionModalOpen, setIsExtractionModalOpen] = useState(false)
  const [selectedExtraction, setSelectedExtraction] = useState(null)
  const [campaignSearch, setCampaignSearch] = useState('')
  const [addToCampaignModal, setAddToCampaignModal] = useState({ open: false, extractionId: null })
  const [deleteModal, setDeleteModal] = useState({ open: false, extractionId: null, name: '' })
  const [isDeleting, setIsDeleting] = useState(false)
  const { workspaceId } = useWorkspaceStore()
  const queryClient = useQueryClient()

  const { extractions, isLoading } = useExtractions()
  const { extraction, leads, isLoading: isDetailLoading } = useExtractionLeads(selectedExtraction)

  // Filter extractions by search
  const filteredExtractions = extractions.filter(ext => 
    ext.campaigns?.name?.toLowerCase().includes(campaignSearch.toLowerCase()) ||
    ext.linkedin_accounts?.full_name?.toLowerCase().includes(campaignSearch.toLowerCase())
  )

  const handleViewDetails = (id) => {
    setSelectedExtraction(id)
  }

  const handleBack = () => {
    setSelectedExtraction(null)
  }

  const handleExportLeads = async (extractionId) => {
    const toastId = toast.loading('Preparing export...')
    try {
      const isOrphan = extractionId === 'orphan-direct-scrape'
      let query = supabase
        .from('leads')
        .select('full_name,headline,title,company,location,profile_url,email,connection_status,icp_score,created_at')
        .eq('workspace_id', workspaceId)
      query = isOrphan
        ? query.is('action_queue_id', null).eq('source', 'prospect-extractor')
        : query.eq('action_queue_id', extractionId)
      const { data, error } = await query
      if (error) throw error
      if (!data.length) { toast.error('No leads to export', { id: toastId }); return }
      const fields = ['full_name', 'headline', 'title', 'company', 'location', 'profile_url', 'email', 'connection_status', 'icp_score', 'created_at']
      const csv = [fields.join(','), ...data.map(r => fields.map(f => JSON.stringify(r[f] ?? '')).join(','))].join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'extraction-leads.csv'; a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${data.length} leads`, { id: toastId })
    } catch (e) {
      toast.error(`Export failed: ${e.message}`, { id: toastId })
    }
  }

  const handleAddToCampaign = (extractionId) => {
    setAddToCampaignModal({ open: true, extractionId })
  }

  const openDeleteModal = (extractionId) => {
    const ext = extractions.find(e => e.id === extractionId)
    const name = ext?.campaigns?.name || 'this extraction'
    setDeleteModal({ open: true, extractionId, name })
  }

  const handleDeleteExtraction = async () => {
    const { extractionId } = deleteModal
    if (!extractionId) return
    setIsDeleting(true)
    const toastId = toast.loading('Deleting extraction...')

    // Optimistic update — remove from list immediately
    queryClient.setQueryData(extractionKeys.all(workspaceId), (old) =>
      (old ?? []).filter(e => e.id !== extractionId)
    )
    setDeleteModal({ open: false, extractionId: null, name: '' })

    try {
      // 1. Delete leads linked to this action_queue row
      await supabase
        .from('leads')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('action_queue_id', extractionId)

      // 2. Delete the action_queue row itself
      const { error: aqErr } = await supabase
        .from('action_queue')
        .delete()
        .eq('id', extractionId)
        .eq('workspace_id', workspaceId)
      if (aqErr) throw aqErr

      // 3. Delete the parent campaign record (type='prospect-extractor')
      const ext = extractions.find(e => e.id === extractionId)
      if (ext?.campaign_id) {
        await supabase
          .from('campaigns')
          .delete()
          .eq('id', ext.campaign_id)
          .eq('workspace_id', workspaceId)
      }

      toast.success('Extraction deleted', { id: toastId })
    } catch (e) {
      toast.error(`Delete failed: ${e.message}`, { id: toastId })
      // Rollback optimistic update on error
      queryClient.invalidateQueries({ queryKey: extractionKeys.all(workspaceId) })
    } finally {
      setIsDeleting(false)
    }
  }

  // Detail View
  if (selectedExtraction) {
    return (
      <ExtractionDetail 
        extraction={extraction}
        leads={leads}
        isLoading={isDetailLoading}
        onBack={handleBack}
        onAddToCampaign={() => handleAddToCampaign(selectedExtraction)}
        onExport={() => handleExportLeads(selectedExtraction)}
      />
    )
  }

  // List View
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
          <span className="text-foreground">Prospect Extractor</span>
        </div>
      </div>

      <div className="space-y-[var(--space-4)] max-w-[1400px] mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center bg-[var(--color-surface-strong)] p-[var(--space-4)] rounded-xs border border-[var(--color-border)]">
        <div>
          <h2 className="text-2xl font-bold text-[var(--color-text-on-strong)] tracking-tight">Prospect Extractor</h2>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">Extract and enrich prospects from LinkedIn searches, posts, and Sales Navigator.</p>
        </div>
        <div className="flex items-center gap-[var(--space-3)]">
          <div className="flex items-center gap-[var(--space-4)] px-[var(--space-3)] py-[var(--space-1)] bg-[var(--color-border)] rounded-xs border border-[var(--color-border)]">
            <div className="flex items-center gap-[var(--space-1)]">
              <Rocket className="h-4 w-4 text-[var(--color-surface-raised)]" />
              <span className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-widest">Credits</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-[var(--color-text-on-strong)]">990</span>
              <span className="text-[10px] text-[var(--color-text-secondary)] font-medium uppercase">credits</span>
            </div>
          </div>
          <Button
            onClick={() => setIsExtractionModalOpen(true)}
            className="px-[var(--space-4)] h-11"
          >
            <Plus className="h-5 w-5 mr-2" /> Extract Leads
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-[var(--space-3)]">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-secondary)]" />
          <Input
            placeholder="Search campaigns..."
            className="pl-10"
            value={campaignSearch}
            onChange={(e) => setCampaignSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-[var(--space-1)]">
          <Button variant="outline">All Status <span className="ml-2">▼</span></Button>
          <Button variant="outline">All Types <span className="ml-2">▼</span></Button>
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="bg-[var(--color-surface-strong)] rounded-xs border border-[var(--color-border)] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--color-border)] hover:bg-transparent">
              <TableHead className="text-[var(--color-text-secondary)] font-medium">Campaign</TableHead>
              <TableHead className="text-[var(--color-text-secondary)] font-medium">Time</TableHead>
              <TableHead className="text-[var(--color-text-secondary)] font-medium">LinkedIn Account</TableHead>
              <TableHead className="text-[var(--color-text-secondary)] font-medium">Type</TableHead>
              <TableHead className="text-[var(--color-text-secondary)] font-medium">Progress</TableHead>
              <TableHead className="text-[var(--color-text-secondary)] font-medium">Status</TableHead>
              <TableHead className="text-[var(--color-text-secondary)] font-medium w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <>
                {[...Array(3)].map((_, i) => (
                  <TableRow key={i} className="border-[var(--color-border)]">
                    <TableCell>
                      <div className="flex items-center gap-[var(--space-2)]">
                        <Skeleton className="h-8 w-8 rounded-xs" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-6 w-6 rounded-full" />
                        <Skeleton className="h-4 w-28" />
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Skeleton className="h-8 w-8 rounded" />
                        <Skeleton className="h-8 w-8 rounded" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </>
            ) : filteredExtractions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-[var(--color-text-secondary)]">
                  No extraction campaigns found.
                </TableCell>
              </TableRow>
            ) : (
              filteredExtractions.map((extraction) => (
                <TableRow key={extraction.id} className="border-[var(--color-border)] hover:bg-[var(--color-border)]">
                  <TableCell>
                    <div className="flex items-center gap-[var(--space-2)]">
                      <div className="h-8 w-8 rounded-xs bg-[var(--color-border)] flex items-center justify-center">
                        <Search className="h-4 w-4 text-[var(--color-text-secondary)]" />
                      </div>
                      <div>
                        <div className="font-medium text-[var(--color-text-on-strong)]">{extraction.campaigns?.name || 'Untitled Extraction'}</div>
                        <div className="text-xs text-[var(--color-text-secondary)]">{format(new Date(extraction.created_at), 'M/d/yyyy')}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-[var(--color-text-secondary)] text-sm">
                    {format(new Date(extraction.created_at), 'h:mm a')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-[var(--space-1)]">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={extraction.linkedin_accounts?.avatar_url} />
                        <AvatarFallback className="bg-[var(--color-surface-raised)]/10 text-[var(--color-surface-raised)] text-xs">
                          {extraction.linkedin_accounts?.full_name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[var(--color-text-on-strong)] text-sm">{extraction.linkedin_accounts?.full_name || 'Unknown Account'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-[var(--color-surface-raised)]/10 text-[var(--color-surface-raised)] border-[var(--color-surface-raised)]/20 text-xs">
                      Search Extraction
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <LeadCount extractionId={extraction.id} workspaceId={workspaceId} />
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-xs capitalize ${
                      extraction.status === 'done' || extraction.status === 'processing'
                        ? 'bg-[oklch(var(--success)/0.1)] text-[oklch(var(--success))] border-[oklch(var(--success)/0.2)]'
                        : extraction.status === 'failed'
                          ? 'bg-[oklch(var(--destructive)/0.1)] text-[oklch(var(--destructive))] border-[oklch(var(--destructive)/0.2)]'
                          : 'bg-[var(--color-border)] text-[var(--color-text-secondary)] border-[var(--color-border)]'
                    }`}>
                      {extraction.status === 'done' ? 'Finished'
                        : extraction.status === 'processing' ? 'Processing'
                        : extraction.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--color-text-secondary)] hover:text-[var(--color-text-on-strong)]">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-[var(--color-surface-strong)] border-[var(--color-border)] rounded-xs">
                        <DropdownMenuItem
                          onClick={() => handleViewDetails(extraction.id)}
                          className="text-[var(--color-text-on-strong)] focus:bg-[var(--color-border)] cursor-pointer"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-[var(--color-text-on-strong)] focus:bg-[var(--color-border)] cursor-pointer">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Source
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-[var(--color-border)]" />
                        <DropdownMenuItem
                          onClick={() => handleAddToCampaign(extraction.id)}
                          className="text-[var(--color-text-on-strong)] focus:bg-[var(--color-border)] cursor-pointer"
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Add to Campaign
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleExportLeads(extraction.id)}
                          className="text-[var(--color-text-on-strong)] focus:bg-[var(--color-border)] cursor-pointer"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export Leads
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-[var(--color-border)]" />
                        <DropdownMenuItem
                          onClick={() => openDeleteModal(extraction.id)}
                          className="text-[oklch(var(--destructive))] focus:bg-[oklch(var(--destructive)/0.08)] focus:text-[oklch(var(--destructive))] cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
        <span>Showing 1-{filteredExtractions.length} of {filteredExtractions.length} campaigns</span>
        <div className="flex items-center gap-[var(--space-1)]">
          <span>Show</span>
          <select className="bg-[var(--color-surface-strong)] border border-[var(--color-border)] rounded-xs px-2 py-1 text-[var(--color-text-on-strong)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]">
            <option>10</option>
            <option>25</option>
            <option>50</option>
          </select>
          <span>per page</span>
        </div>
      </div>

      <LeadExtractionModal
        isOpen={isExtractionModalOpen}
        onOpenChange={(open) => {
          setIsExtractionModalOpen(open)
          // When modal closes, invalidate so new extraction appears immediately
          if (!open) queryClient.invalidateQueries({ queryKey: extractionKeys.all(workspaceId) })
        }}
      />

      <AddToCampaignModal
        extractionId={addToCampaignModal.extractionId}
        workspaceId={workspaceId}
        isOpen={addToCampaignModal.open}
        onClose={() => setAddToCampaignModal({ open: false, extractionId: null })}
      />

      <DeleteConfirmDialog
        open={deleteModal.open}
        name={deleteModal.name}
        isDeleting={isDeleting}
        onConfirm={handleDeleteExtraction}
        onCancel={() => setDeleteModal({ open: false, extractionId: null, name: '' })}
      />
      </div>
    </div>
  )
}

// Extraction Detail Component
function ExtractionDetail({ extraction, leads, isLoading, onBack, onAddToCampaign, onExport }) {
  if (isLoading || !extraction) {
    return (
      <div className="min-h-screen bg-background">
        {/* Breadcrumb Skeleton */}
        <div className="px-6 py-3 border-b border-border bg-background">
          <Skeleton className="h-4 w-64" />
        </div>
        
        {/* Header Skeleton */}
        <div className="space-y-[var(--space-4)] max-w-[1400px] mx-auto p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-20" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-64" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>

          {/* Stats Cards Skeleton */}
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-[var(--color-surface-strong)] border border-[var(--color-border)] rounded-xs p-4">
                <Skeleton className="h-3 w-24 mb-2" />
                <Skeleton className="h-8 w-16" />
              </div>
            ))}
          </div>

          {/* Table Skeleton */}
          <div className="bg-[var(--color-surface-strong)] border border-[var(--color-border)] rounded-xs p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-4 items-center">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Target lead count — stored in action_queue payload or campaign settings
  const targetLeads =
    extraction.payload?.maxLeads ||
    extraction.payload?.max_leads ||
    extraction.campaigns?.settings?.max_leads ||
    null

  return (
    <div className="space-y-[var(--space-4)] max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-[var(--space-3)]">
          <Button variant="ghost" onClick={onBack} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-on-strong)]">
            <ChevronLeft className="h-5 w-5 mr-1" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-[var(--color-text-on-strong)]">
              {extraction.campaigns?.name || 'Untitled Extraction'}
            </h2>
            <div className="flex items-center gap-[var(--space-1)] mt-1">
              <span className="text-[var(--color-text-secondary)] text-sm">
                Created {format(new Date(extraction.created_at), 'MMM d, yyyy')}
              </span>
              <Badge className="bg-[var(--color-surface-raised)]/10 text-[var(--color-surface-raised)] border-[var(--color-surface-raised)]/20 text-xs">
                Search Extraction
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-[var(--space-2)]">
          <Button variant="outline" onClick={onExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={onAddToCampaign}>
            <Send className="h-4 w-4 mr-2" />
            Add to Campaign
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[var(--space-3)]">
        <div className="bg-[var(--color-surface-strong)] rounded-xs border border-[var(--color-border)] p-[var(--space-4)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[var(--color-text-secondary)] text-sm">Leads Found</p>
              <p className="text-3xl font-bold text-[var(--color-text-on-strong)] mt-1">
                {leads.length}
                {targetLeads ? (
                  <span className="text-lg font-medium text-[var(--color-text-secondary)]">
                    {' '}/ {targetLeads}
                  </span>
                ) : null}
              </p>
            </div>
            <div className="h-12 w-12 rounded-xs bg-[oklch(var(--info)/0.1)] flex items-center justify-center">
              <User className="h-6 w-6 text-[oklch(var(--info))]" />
            </div>
          </div>
        </div>
        <div className="bg-[var(--color-surface-strong)] rounded-xs border border-[var(--color-border)] p-[var(--space-4)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[var(--color-text-secondary)] text-sm">Status</p>
              <p className="text-3xl font-bold text-[var(--color-text-on-strong)] mt-1">
                {extraction.status === 'done' ? 'Finished' : extraction.status}
              </p>
            </div>
            <div className="h-12 w-12 rounded-xs bg-[oklch(var(--success)/0.1)] flex items-center justify-center">
              <div className="h-6 w-6 rounded-full bg-[oklch(var(--success))] flex items-center justify-center">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-[var(--color-surface-strong)] rounded-xs border border-[var(--color-border)] p-[var(--space-4)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[var(--color-text-secondary)] text-sm">Account Used</p>
              <div className="flex items-center gap-[var(--space-1)] mt-1">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={extraction.linkedin_accounts?.avatar_url} />
                  <AvatarFallback className="bg-[var(--color-surface-raised)]/10 text-[var(--color-surface-raised)]">
                    {extraction.linkedin_accounts?.full_name?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[var(--color-text-on-strong)] font-medium">
                  {extraction.linkedin_accounts?.full_name || 'Unknown Account'}
                </span>
              </div>
              <p className="text-[var(--color-text-secondary)] text-xs mt-1">LinkedIn Account</p>
            </div>
          </div>
        </div>
      </div>

      {/* Extracted Leads Section */}
      <div className="bg-[var(--color-surface-strong)] rounded-xs border border-[var(--color-border)] overflow-hidden">
        <div className="p-[var(--space-4)] border-b border-[var(--color-border)] flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-[var(--color-text-on-strong)]">Extracted Leads</h3>
            <p className="text-[var(--color-text-secondary)] text-sm">
              {leads.length}{targetLeads ? ` / ${targetLeads}` : ''} leads found
            </p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-secondary)]" />
            <Input placeholder="Search leads..." className="pl-10" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[var(--color-border)] hover:bg-transparent">
                {['Contact', 'Headline', 'Title', 'Company', 'Location'].map(h => (
                  <TableHead key={h} className="text-[var(--color-text-secondary)] font-medium">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-[var(--color-text-secondary)]">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-4 w-4 border-2 border-[var(--color-surface-raised)] border-t-transparent animate-spin rounded-full" />
                      <span>Loading leads...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : leads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-[var(--color-text-secondary)]">
                    No leads found for this extraction.
                  </TableCell>
                </TableRow>
              ) : (
                leads.map((lead) => {
                  // Detect if full_name is actually a real person name or a job title/headline fallback.
                  // Real names: 2 words, each starting with capital, no special chars like | @ /
                  // Job titles: contain |, @, /, or match title/headline exactly
                  const looksLikeName = (s) => {
                    if (!s || s === 'Unknown' || s === 'LinkedIn Member' || s === 'LinkedIn User') return false
                    if (/[|@\/\\]/.test(s)) return false  // job title separators
                    if (s === lead.title || s === lead.headline) return false
                    // Must have at least 2 words and look like a proper name
                    const words = s.trim().split(/\s+/)
                    return words.length >= 2 && words.every(w => /^[A-Z\u00C0-\u024F]/.test(w))
                  }

                  const hasRealName = looksLikeName(lead.full_name)
                  
                  // Always show the full_name if it exists, even if it doesn't look like a "real" name
                  // Only fall back to title/company if full_name is truly empty or generic
                  const displayName = lead.full_name && 
                    lead.full_name !== 'Unknown' && 
                    lead.full_name !== 'LinkedIn Member' && 
                    lead.full_name !== 'LinkedIn User'
                    ? lead.full_name
                    : (lead.title && lead.company && lead.title !== lead.company
                        ? `${lead.title} · ${lead.company}`
                        : lead.title || 'LinkedIn Member')

                  const avatarInitial = lead.full_name && lead.full_name !== 'Unknown'
                    ? lead.full_name.charAt(0).toUpperCase()
                    : (lead.title?.charAt(0)?.toUpperCase() || '?')

                  return (
                    <TableRow key={lead.id} className="border-[var(--color-border)] hover:bg-[var(--color-border)]">

                      {/* Contact — name + avatar only */}
                      <TableCell className="min-w-[200px]">
                        <div className="flex items-center gap-[var(--space-2)]">
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarImage src={lead.avatar_url} />
                            <AvatarFallback className="bg-[var(--color-surface-raised)]/10 text-[var(--color-surface-raised)] text-sm font-semibold">
                              {avatarInitial}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            {/* Name row */}
                            <div className="flex items-center gap-1">
                              {(() => {
                                // Validate the stored profile_url before linking
                                // Accept any URL that starts with http and contains linkedin.com
                                const isValidUrl = lead.profile_url && 
                                  lead.profile_url.startsWith('http') && 
                                  lead.profile_url.includes('linkedin.com')
                                
                                return isValidUrl ? (
                                  <a
                                    href={lead.profile_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-medium truncate max-w-[150px] hover:text-[var(--color-surface-raised)] transition-colors text-[var(--color-text-on-strong)]"
                                    title={displayName}
                                  >
                                    {displayName}
                                  </a>
                                ) : (
                                  <span className="text-sm font-medium truncate max-w-[150px] text-[var(--color-text-on-strong)]">
                                    {displayName}
                                  </span>
                                )
                              })()}
                              {/* LinkedIn icon */}
                              <svg className="h-3.5 w-3.5 text-[oklch(var(--info))] shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                              </svg>
                            </div>
                            {/* Show headline as subtitle */}
                            {lead.headline && (
                              <p className="text-xs text-[var(--color-text-secondary)] truncate max-w-[150px] mt-0.5">
                                {lead.headline}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Headline — full headline text */}
                      <TableCell className="max-w-[260px]">
                        <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 leading-snug">
                          {lead.headline || '—'}
                        </p>
                      </TableCell>

                      {/* Title */}
                      <TableCell className="max-w-[160px]">
                        <span className="text-sm text-[var(--color-text-on-strong)] truncate block">
                          {lead.title || '—'}
                        </span>
                      </TableCell>

                      {/* Company */}
                      <TableCell className="max-w-[160px]">
                        <div className="flex items-center gap-1 text-[var(--color-text-on-strong)]">
                          {lead.company ? (
                            <>
                              <Building2 className="h-3.5 w-3.5 text-[var(--color-text-secondary)] shrink-0" />
                              <span className="text-sm truncate">{lead.company}</span>
                            </>
                          ) : (
                            <span className="text-sm text-[var(--color-text-secondary)]">—</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Location */}
                      <TableCell className="max-w-[140px]">
                        <div className="flex items-center gap-1 text-[var(--color-text-on-strong)]">
                          {lead.location ? (
                            <>
                              <MapPin className="h-3.5 w-3.5 text-[var(--color-text-secondary)] shrink-0" />
                              <span className="text-sm truncate">{lead.location}</span>
                            </>
                          ) : (
                            <span className="text-sm text-[var(--color-text-secondary)]">—</span>
                          )}
                        </div>
                      </TableCell>

                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

// ── Delete Confirmation Dialog ────────────────────────────────────────────────
function DeleteConfirmDialog({ open, name, isDeleting, onConfirm, onCancel }) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !isDeleting) onCancel() }}>
      <DialogContent className="sm:max-w-md rounded-xs bg-[var(--color-surface-strong)] border border-[var(--color-border)]">
        <DialogHeader>
          <div className="flex items-center gap-[var(--space-2)] mb-[var(--space-1)]">
            {/* Red warning icon */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xs bg-[oklch(var(--destructive)/0.1)] border border-[oklch(var(--destructive)/0.2)]">
              <Trash2 className="h-5 w-5 text-[oklch(var(--destructive))]" aria-hidden="true" />
            </div>
            <DialogTitle className="text-[var(--color-text-on-strong)] text-lg font-bold">
              Delete extraction
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="space-y-[var(--space-2)] py-[var(--space-1)]">
          <p className="text-sm text-[var(--color-text-on-strong)]">
            You are about to permanently delete{' '}
            <span className="font-semibold">"{name}"</span>.
          </p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            This will also remove all leads associated with this extraction. This action cannot be undone.
          </p>

          {/* Warning callout */}
          <div className="flex items-start gap-[var(--space-2)] p-[var(--space-2)] rounded-xs bg-[oklch(var(--destructive)/0.06)] border border-[oklch(var(--destructive)/0.15)]">
            <svg className="h-4 w-4 text-[oklch(var(--destructive))] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-xs text-[oklch(var(--destructive))] font-medium leading-relaxed">
              All extracted leads will be permanently deleted from your database.
            </p>
          </div>
        </div>

        <DialogFooter className="flex gap-[var(--space-2)] pt-[var(--space-2)]">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isDeleting}
            isLoading={isDeleting}
            className="flex-1 bg-[oklch(var(--destructive))] text-white hover:brightness-110 focus-visible:ring-[oklch(var(--destructive))]"
          >
            {isDeleting ? 'Deleting…' : 'Delete extraction'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddToCampaignModal({ extractionId, workspaceId, isOpen, onClose }) {
  const [selectedCampaignId, setSelectedCampaignId] = useState('')
  const { data: campaigns = [] } = useCampaigns()
  const addMutation = useAddLeadsToCampaign()

  const activeCampaigns = campaigns.filter(c => c.status === 'active' || c.status === 'draft')

  const handleConfirm = async () => {
    if (!selectedCampaignId || !extractionId) return
    const toastId = toast.loading('Adding leads to campaign...')
    try {
      const isOrphan = extractionId === 'orphan-direct-scrape'
      let query = supabase.from('leads').select('id').eq('workspace_id', workspaceId)
      query = isOrphan
        ? query.is('action_queue_id', null).eq('source', 'prospect-extractor')
        : query.eq('action_queue_id', extractionId)
      const { data: extractionLeads, error } = await query
      if (error) throw error
      const campaign = campaigns.find(c => c.id === selectedCampaignId)
      await addMutation.mutateAsync({
        campaignId: selectedCampaignId,
        leadIds: extractionLeads.map(l => l.id),
        linkedinAccountId: campaign?.linkedin_account_id ?? null,
      })
      toast.dismiss(toastId)
      setSelectedCampaignId('')
      onClose()
    } catch (e) {
      toast.error(`Failed: ${e.message}`, { id: toastId })
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[var(--color-surface-strong)] border-[var(--color-border)] text-[var(--color-text-on-strong)] sm:max-w-md rounded-xs">
        <DialogHeader>
          <DialogTitle className="text-[var(--color-text-on-strong)]">Add Leads to Campaign</DialogTitle>
        </DialogHeader>
        <div className="py-[var(--space-3)]">
          <Select value={selectedCampaignId} onValueChange={setSelectedCampaignId}>
            <SelectTrigger className="bg-[var(--color-border)] border-[var(--color-border)] text-[var(--color-text-on-strong)]">
              <SelectValue placeholder="Select a campaign..." />
            </SelectTrigger>
            <SelectContent className="bg-[var(--color-surface-strong)] border-[var(--color-border)] rounded-xs">
              {activeCampaigns.length === 0 ? (
                <SelectItem value="__none__" disabled className="text-[var(--color-text-secondary)]">No campaigns available</SelectItem>
              ) : (
                activeCampaigns.map(c => (
                  <SelectItem key={c.id} value={c.id} className="text-[var(--color-text-on-strong)] focus:bg-[var(--color-border)]">
                    {c.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!selectedCampaignId || addMutation.isPending} onClick={handleConfirm}>
            {addMutation.isPending ? 'Adding...' : 'Add to Campaign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// LeadCount component
function LeadCount({ extractionId, workspaceId }) {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!workspaceId) return
    const fetchCount = async () => {
      const isOrphan = extractionId === 'orphan-direct-scrape'
      if (isOrphan) {
        const { count: leadCount, error } = await supabase
          .from('leads').select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId).is('action_queue_id', null).eq('source', 'prospect-extractor')
        if (!error) setCount(leadCount || 0)
        setLoading(false)
        return
      }
      const { data: extractionData } = await supabase
        .from('action_queue').select('created_at').eq('id', extractionId).single()
      if (extractionData) {
        const { count: leadCount, error } = await supabase
          .from('leads').select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId).eq('action_queue_id', extractionId)
        if (!error) setCount(leadCount || 0)
      }
      setLoading(false)
    }
    fetchCount()
  }, [extractionId, workspaceId])

  if (loading) return <span className="text-[var(--color-text-secondary)] text-sm">-</span>
  return (
    <span className="text-[oklch(var(--success))] text-sm">
      {count} lead{count !== 1 ? 's' : ''} found
    </span>
  )
}
