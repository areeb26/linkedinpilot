import React from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { WizardProvider, useWizard } from '@/components/wizard/WizardContext'
import { StepTabs } from '@/components/wizard/StepTabs'
import { LeadSourceStep } from '@/components/wizard/LeadSourceStep'
import { CSVUpload } from '@/components/wizard/CSVUpload'
import { LeadReview } from '@/components/wizard/LeadReview'
import { LeadExtractorStep } from '@/components/wizard/LeadExtractorStep'
import { LeadDatabaseStep } from '@/components/wizard/LeadDatabaseStep'
import { LinkedInAccountsStep } from '@/components/wizard/LinkedInAccountsStep'
import { SequencesStep } from '@/components/wizard/SequencesStep'
import { ScheduleStep } from '@/components/wizard/ScheduleStep'

// Wrapper to provide context
export default function CampaignBuilder() {
  const { id } = useParams()
  const location = useLocation()
  const initialName = location.state?.campaignName || ''
  return (
    <WizardProvider campaignId={id} initialName={initialName}>
      <CampaignBuilderContent />
    </WizardProvider>
  )
}

// Main content with access to wizard state
function CampaignBuilderContent() {
  const navigate = useNavigate()
  const { currentStep: _currentStep, currentStepName, campaignData, isLoading, prevStep, isFirstStep, isDirty, isSaving, sequenceView, setSequenceView, updateCampaignData } = useWizard()

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-64px)] flex flex-col">
        {/* Breadcrumb Skeleton */}
        <div className="px-6 py-3 border-b border-border bg-background">
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Header Skeleton */}
        <header className="flex items-center justify-between px-6 py-4 border-b bg-background">
          <div className="flex items-center gap-4">
            <Skeleton className="h-9 w-20" />
            <div className="h-4 w-px bg-border" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-64" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="flex gap-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-9 w-24" />
            ))}
          </div>
        </header>

        {/* Content Skeleton */}
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <Skeleton className="h-8 w-64" />
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          </div>
        </main>
      </div>
    )
  }

  const renderStep = () => {
    // For CSV source, show upload/review substeps
    if (currentStepName === 'leads') {
      if (!campaignData.leadSource) {
        return <LeadSourceStep />
      }
      if (campaignData.leadSource === 'existing') {
        // If existing campaign has 0 leads, let them choose a source
        if (campaignData.leads.length === 0) {
          return <LeadSourceStep />
        }
        return <LeadReview />
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
      if (campaignData.leadSource === 'database') {
        if (campaignData.leads.length === 0) {
          return <LeadDatabaseStep />
        }
        return <LeadReview />
      }
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
          <button
            onClick={() => navigate('/campaigns')}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Campaigns
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="text-foreground">{campaignData.name || 'New Campaign'}</span>
        </div>
      </div>

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b bg-background">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              if (currentStepName === 'sequences' && (sequenceView === 'builder' || sequenceView === 'templates')) {
                setSequenceView('select')
              } else if (currentStepName === 'leads' && campaignData.leadSource && campaignData.leads.length === 0) {
                // Inside a lead source sub-step (database/extractor/csv) with no leads yet → back to source picker
                updateCampaignData({ leadSource: null })
              } else if (isFirstStep) {
                navigate('/campaigns')
              } else {
                prevStep()
              }
            }}
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
            {isSaving ? 'Saving...' : isDirty ? 'Unsaved changes' : !campaignData.name ? 'Draft' : 'In Progress'}
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
