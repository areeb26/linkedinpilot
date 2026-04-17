import React, { createContext, useContext, useState } from 'react'

const WizardContext = createContext(null)

export const WIZARD_STEPS = ['leads', 'linkedin-accounts', 'sequences', 'schedule']

export function WizardProvider({ children, campaignId }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [campaignData, setCampaignData] = useState({
    name: '',
    leadSource: null, // 'csv' | 'database' | 'extractor'
    leads: [], // Array of lead objects
    columnMapping: {}, // { linkedInUrl: 'linkedinUrl', firstName: 'firstName', ... }
    selectedAccounts: [], // Array of account IDs
    accountLimits: {
      connectionRequests: 20,
      messages: 20,
      postLikes: 20
    },
    sequence: { nodes: [], edges: [] },
    schedule: {
      startDate: null,
      endDate: null,
      timezone: 'UTC',
      activeHours: { start: '09:00', end: '17:00' }
    }
  })
  const [isDirty, setIsDirty] = useState(false)

  const updateCampaignData = (updates) => {
    setCampaignData(prev => ({ ...prev, ...updates }))
    setIsDirty(true)
  }

  const goToStep = (stepIndex) => {
    if (stepIndex >= 0 && stepIndex < WIZARD_STEPS.length) {
      setCurrentStep(stepIndex)
    }
  }

  const nextStep = () => goToStep(currentStep + 1)
  const prevStep = () => goToStep(currentStep - 1)

  const value = {
    currentStep,
    currentStepName: WIZARD_STEPS[currentStep],
    campaignData,
    updateCampaignData,
    isDirty,
    setIsDirty,
    goToStep,
    nextStep,
    prevStep,
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === WIZARD_STEPS.length - 1
  }

  return (
    <WizardContext.Provider value={value}>
      {children}
    </WizardContext.Provider>
  )
}

export const useWizard = () => {
  const context = useContext(WizardContext)
  if (!context) throw new Error('useWizard must be used within WizardProvider')
  return context
}
