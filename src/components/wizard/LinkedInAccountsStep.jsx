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
            <h3 className="text-lg font-semibold">Rate Limits</h3>
          </div>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => updateCampaignData({
              accountLimits: {
                connectionRequests: 20,
                messages: 20,
                postLikes: 20,
                weeklyConnectionRequests: 200
              }
            })}
          >
            Reset to Safe Defaults
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-2">
          Set daily and weekly limits to maintain natural profile behavior and comply with LinkedIn's restrictions.
        </p>
        <div className="mb-6 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-xs text-amber-700 dark:text-amber-400">
            ⚠️ <strong>LinkedIn Limits:</strong> Max 100 connection requests/day and 200/week. 
            Exceeding these may result in account restrictions.
          </p>
        </div>

        <Card className="p-6 space-y-8">
          <div className="space-y-6">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Daily Limits (per account)</h4>
            <LimitSlider
              label="Connection Requests"
              value={campaignData.accountLimits.connectionRequests}
              onChange={(v) => updateLimit('connectionRequests', v)}
              min={1}
              max={100}
              recommended={20}
              description="Safe: 20-50/day. Max: 100/day"
            />
            <LimitSlider
              label="Messages Sent"
              value={campaignData.accountLimits.messages}
              onChange={(v) => updateLimit('messages', v)}
              min={1}
              max={100}
              recommended={20}
              description="Safe: 20-50/day"
            />
            <LimitSlider
              label="Post Likes"
              value={campaignData.accountLimits.postLikes}
              onChange={(v) => updateLimit('postLikes', v)}
              min={1}
              max={50}
              recommended={20}
              description="Safe: 10-30/day"
            />
          </div>

          <div className="pt-6 border-t space-y-6">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Weekly Limits</h4>
            <LimitSlider
              label="Connection Requests (Weekly)"
              value={campaignData.accountLimits.weeklyConnectionRequests || 200}
              onChange={(v) => updateLimit('weeklyConnectionRequests', v)}
              min={50}
              max={200}
              recommended={200}
              description="LinkedIn enforces 200 connection requests per week"
            />
          </div>

          <div className="pt-6 border-t">
            <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="text-blue-600 dark:text-blue-400 text-sm">
                <p className="font-medium mb-1">✨ Smart Rate Limiting Active</p>
                <ul className="text-xs space-y-1 opacity-90">
                  <li>• Actions spread across working hours with random timing</li>
                  <li>• Cross-campaign tracking prevents limit violations</li>
                  <li>• Auto-retry when rate limits are hit</li>
                  <li>• Natural 30-90 second delays between actions</li>
                </ul>
              </div>
            </div>
          </div>
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

function LimitSlider({ label, value, onChange, min, max, recommended, description }) {
  const isRecommended = value <= recommended
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <label className="text-sm font-medium">{label}</label>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {recommended && value > recommended && (
            <span className="text-xs text-amber-600 dark:text-amber-400">⚠️ High</span>
          )}
          <span className={`text-sm font-semibold px-2 py-1 rounded ${
            isRecommended 
              ? 'bg-green-500/10 text-green-700 dark:text-green-400' 
              : 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
          }`}>
            {value}
          </span>
        </div>
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
        {recommended && (
          <span className="text-green-600 dark:text-green-400">
            Recommended: {recommended}
          </span>
        )}
        <span>{max}</span>
      </div>
    </div>
  )
}
