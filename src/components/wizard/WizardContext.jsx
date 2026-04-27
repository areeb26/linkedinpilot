import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useCampaign, useCreateCampaign, useUpdateCampaign } from '@/hooks/useCampaigns'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { toast } from 'react-hot-toast'

const WizardContext = createContext(null)

export const WIZARD_STEPS = ['leads', 'linkedin-accounts', 'sequences', 'schedule']

// Helper to get today's date in yyyy-mm-dd format
const getTodayString = () => {
  const today = new Date()
  return today.toISOString().split('T')[0]
}

const DEFAULT_CAMPAIGN_DATA = {
  name: '',
  leadSource: null,
  leads: [],
  columnMapping: {},
  selectedAccounts: [],
  accountLimits: {
    connectionRequests: 20,
    messages: 20,
    postLikes: 20,
    weeklyConnectionRequests: 200
  },
  sequence: { nodes: [], edges: [] },
  schedule: {
    startDate: getTodayString(),
    endDate: null,
    timezone: 'UTC',
    activeHours: { start: '09:00', end: '17:00' }
  }
}

export function WizardProvider({ children, campaignId }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [campaignData, setCampaignData] = useState(DEFAULT_CAMPAIGN_DATA)
  const [isDirty, setIsDirty] = useState(false)
  const [seeded, setSeeded] = useState(!campaignId) // new campaigns are immediately ready
  const [savedCampaignId, setSavedCampaignId] = useState(campaignId)
  const [isSaving, setIsSaving] = useState(false)

  const { workspaceId } = useWorkspaceStore()
  const { data: existingCampaign } = useCampaign(campaignId)
  const createCampaign = useCreateCampaign()
  const updateCampaign = useUpdateCampaign()

  // Seed wizard state from DB when editing an existing campaign
  useEffect(() => {
    if (!campaignId || !existingCampaign || seeded) return

    const settings = existingCampaign.settings || {}
    const scheduleSettings = settings.schedule || {}
    const dailyLimits = settings.dailyLimits || {}

    setCampaignData({
      ...DEFAULT_CAMPAIGN_DATA,
      name: existingCampaign.name || '',
      leadSource: 'existing',
      selectedAccounts: existingCampaign.linkedin_account_id
        ? [existingCampaign.linkedin_account_id]
        : [],
      accountLimits: {
        connectionRequests: dailyLimits.connectionRequests ?? existingCampaign.daily_limit ?? 20,
        messages: dailyLimits.messages ?? 20,
        postLikes: dailyLimits.postLikes ?? 20,
        weeklyConnectionRequests: dailyLimits.weeklyConnectionRequests ?? existingCampaign.weekly_limit ?? 200,
      },
      sequence: existingCampaign.sequence_json || { nodes: [], edges: [] },
      schedule: {
        startDate: scheduleSettings.startDate || null,
        endDate: scheduleSettings.endDate || null,
        timezone: existingCampaign.timezone || 'UTC',
        activeHours: scheduleSettings.activeHours || { start: '09:00', end: '17:00' },
      },
    })
    
    // Determine which step to open based on campaign status
    // For active/paused campaigns, open Schedule tab (last step)
    // For draft campaigns, open LinkedIn Accounts tab (step 1)
    const initialStep = (existingCampaign.status === 'active' || existingCampaign.status === 'paused') 
      ? 3  // Schedule step (last step)
      : 1  // LinkedIn Accounts step
    
    setCurrentStep(initialStep)
    setSeeded(true)
  }, [campaignId, existingCampaign, seeded])

  const updateCampaignData = (updates) => {
    setCampaignData(prev => ({ ...prev, ...updates }))
    setIsDirty(true)
  }

  // Auto-save campaign as draft when data changes
  const saveDraft = useCallback(async () => {
    if (!isDirty || isSaving || !workspaceId) return

    setIsSaving(true)
    try {
      if (savedCampaignId) {
        // Update existing campaign - don't change status if it's already active/paused
        const updates = {
          name: campaignData.name || 'Untitled Campaign',
          settings: {
            dailyLimits: campaignData.accountLimits,
            schedule: campaignData.schedule,
          },
          sequence_json: campaignData.sequence,
          timezone: campaignData.schedule.timezone,
          linkedin_account_id: campaignData.selectedAccounts[0] || null,
        }
        
        // Only set status to draft if campaign is new (not active/paused)
        if (existingCampaign?.status === 'draft' || !existingCampaign) {
          updates.status = 'draft'
        }

        console.log('[WizardContext] Updating campaign:', savedCampaignId, updates)
        await updateCampaign.mutateAsync({
          id: savedCampaignId,
          ...updates,
        })
      } else {
        // Create new draft
        const campaignPayload = {
          name: campaignData.name || 'Untitled Campaign',
          status: 'draft',
          type: 'outreach',
          workspace_id: workspaceId,
          settings: {
            dailyLimits: campaignData.accountLimits,
            schedule: campaignData.schedule,
          },
          sequence_json: campaignData.sequence,
          timezone: campaignData.schedule.timezone,
          linkedin_account_id: campaignData.selectedAccounts[0] || null,
        }

        console.log('[WizardContext] Creating new campaign:', campaignPayload)
        const newCampaign = await createCampaign.mutateAsync(campaignPayload)
        setSavedCampaignId(newCampaign.id)
        // Update URL to include campaign ID without reloading
        window.history.replaceState({}, '', `/campaigns/${newCampaign.id}/edit`)
      }

      setIsDirty(false)
      console.log('[WizardContext] Draft saved successfully')
    } catch (error) {
      console.error('[WizardContext] Failed to save draft:', error)
      // Log more details about the error
      if (error.message) console.error('[WizardContext] Error message:', error.message)
      if (error.details) console.error('[WizardContext] Error details:', error.details)
      if (error.hint) console.error('[WizardContext] Error hint:', error.hint)
      toast.error('Failed to save draft')
    } finally {
      setIsSaving(false)
    }
  }, [isDirty, isSaving, workspaceId, campaignData, savedCampaignId, existingCampaign, createCampaign, updateCampaign])

  // Auto-save when data changes (debounced)
  useEffect(() => {
    if (!isDirty) return

    const timeoutId = setTimeout(() => {
      saveDraft()
    }, 2000) // Save 2 seconds after last change

    return () => clearTimeout(timeoutId)
  }, [isDirty, saveDraft])

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
    isSaving,
    saveDraft,
    goToStep,
    nextStep,
    prevStep,
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === WIZARD_STEPS.length - 1,
    isNew: !campaignId && !savedCampaignId,
    campaignId: savedCampaignId || campaignId || null,
    isLoading: !!campaignId && !seeded,
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
