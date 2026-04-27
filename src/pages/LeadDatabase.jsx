import { useState } from 'react'
import { useLeads, useDeleteLeads } from '@/hooks/useLeads'
import { ImportModal } from '@/components/ImportModal'
import { LeadFilters } from '@/components/leads/LeadFilters'
import { LeadTable } from '@/components/leads/LeadTable'
import { BulkActionBar } from '@/components/leads/BulkActionBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Upload, Download } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useLinkedInAccounts } from '@/hooks/useLinkedInAccounts'
import { useSendInvitation } from '@/hooks/useUnipileInvitations'
import { useStartDM } from '@/hooks/useUnipileMessaging'
import { useProfile } from '@/hooks/useUnipileProfiles'
import { toast } from 'react-hot-toast'

function exportToCsv(filename, rows) {
  if (!rows.length) { toast.error('No leads to export'); return }
  const fields = ['full_name', 'headline', 'title', 'company', 'location', 'profile_url', 'email', 'connection_status', 'icp_score', 'created_at']
  const header = fields.join(',')
  const body = rows.map(r => fields.map(f => JSON.stringify(r[f] ?? '')).join(',')).join('\n')
  const blob = new Blob([header + '\n' + body], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Profile Viewer Modal
// ---------------------------------------------------------------------------
function ProfileModal({ lead, accountId, onClose }) {
  const identifier = lead?.linkedin_handle || lead?.profile_url?.split('/in/')?.[1]?.replace(/\/$/, '') || null
  const { data: profile, isLoading } = useProfile(accountId, identifier)

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[var(--color-surface-strong)] border-[var(--color-border)] text-[var(--color-text-on-strong)] sm:max-w-md rounded-xs">
        <DialogHeader>
          <DialogTitle>LinkedIn Profile</DialogTitle>
        </DialogHeader>
        <div className="py-[var(--space-3)] space-y-[var(--space-2)]">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 border-2 border-[var(--color-surface-raised)] border-t-transparent animate-spin rounded-full" />
            </div>
          ) : profile?.error ? (
            <p className="text-[oklch(var(--destructive))] text-sm">{profile.error.message}</p>
          ) : profile ? (
            <div className="space-y-[var(--space-2)]">
              <div className="flex items-center gap-[var(--space-2)]">
                {profile.profile_picture_url && (
                  <img src={profile.profile_picture_url} alt="" className="w-14 h-14 rounded-xs border border-[var(--color-border)]" />
                )}
                <div>
                  <p className="font-bold text-[var(--color-text-on-strong)]">{profile.first_name} {profile.last_name}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{profile.headline}</p>
                </div>
              </div>
              {profile.location && <p className="text-xs text-[var(--color-text-secondary)]">📍 {profile.location}</p>}
              {profile.summary && <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed line-clamp-4">{profile.summary}</p>}
            </div>
          ) : (
            <p className="text-[var(--color-text-secondary)] text-sm">No profile data available.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Send Message Modal
// ---------------------------------------------------------------------------
function SendMessageModal({ lead, accountId, onClose }) {
  const [message, setMessage] = useState('')
  const startDM = useStartDM()

  const handleSend = async () => {
    if (!message.trim()) return
    const attendeeId = lead?.unipile_provider_id || lead?.linkedin_handle
    if (!attendeeId) { toast.error('No LinkedIn identifier found for this lead.'); return }
    await startDM.mutateAsync({ accountId, attendeeId, text: message })
    onClose()
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[var(--color-surface-strong)] border-[var(--color-border)] text-[var(--color-text-on-strong)] sm:max-w-md rounded-xs">
        <DialogHeader>
          <DialogTitle>Send Message to {lead?.full_name}</DialogTitle>
        </DialogHeader>
        <div className="py-[var(--space-3)] space-y-[var(--space-2)]">
          <Label className="text-[10px] uppercase tracking-widest text-[var(--color-text-secondary)] font-bold">Message</Label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write your message..."
            rows={4}
            className="w-full bg-[var(--color-border)] border border-[var(--color-border)] rounded-xs p-[var(--space-2)] text-sm text-[var(--color-text-on-strong)] placeholder:text-[var(--color-text-secondary)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!message.trim() || startDM.isPending} onClick={handleSend}>
            {startDM.isPending ? 'Sending…' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function LeadDatabase() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [icpRange, setIcpRange] = useState([0, 100])
  const [status, setStatus] = useState('all')
  const [selectedIds, setSelectedIds] = useState([])
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [profileLead, setProfileLead] = useState(null)
  const [messageLead, setMessageLead] = useState(null)
  const { workspaceId } = useWorkspaceStore()

  const { data: leadsData, isLoading } = useLeads({
    page, search, icp_min: icpRange[0], icp_max: icpRange[1], status
  })
  const deleteMutation = useDeleteLeads()
  const sendInvitation = useSendInvitation()

  // Get active Unipile account
  const { data: linkedInAccounts = [] } = useLinkedInAccounts()
  const activeAccount = linkedInAccounts.find(a => a.unipile_account_id)
  const accountId = activeAccount?.unipile_account_id ?? null

  const leads = leadsData?.data || []
  const count = leadsData?.count || 0

  const handleExport = async () => {
    const toastId = toast.loading('Preparing export...')
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('full_name,headline,title,company,location,profile_url,email,connection_status,icp_score,created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
      if (error) throw error
      exportToCsv('leads.csv', data)
      toast.success(`Exported ${data.length} leads`, { id: toastId })
    } catch (e) {
      toast.error(`Export failed: ${e.message}`, { id: toastId })
    }
  }

  const handleDelete = (ids) => {
    if (confirm(`Delete ${Array.isArray(ids) ? ids.length : 1} lead(s)?`)) {
      deleteMutation.mutate(Array.isArray(ids) ? ids : [ids], {
        onSuccess: () => setSelectedIds(prev => Array.isArray(ids) ? [] : prev.filter(id => id !== ids))
      })
    }
  }

  const handleSendInvite = (lead) => {
    if (!accountId) { toast.error('Connect a LinkedIn account first.'); return }
    const providerId = lead?.unipile_provider_id || lead?.linkedin_handle
    if (!providerId) { toast.error('No LinkedIn identifier found for this lead.'); return }
    sendInvitation.mutate({ accountId, providerId, leadId: lead.id })
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Lead Database</h1>
          <p className="text-muted-foreground text-sm mt-1">{count} total leads found</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" className="border-border" onClick={() => setIsImportModalOpen(true)}>
            <Upload className="h-4 w-4 mr-2" /> Import
          </Button>
          <Button variant="outline" size="sm" className="border-border" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
        </div>
      </div>

      <LeadFilters 
        search={search} setSearch={setSearch}
        status={status} setStatus={setStatus}
        icpRange={icpRange} setIcpRange={setIcpRange}
      />

      <LeadTable 
        leads={leads}
        isLoading={isLoading}
        selectedIds={selectedIds}
        onSelectRow={(id, checked) => setSelectedIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id))}
        onSelectAll={(checked) => setSelectedIds(checked ? leads.map(l => l.id) : [])}
        onDeleteLead={handleDelete}
        onViewProfile={accountId ? (lead) => setProfileLead(lead) : undefined}
        onSendInvite={accountId ? handleSendInvite : undefined}
        onSendMessage={accountId ? (lead) => setMessageLead(lead) : undefined}
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--color-text-secondary)]">Showing {(page-1)*50+1} to {Math.min(page*50, count)} of {count} leads</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <Button variant="outline" size="sm" disabled={page * 50 >= count} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      </div>

      <BulkActionBar 
        selectedCount={selectedIds.length}
        onClear={() => setSelectedIds([])}
        onDelete={() => handleDelete(selectedIds)}
      />

      <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />

      {/* Profile viewer modal */}
      {profileLead && accountId && (
        <ProfileModal lead={profileLead} accountId={accountId} onClose={() => setProfileLead(null)} />
      )}

      {/* Send message modal */}
      {messageLead && accountId && (
        <SendMessageModal lead={messageLead} accountId={accountId} onClose={() => setMessageLead(null)} />
      )}
    </div>
  )
}
