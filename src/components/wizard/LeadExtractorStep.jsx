import React, { useState } from 'react'
import { useWizard } from './WizardContext'
import { useExtractions, useExtractionLeads } from '@/hooks/useExtractions'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export function LeadExtractorStep() {
  const { campaignData, updateCampaignData, nextStep, prevStep } = useWizard()
  const { extractions, isLoading: isLoadingExtractions } = useExtractions()
  const [selectedExtractionId, setSelectedExtractionId] = useState(campaignData.extractionId || null)
  const [showNewExtraction, setShowNewExtraction] = useState(false)

  // Fetch leads when extraction is selected
  const { leads: extractionLeads, isLoading: isLoadingLeads } = useExtractionLeads(selectedExtractionId)

  const handleSelectExtraction = (extractionId) => {
    setSelectedExtractionId(extractionId)
  }

  const handleContinue = () => {
    if (selectedExtractionId && extractionLeads.length > 0) {
      // Transform leads to match wizard format
      const formattedLeads = extractionLeads.map((lead, index) => ({
        id: lead.id || `extracted-${index}`,
        firstName: lead.first_name || lead.firstName || '',
        lastName: lead.last_name || lead.lastName || '',
        full_name: lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || '',
        linkedInUrl: lead.profile_url || lead.linkedin_url || lead.linkedInUrl || '',
        company: lead.company || '',
        jobTitle: lead.title || lead.jobTitle || '',
        email: lead.email || '',
        location: lead.location || '',
        headline: lead.headline || '',
        avatar_url: lead.avatar_url || '',
        source: 'prospect-extractor'
      }))

      updateCampaignData({
        leads: formattedLeads,
        extractionId: selectedExtractionId,
        leadSource: 'extractor'
      })
      nextStep()
    }
  }

  const getStatusBadge = (status) => {
    const variants = {
      pending: 'bg-yellow-500/10 text-yellow-500',
      processing: 'bg-blue-500/10 text-blue-500',
      done: 'bg-green-500/10 text-green-500',
      failed: 'bg-red-500/10 text-red-500'
    }
    return (
      <Badge className={variants[status] || variants.pending}>
        {status}
      </Badge>
    )
  }

  if (isLoadingExtractions) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading extractions...</p>
      </div>
    )
  }

  if (showNewExtraction) {
    return (
      <div className="space-y-6">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-xl font-semibold mb-2">New Lead Extraction</h2>
          <p className="text-muted-foreground">
            Configure a new LinkedIn search to extract leads
          </p>
        </div>

        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">
            Use the Prospect Extractor page to create a new extraction, then return here to select it.
          </p>
          <Button onClick={() => setShowNewExtraction(false)}>
            Back to Extraction List
          </Button>
        </Card>

        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={() => setShowNewExtraction(false)}>
            <ChevronLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Select Lead Extraction</h3>
          <p className="text-sm text-muted-foreground">
            Choose from your existing lead extractions or create a new one
          </p>
        </div>
        <Button variant="outline" onClick={() => setShowNewExtraction(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Extraction
        </Button>
      </div>

      {extractions.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">
            No extractions found. Create your first extraction to get started.
          </p>
          <Button onClick={() => setShowNewExtraction(true)}>
            <Plus className="w-4 h-4 mr-2" /> Create Extraction
          </Button>
        </Card>
      ) : (
        <Card className="divide-y">
          {extractions.map((extraction) => (
            <div
              key={extraction.id}
              onClick={() => handleSelectExtraction(extraction.id)}
              className={`
                flex items-center gap-4 p-4 cursor-pointer transition-colors
                ${selectedExtractionId === extraction.id ? 'bg-primary/5' : 'hover:bg-muted/30'}
              `}
            >
              <Checkbox 
                checked={selectedExtractionId === extraction.id}
                onCheckedChange={() => handleSelectExtraction(extraction.id)}
              />
              <Avatar className="h-10 w-10">
                <AvatarFallback>
                  {extraction.linkedin_accounts?.full_name?.[0] || 'E'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">
                    {extraction.campaigns?.name || 'Lead Extraction'}
                  </p>
                  {getStatusBadge(extraction.status)}
                </div>
                <p className="text-sm text-muted-foreground">
                  {extraction.linkedin_accounts?.full_name || 'Unknown Account'} •
                  {' '}{formatDistanceToNow(new Date(extraction.created_at), { addSuffix: true })}
                </p>
              </div>
              {extraction._orphan && (
                <Badge variant="outline">Direct Scrape</Badge>
              )}
            </div>
          ))}
        </Card>
      )}

      {selectedExtractionId && (
        <div className="flex items-center gap-2 text-sm">
          {isLoadingLeads ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-muted-foreground">Loading leads...</span>
            </>
          ) : extractionLeads.length > 0 ? (
            <span className="text-green-500">
              ✓ {extractionLeads.length} leads ready to import
            </span>
          ) : (
            <span className="text-amber-500">
              ⚠️ No leads found in this extraction
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="outline" onClick={() => updateCampaignData({ leadSource: null })}>
          <ChevronLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button 
          onClick={handleContinue}
          disabled={!selectedExtractionId || isLoadingLeads || extractionLeads.length === 0}
        >
          Continue to LinkedIn Accounts
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
