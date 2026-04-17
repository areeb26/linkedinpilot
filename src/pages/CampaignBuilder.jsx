import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { WizardProvider, useWizard } from '@/components/wizard/WizardContext'
import { StepTabs } from '@/components/wizard/StepTabs'
import { LeadSourceStep } from '@/components/wizard/LeadSourceStep'
import { CSVUpload } from '@/components/wizard/CSVUpload'
import { LeadReview } from '@/components/wizard/LeadReview'
import { LeadExtractorStep } from '@/components/wizard/LeadExtractorStep'
import { LinkedInAccountsStep } from '@/components/wizard/LinkedInAccountsStep'
import { SequencesStep } from '@/components/wizard/SequencesStep'
import { ScheduleStep } from '@/components/wizard/ScheduleStep'

// Wrapper to provide context
export default function CampaignBuilder() {
  const { id } = useParams()
  return (
    <WizardProvider campaignId={id}>
      <CampaignBuilderContent />
    </WizardProvider>
  )
}

// Main content with access to wizard state
function CampaignBuilderContent() {
  const navigate = useNavigate()
  const { currentStep, currentStepName, campaignData, isNew } = useWizard()

  const renderStep = () => {
    // For CSV source, show upload/review substeps
    if (currentStepName === 'leads') {
      if (!campaignData.leadSource) {
        return <LeadSourceStep />
      }
      if (campaignData.leadSource === 'csv') {
        if (campaignData.leads.length === 0) {
          return <CSVUpload />
        }
        return <LeadReview />
      }
      if (campaignData.leadSource === 'extractor') {
        if (campaignData.leads.length === 0) {
          return <LeadExtractorStep />
        }
        return <LeadReview />
      }
      // Database would have its own flow
      return <LeadReview />
    }

    switch (currentStepName) {
      case 'linkedin-accounts':
        return <LinkedInAccountsStep />
      case 'sequences':
        return <SequencesStep />
      case 'schedule':
        return <ScheduleStep />
      default:
        return <LeadSourceStep />
    }
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b bg-background">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/campaigns')}
          >
            <ChevronLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <div className="h-4 w-px bg-border" />
          <div>
            <h1 className="text-lg font-semibold">
              {campaignData.name || 'New Campaign'}
            </h1>
            <p className="text-xs text-muted-foreground">
              Create and configure your outreach campaign
            </p>
          </div>
          <Badge variant="outline">
            {!campaignData.name ? 'Draft' : 'In Progress'}
          </Badge>
        </div>
        <StepTabs />
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          {renderStep()}
        </div>
      </main>
    </div>
  )
}
