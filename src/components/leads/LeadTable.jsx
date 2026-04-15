import React from 'react'
import { 
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell 
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { User, MoreHorizontal } from 'lucide-react'
import { format } from 'date-fns'

export function LeadTable({ 
  leads, 
  isLoading, 
  selectedIds, 
  onSelectRow, 
  onSelectAll,
  onDeleteLead
}) {
  const getIcpBadge = (score) => {
    if (score === undefined || score === null) return <Badge className="bg-white/5 text-[#94a3b8] border-white/10">—</Badge>
    if (score >= 70) return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">High</Badge>
    if (score >= 40) return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Medium</Badge>
    return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Low</Badge>
  }

  return (
    <div className="rounded-lg border border-white/5 bg-[#1e1e1e] overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox 
                checked={selectedIds.length === leads.length && leads.length > 0} 
                onCheckedChange={onSelectAll} 
              />
            </TableHead>
            <TableHead>Lead</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>ICP</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="h-32 text-center text-[#94a3b8]">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-4 w-4 border-2 border-purple-500 border-t-transparent animate-spin rounded-full" />
                  <span>Loading leads...</span>
                </div>
              </TableCell>
            </TableRow>
          ) : leads.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-32 text-center text-[#94a3b8]">
                No leads found.
              </TableCell>
            </TableRow>
          ) : (
            leads.map(lead => (
              <TableRow key={lead.id || lead.profile_url} data-state={selectedIds.includes(lead.id) && "selected"}>
                <TableCell>
                  <Checkbox 
                    checked={selectedIds.includes(lead.id)} 
                    onCheckedChange={(checked) => onSelectRow(lead.id, checked)} 
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 overflow-hidden font-bold flex-shrink-0">
                      {lead.avatar_url ? (
                        <img src={lead.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        lead.full_name?.charAt(0) || <User className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-white truncate">
                        {lead.profile_url ? (
                          <a href={lead.profile_url} target="_blank" rel="noopener noreferrer" className="hover:text-purple-400 transition-colors">
                            {lead.full_name}
                          </a>
                        ) : lead.full_name}
                      </div>
                      <div className="text-xs text-[#94a3b8] truncate">{lead.title || lead.headline || ''}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-[#94a3b8]">{lead.company || '—'}</TableCell>
                <TableCell>{getIcpBadge(lead.icp_score)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize border-white/10 text-[#94a3b8]">
                    {lead.connection_status || lead.status || 'new'}
                  </Badge>
                </TableCell>
                <TableCell className="text-[#94a3b8] text-xs">
                  {lead.created_at ? format(new Date(lead.created_at), 'MMM d, yyyy') : '—'}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-[#94a3b8] hover:text-white">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="text-red-400 focus:text-red-400" onClick={() => onDeleteLead(lead.id)}>
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
