import React from 'react'
import { useWizard, WIZARD_STEPS } from './WizardContext'
import { Users, Link2, GitBranch, Calendar } from 'lucide-react'

const STEP_ICONS = {
  leads: Users,
  'linkedin-accounts': Link2,
  sequences: GitBranch,
  schedule: Calendar
}

const STEP_LABELS = {
  leads: 'Leads',
  'linkedin-accounts': 'LinkedIn Accounts',
  sequences: 'Sequences',
  schedule: 'Schedule'
}

export function StepTabs() {
  const { currentStep, goToStep, campaignData, isNew } = useWizard()

  const isStepEnabled = (index) => {
    // For existing campaigns, allow navigation to all steps
    if (!isNew) return true
    
    // For new campaigns, allow navigating to completed steps or if leads are added
    return index <= currentStep || campaignData.leads.length > 0
  }

  return (
    <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
      {WIZARD_STEPS.map((step, index) => {
        const Icon = STEP_ICONS[step]
        const isActive = index === currentStep
        const isCompleted = index < currentStep
        const enabled = isStepEnabled(index)

        return (
          <button
            key={step}
            onClick={() => enabled && goToStep(index)}
            disabled={!enabled}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
              ${isActive 
                ? 'bg-primary text-primary-foreground' 
                : isCompleted
                  ? 'text-foreground hover:bg-muted'
                  : 'text-muted-foreground cursor-not-allowed'
              }
            `}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{STEP_LABELS[step]}</span>
            {isCompleted && <span className="text-xs">✓</span>}
          </button>
        )
      })}
    </div>
  )
}
