import React from 'react'
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { User, MoreHorizontal, UserPlus, MessageSquare, Eye } from 'lucide-react'
import { format } from 'date-fns'

export function LeadTable({
  leads,
  isLoading,
  selectedIds,
  onSelectRow,
  onSelectAll,
  onDeleteLead,
  onViewProfile,
  onSendInvite,
  onSendMessage,
}) {
  const getIcpBadge = (score) => {
    if (score === undefined || score === null)
      return <Badge className="bg-[var(--color-border)] text-[var(--color-text-secondary)] border-[var(--color-border)]">—</Badge>
    if (score >= 70)
      return <Badge className="bg-[oklch(var(--success)/0.1)] text-[oklch(var(--success))] border-[oklch(var(--success)/0.2)]">High</Badge>
    if (score >= 40)
      return <Badge className="bg-[oklch(var(--warning)/0.1)] text-[oklch(var(--warning))] border-[oklch(var(--warning)/0.2)]">Medium</Badge>
    return <Badge className="bg-[oklch(var(--destructive)/0.1)] text-[oklch(var(--destructive))] border-[oklch(var(--destructive)/0.2)]">Low</Badge>
  }

  return (
    <div className="rounded-xs border border-[var(--color-border)] bg-[var(--color-surface-strong)] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-[var(--color-border)]">
            <TableHead className="w-12">
              <Checkbox
                checked={selectedIds.length === leads.length && leads.length > 0}
                onCheckedChange={onSelectAll}
              />
            </TableHead>
            <TableHead className="text-[var(--color-text-secondary)]">Lead</TableHead>
            <TableHead className="text-[var(--color-text-secondary)]">Company</TableHead>
            <TableHead className="text-[var(--color-text-secondary)]">ICP</TableHead>
            <TableHead className="text-[var(--color-text-secondary)]">Status</TableHead>
            <TableHead className="text-[var(--color-text-secondary)]">Date</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i} className="border-[var(--color-border)]">
                  <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
                </TableRow>
              ))}
            </>
          ) : leads.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-32 text-center text-[var(--color-text-secondary)]">
                No leads found.
              </TableCell>
            </TableRow>
          ) : (
            leads.map(lead => (
              <TableRow
                key={lead.id || lead.profile_url}
                className="border-[var(--color-border)] hover:bg-[var(--color-border)]"
                data-state={selectedIds.includes(lead.id) && 'selected'}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedIds.includes(lead.id)}
                    onCheckedChange={(checked) => onSelectRow(lead.id, checked)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-[var(--space-2)]">
                    <div className="h-8 w-8 rounded-xs bg-[var(--color-surface-raised)]/10 flex items-center justify-center text-[var(--color-surface-raised)] overflow-hidden font-bold flex-shrink-0">
                      {lead.avatar_url ? (
                        <img src={lead.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        lead.full_name?.charAt(0) || <User className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-[var(--color-text-on-strong)] truncate">
                        {lead.profile_url ? (
                          <a
                            href={lead.profile_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-[var(--color-surface-raised)] transition-colors"
                          >
                            {lead.full_name}
                          </a>
                        ) : lead.full_name}
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)] truncate">{lead.title || lead.headline || ''}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-[var(--color-text-secondary)]">{lead.company || '—'}</TableCell>
                <TableCell>{getIcpBadge(lead.icp_score)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize border-[var(--color-border)] text-[var(--color-text-secondary)]">
                    {lead.connection_status || lead.status || 'new'}
                  </Badge>
                </TableCell>
                <TableCell className="text-[var(--color-text-secondary)] text-xs">
                  {lead.created_at ? format(new Date(lead.created_at), 'MMM d, yyyy') : '—'}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--color-text-secondary)] hover:text-[var(--color-text-on-strong)]">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-[var(--color-surface-strong)] border-[var(--color-border)] rounded-xs">
                      {onViewProfile && (
                        <DropdownMenuItem
                          className="text-[var(--color-text-on-strong)] focus:bg-[var(--color-border)] cursor-pointer"
                          onClick={() => onViewProfile(lead)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Profile
                        </DropdownMenuItem>
                      )}
                      {onSendInvite && (
                        <DropdownMenuItem
                          className="text-[var(--color-text-on-strong)] focus:bg-[var(--color-border)] cursor-pointer"
                          onClick={() => onSendInvite(lead)}
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          Send Invite
                        </DropdownMenuItem>
                      )}
                      {onSendMessage && (
                        <DropdownMenuItem
                          className="text-[var(--color-text-on-strong)] focus:bg-[var(--color-border)] cursor-pointer"
                          onClick={() => onSendMessage(lead)}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Send Message
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator className="bg-[var(--color-border)]" />
                      <DropdownMenuItem
                        className="text-[oklch(var(--destructive))] focus:text-[oklch(var(--destructive))] cursor-pointer"
                        onClick={() => onDeleteLead(lead.id)}
                      >
                        Delete Lead
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
  )
}
