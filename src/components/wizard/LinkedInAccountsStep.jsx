import React from 'react'
import { useWizard } from './WizardContext'
import { useLinkedInAccounts } from '@/hooks/useLinkedInAccounts'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Users, ChevronLeft, ChevronRight, Save } from 'lucide-react'

export function LinkedInAccountsStep() {
  const { 
    campaignData, 
    updateCampaignData, 
    nextStep, 
    prevStep 
  } = useWizard()
  const { data: availableAccounts = [] } = useLinkedInAccounts()

  const toggleAccount = (accountId) => {
    const current = campaignData.selectedAccounts
    const updated = current.includes(accountId)
      ? current.filter(id => id !== accountId)
      : [...current, accountId]
    updateCampaignData({ selectedAccounts: updated })
  }

  const updateLimit = (key, value) => {
    updateCampaignData({
      accountLimits: { ...campaignData.accountLimits, [key]: parseInt(value) }
    })
  }

  const handleSave = () => {
    // Persist to backend if needed
    nextStep()
  }

  return (
    <div className="space-y-8">
      {/* Accounts Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Accounts to use</h3>
          </div>
          <span className="text-sm text-muted-foreground">
            {campaignData.selectedAccounts.length} selected
          </span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Select LinkedIn accounts to send messages from this campaign
        </p>

        <Card className="divide-y">
          {availableAccounts.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No LinkedIn accounts connected. Connect accounts in Settings first.
            </div>
          ) : (
            availableAccounts.map((account) => (
              <div 
                key={account.id} 
                className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors"
              >
                <Checkbox 
                  checked={campaignData.selectedAccounts.includes(account.id)}
                  onCheckedChange={() => toggleAccount(account.id)}
                />
                <Avatar className="h-10 w-10">
                  <AvatarFallback>{account.full_name?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{account.full_name}</p>
                  <p className="text-sm text-muted-foreground">{account.headline || 'Active'}</p>
                </div>
                <Button 
                  size="sm" 
                  variant={campaignData.selectedAccounts.includes(account.id) ? 'default' : 'outline'}
                  onClick={() => toggleAccount(account.id)}
                >
                  {campaignData.selectedAccounts.includes(account.id) ? 'Added' : 'Add to Campaign'}
                </Button>
              </div>
            ))
          )}
        </Card>
      </section>

      {/* Limit Ranges Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Save className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">Limit ranges</h3>
          </div>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => updateCampaignData({
              accountLimits: {
                connectionRequests: 20,
                messages: 20,
                postLikes: 20
              }
            })}
          >
            Reset
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Set daily limits for your LinkedIn activities to maintain a natural profile behavior. These limits apply per account.
        </p>

        <Card className="p-6 space-y-8">
          <LimitSlider
            label="Connection request limit (per account)"
            value={campaignData.accountLimits.connectionRequests}
            onChange={(v) => updateLimit('connectionRequests', v)}
            min={1}
            max={100}
          />
          <LimitSlider
            label="Send message limit (per account)"
            value={campaignData.accountLimits.messages}
            onChange={(v) => updateLimit('messages', v)}
            min={1}
            max={100}
          />
          <LimitSlider
            label="Like post limit (per account)"
            value={campaignData.accountLimits.postLikes}
            onChange={(v) => updateLimit('postLikes', v)}
            min={1}
            max={50}
          />
        </Card>
      </section>

      {/* Footer */}
      <div className="flex items-center justify-between pt-6 border-t">
        <Button variant="outline" onClick={prevStep}>
          <ChevronLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={() => updateCampaignData({})}
          >
            Save
          </Button>
          <Button 
            onClick={handleSave}
            disabled={campaignData.selectedAccounts.length === 0}
          >
            Continue to Sequences <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function LimitSlider({ label, value, onChange, min, max }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-sm font-semibold bg-primary/10 px-2 py-1 rounded">
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
      />
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  )
}
