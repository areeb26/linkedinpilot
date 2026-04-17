import React from 'react'
import { useWizard } from './WizardContext'
import { Card } from '@/components/ui/card'
import { Upload, Database, Search, ArrowRight } from 'lucide-react'

const LEAD_SOURCES = [
  {
    id: 'csv',
    icon: Upload,
    title: 'Upload CSV',
    description: 'Import leads from a CSV file with LinkedIn URLs and optional information.'
  },
  {
    id: 'database',
    icon: Database,
    title: 'Lead Database',
    description: 'Select from your existing leads database. Filter by tags, sources, or other criteria.'
  },
  {
    id: 'extractor',
    icon: Search,
    title: 'Lead Extractor',
    description: 'Use our LinkedIn scraper to find and collect new leads based on your search criteria and filters.'
  }
]

export function LeadSourceStep() {
  const { campaignData, updateCampaignData, nextStep } = useWizard()

  const handleSelect = (sourceId) => {
    updateCampaignData({ leadSource: sourceId })
    nextStep()
  }

  return (
    <div className="space-y-6">
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="text-xl font-semibold mb-2">Select Leads Source</h2>
        <p className="text-muted-foreground">Choose where you want to get your leads from</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
        {LEAD_SOURCES.map((source) => {
          const Icon = source.icon
          const isSelected = campaignData.leadSource === source.id

          return (
            <Card
              key={source.id}
              onClick={() => handleSelect(source.id)}
              className={`
                p-6 cursor-pointer transition-all hover:border-primary/50 hover:shadow-md
                ${isSelected ? 'border-primary ring-1 ring-primary' : ''}
              `}
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">{source.title}</h3>
              <p className="text-sm text-muted-foreground mb-4">{source.description}</p>
              <button className="text-sm text-primary flex items-center gap-1 hover:gap-2 transition-all">
                Select <ArrowRight className="w-4 h-4" />
              </button>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
