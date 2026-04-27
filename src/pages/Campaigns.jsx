import { useState } from 'react'
import { useCampaigns, useDuplicateCampaign, useDeleteCampaign, useUpdateCampaign } from '@/hooks/useCampaigns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Plus, Search, Loader2, Sparkles, Eye, Copy, Trash2, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

// Status badge config — all using design tokens
const statusStyles = {
  active: {
    dot:    'bg-[oklch(var(--success))]',
    text:   'text-[oklch(var(--success))]',
    bg:     'bg-[oklch(var(--success)/0.1)]',
    border: 'border-[oklch(var(--success)/0.25)]',
  },
  paused: {
    dot:    'bg-[oklch(var(--warning))]',
    text:   'text-[oklch(var(--warning))]',
    bg:     'bg-[oklch(var(--warning)/0.1)]',
    border: 'border-[oklch(var(--warning)/0.25)]',
  },
  draft: {
    dot:    'bg-[var(--color-text-secondary)]',
    text:   'text-[var(--color-text-secondary)]',
    bg:     'bg-[var(--color-border)]',
    border: 'border-[var(--color-border)]',
  },
  completed: {
    dot:    'bg-[var(--color-surface-raised)]',
    text:   'text-[var(--color-surface-raised)]',
    bg:     'bg-[var(--color-surface-raised)]/10',
    border: 'border-[var(--color-surface-raised)]/25',
  },
}

export default function Campaigns() {
  const navigate = useNavigate()
  const { data: campaigns = [], isLoading, isError, error } = useCampaigns()
  const duplicateMutation = useDuplicateCampaign()
  const deleteMutation = useDeleteCampaign()
  const updateMutation = useUpdateCampaign()
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const itemsPerPage = 10

  const handleTogglePause = async (campaign) => {
    const newStatus = campaign.status === 'active' ? 'paused' : 'active'
    await updateMutation.mutateAsync({
      id: campaign.id,
      status: newStatus
    })
  }

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesStatus = statusFilter === 'all' || campaign.status === statusFilter
    const matchesSearch =
      campaign.name.toLowerCase().includes(search.toLowerCase()) ||
      campaign.type?.toLowerCase().includes(search.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const totalPages = Math.ceil(filteredCampaigns.length / itemsPerPage)
  const paginatedCampaigns = filteredCampaigns.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  )

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'numeric', day: 'numeric', year: 'numeric',
    })
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  const formatMetric = (value, total) => {
    if (!total || total === 0) return { percent: '0.00%', ratio: '0 / 0' }
    return {
      percent: ((value / total) * 100).toFixed(2) + '%',
      ratio: `${value} / ${total}`,
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
          <span className="text-foreground">Campaigns</span>
        </div>
      </div>

      <div className="space-y-[var(--space-4)] max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-[var(--space-3)]">
        <div className="flex items-baseline gap-[var(--space-2)]">
          <h1 className="text-2xl font-bold text-[var(--color-text-on-strong)] tracking-tight">Campaigns</h1>
          <span className="text-[var(--color-text-secondary)] text-sm">{campaigns.length} campaigns</span>
        </div>
        <Button asChild>
          <Link to="/campaigns/new">
            <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
            Create new Campaign
          </Link>
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-[var(--space-3)]">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" aria-hidden="true" />
          <Input
            placeholder="Search..."
            className="pl-10"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="min-w-[160px] justify-between"
            >
              <span>Campaign status</span>
              <ChevronLeft className="w-4 h-4 rotate-[-90deg]" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-[var(--color-surface-strong)] border-[var(--color-border)] rounded-xs"
          >
            {['all', 'active', 'paused', 'draft'].map((s) => (
              <DropdownMenuItem
                key={s}
                onClick={() => setStatusFilter(s)}
                className="text-[var(--color-text-on-strong)] focus:bg-[var(--color-border)] cursor-pointer capitalize"
              >
                {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* States */}
      {isError ? (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-3">
          <p className="text-[oklch(var(--destructive))] font-semibold">Failed to load campaigns</p>
          <p className="text-[var(--color-text-secondary)] text-sm font-mono">{error?.message}</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-4">
          {/* Table Skeleton */}
          <div className="bg-[var(--color-surface-strong)] border border-[var(--color-border)] rounded-xs overflow-hidden p-6">
            <div className="space-y-4">
              {/* Header Row */}
              <div className="flex gap-4 pb-4 border-b border-[var(--color-border)]">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16 ml-auto" />
              </div>
              {/* Data Rows */}
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-4 items-center py-3">
                  <div className="flex items-center gap-3 flex-1">
                    <Skeleton className="h-2 w-2 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-16" />
                  <div className="flex gap-2 ml-auto">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : filteredCampaigns.length > 0 ? (
        <>
          {/* Table */}
          <div className="bg-[var(--color-surface-strong)] border border-[var(--color-border)] rounded-xs overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--color-border)] hover:bg-transparent">
                  {['Campaign', 'Created', 'Time', 'Conn. sent', 'Conn. accepted', 'Msg. sent', 'Reply rate', 'Actions'].map((h, i) => (
                    <TableHead
                      key={h}
                      className={cn(
                        'text-[var(--color-text-secondary)] font-semibold text-xs uppercase tracking-wider',
                        i >= 3 && i <= 6 && 'text-center',
                        i === 7 && 'text-right',
                      )}
                    >
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCampaigns.map((campaign) => {
                  const stats = campaign.stats || {}
                  const enrolled = stats.enrolled || 0
                  const connSent = stats.connectionsSent || 0
                  const connAccepted = stats.connectionsAccepted || 0
                  const msgSent = stats.messagesSent || 0
                  const replies = stats.repliesReceived || 0

                  // Use displayStatus from hook (already accounts for completed campaigns)
                  const displayStatus = campaign.displayStatus ?? campaign.status
                  const style = statusStyles[displayStatus] ?? statusStyles.draft

                  const connSentMetric     = formatMetric(connSent, enrolled)
                  const connAcceptedMetric = formatMetric(connAccepted, connSent)
                  const msgSentMetric      = formatMetric(msgSent, enrolled)
                  const replyMetric        = formatMetric(replies, msgSent)

                  return (
                    <TableRow
                      key={campaign.id}
                      className="border-[var(--color-border)] hover:bg-[var(--color-border)] transition-colors duration-[150ms]"
                    >
                      {/* Campaign name + status */}
                      <TableCell>
                        <div className="flex items-center gap-[var(--space-2)]">
                          <div className={cn('w-2 h-2 rounded-full shrink-0', style.dot)} aria-hidden="true" />
                          <div>
                            <p className="font-semibold text-[var(--color-text-on-strong)]">{campaign.name}</p>
                            <span className={cn(
                              'text-xs px-2 py-0.5 rounded-sm border',
                              style.bg, style.text, style.border,
                            )}>
                              {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="text-[var(--color-text-on-strong)]">{formatDate(campaign.created_at)}</TableCell>
                      <TableCell className="text-[var(--color-text-secondary)] text-sm">{formatTime(campaign.created_at)}</TableCell>

                      {[connSentMetric, connAcceptedMetric, msgSentMetric, replyMetric].map((m, i) => (
                        <TableCell key={i} className="text-center">
                          <div className="text-[var(--color-text-on-strong)] font-medium">{m.percent}</div>
                          <div className="text-[var(--color-text-secondary)] text-xs">{m.ratio}</div>
                        </TableCell>
                      ))}

                      {/* Actions */}
                      <TableCell>
                        <div className="flex items-center justify-end gap-[4px]">
                          {/* Pause/Resume button - only show for active or paused campaigns */}
                          {(campaign.status === 'active' || campaign.status === 'paused') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className={cn(
                                "h-8 w-8 p-0",
                                campaign.status === 'active' 
                                  ? "text-[oklch(var(--warning))] hover:text-[oklch(var(--warning))]" 
                                  : "text-[oklch(var(--success))] hover:text-[oklch(var(--success))]"
                              )}
                              onClick={() => handleTogglePause(campaign)}
                              disabled={updateMutation.isPending}
                              aria-label={campaign.status === 'active' ? `Pause ${campaign.name}` : `Resume ${campaign.name}`}
                            >
                              {campaign.status === 'active' ? (
                                <Pause className="w-4 h-4" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-[var(--color-text-secondary)] hover:text-[var(--color-text-on-strong)]"
                            asChild
                          >
                            <Link to={`/campaigns/${campaign.id}`} aria-label={`View ${campaign.name}`}>
                              <Eye className="w-4 h-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-[var(--color-text-secondary)] hover:text-[var(--color-text-on-strong)]"
                            onClick={() => duplicateMutation.mutate(campaign.id)}
                            disabled={duplicateMutation.isPending}
                            aria-label={`Duplicate ${campaign.name}`}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-[var(--color-text-secondary)] hover:text-[oklch(var(--destructive))]"
                            onClick={() => deleteMutation.mutate(campaign.id)}
                            disabled={deleteMutation.isPending}
                            aria-label={`Delete ${campaign.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--color-text-secondary)]">
                Showing {(page - 1) * itemsPerPage + 1} to {Math.min(page * itemsPerPage, filteredCampaigns.length)} of {filteredCampaigns.length} campaigns
              </p>
              <div className="flex items-center gap-[var(--space-1)]">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                </Button>
                <div className="flex items-center gap-[4px]">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                    <Button
                      key={pageNum}
                      variant={pageNum === page ? 'default' : 'outline'}
                      size="sm"
                      className="w-8 h-8 p-0"
                      onClick={() => setPage(pageNum)}
                      aria-current={pageNum === page ? 'page' : undefined}
                    >
                      {pageNum}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-[var(--space-4)]">
          <div className="w-16 h-16 rounded-xs bg-[var(--color-border)] flex items-center justify-center border border-[var(--color-border)]">
            <Sparkles className="w-8 h-8 text-[var(--color-text-secondary)]" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-[var(--color-text-on-strong)]">No campaigns found</h3>
            <p className="text-[var(--color-text-secondary)] text-sm max-w-md">
              Your outreach canvas awaits. Create your first campaign to start connecting with prospects.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/campaigns/new">
              <Plus className="w-4 h-4 mr-2" aria-hidden="true" />
              Create your first campaign
            </Link>
          </Button>
        </div>
      )}
      </div>
    </div>
  )
}
