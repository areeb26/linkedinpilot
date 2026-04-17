import { useState } from 'react'
import { useLeads, useDeleteLeads } from '@/hooks/useLeads'
import { ImportModal } from '@/components/ImportModal'
import { LeadFilters } from '@/components/leads/LeadFilters'
import { LeadTable } from '@/components/leads/LeadTable'
import { BulkActionBar } from '@/components/leads/BulkActionBar'
import { Button } from '@/components/ui/button'
import { Upload, Download } from 'lucide-react'

export default function LeadDatabase() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [icpRange, setIcpRange] = useState([0, 100])
  const [status, setStatus] = useState('all')
  const [selectedIds, setSelectedIds] = useState([])
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)

  const { data: leadsData, isLoading } = useLeads({
    page, search, icp_min: icpRange[0], icp_max: icpRange[1], status
  })

  const deleteMutation = useDeleteLeads()

  const leads = leadsData?.data || []
  const count = leadsData?.count || 0

  const handleDelete = (ids) => {
    if (confirm(`Delete ${Array.isArray(ids) ? ids.length : 1} lead(s)?`)) {
      deleteMutation.mutate(Array.isArray(ids) ? ids : [ids], {
        onSuccess: () => setSelectedIds(prev => Array.isArray(ids) ? [] : prev.filter(id => id !== ids))
      })
    }
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
          <Button variant="outline" size="sm" className="border-border">
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
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-[#94a3b8]">Showing {(page-1)*50+1} to {Math.min(page*50, count)} of {count} leads</p>
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
    </div>
  )
}
