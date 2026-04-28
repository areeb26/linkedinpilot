import React, { useState } from 'react'
import { useWizard } from './WizardContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react'

// Number of leads to show per page
const ITEMS_PER_PAGE = 10

export function LeadReview() {
  const { campaignData, updateCampaignData, nextStep, prevStep } = useWizard()
  const [search, setSearch] = useState('')
  // Initialize selectedLeads from previously saved selection, or default to all leads selected
  const [selectedLeads, setSelectedLeads] = useState(() => {
    if (campaignData.selectedLeadIds?.length > 0) {
      return new Set(campaignData.selectedLeadIds)
    }
    return new Set(campaignData.leads.map(l => l.id))
  })
  const [currentPage, setCurrentPage] = useState(1)

  const handleBack = () => {
    // If leads came from CSV, clear them so CampaignBuilder shows CSVUpload again
    // Keep _csvParsedData so CSVUpload can restore the file state
    if (campaignData.leadSource === 'csv') {
      updateCampaignData({ leads: [] })
    } else {
      prevStep()
    }
  }

  const filteredLeads = campaignData.leads.filter(lead => {
    const searchLower = search.toLowerCase()
    return (
      lead.firstName?.toLowerCase().includes(searchLower) ||
      lead.lastName?.toLowerCase().includes(searchLower) ||
      lead.company?.toLowerCase().includes(searchLower) ||
      lead.linkedInUrl?.toLowerCase().includes(searchLower)
    )
  })

  const totalPages = Math.ceil(filteredLeads.length / ITEMS_PER_PAGE)
  const paginatedLeads = filteredLeads.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  const toggleLead = (id) => {
    const newSet = new Set(selectedLeads)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedLeads(newSet)
  }

  const toggleAll = () => {
    if (selectedLeads.size === paginatedLeads.length) {
      setSelectedLeads(new Set())
    } else {
      setSelectedLeads(new Set(paginatedLeads.map(l => l.id)))
    }
  }

  const handleContinue = () => {
    if (campaignData.leads.length === 0) return

    // Persist the selection so it's restored when coming back
    // Keep all leads in campaignData.leads — selection is tracked separately
    const selection = selectedLeads.size > 0
      ? Array.from(selectedLeads)
      : campaignData.leads.map(l => l.id) // nothing checked = all selected

    updateCampaignData({ selectedLeadIds: selection })
    nextStep()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Review Imported Leads</h3>
          <p className="text-sm text-muted-foreground">
            {campaignData.leads.length} leads imported from {campaignData.csvFileName || 'source'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="p-3 w-10">
                <Checkbox 
                  checked={paginatedLeads.length > 0 && selectedLeads.size === paginatedLeads.length}
                  onCheckedChange={toggleAll}
                />
              </th>
              <th className="text-left p-3 font-medium">First Name</th>
              <th className="text-left p-3 font-medium">Last Name</th>
              <th className="text-left p-3 font-medium">Company</th>
              <th className="text-left p-3 font-medium">Job Title</th>
              <th className="text-left p-3 font-medium">LinkedIn URL</th>
            </tr>
          </thead>
          <tbody>
            {paginatedLeads.map((lead) => (
              <tr key={lead.id} className="border-b last:border-b-0 hover:bg-muted/30">
                <td className="p-3">
                  <Checkbox 
                    checked={selectedLeads.has(lead.id)}
                    onCheckedChange={() => toggleLead(lead.id)}
                  />
                </td>
                <td className="p-3">{lead.firstName || '-'}</td>
                <td className="p-3">{lead.lastName || '-'}</td>
                <td className="p-3">{lead.company || '-'}</td>
                <td className="p-3">{lead.jobTitle || '-'}</td>
                <td className="p-3 max-w-xs truncate text-muted-foreground">
                  {lead.linkedInUrl || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {paginatedLeads.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No leads match your search
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredLeads.length)} of {filteredLeads.length} leads
        </p>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <Button 
            variant="outline" 
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="outline" onClick={handleBack}>
          <ChevronLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {selectedLeads.size > 0
              ? `${selectedLeads.size} leads selected`
              : campaignData.leads.length > 0
                ? `All ${campaignData.leads.length} leads selected`
                : <span className="text-destructive">No leads to add</span>
            }
          </p>
          <Button
            onClick={handleContinue}
            disabled={campaignData.leads.length === 0}
          >
            Continue to LinkedIn Accounts
          </Button>
        </div>
      </div>
    </div>
  )
}
