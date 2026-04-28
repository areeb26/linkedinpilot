import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { toast } from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { Info } from 'lucide-react'

const ACCOUNT_TYPE_PRESETS = {
  free: {
    label: 'Free LinkedIn',
    dailyConnections: 15,
    weeklyConnections: 105,
    dailyMessages: 30,
    weeklyMessages: 300,
    description: 'Standard free LinkedIn account limits'
  },
  premium: {
    label: 'Premium LinkedIn',
    dailyConnections: 80,
    weeklyConnections: 200,
    dailyMessages: 100,
    weeklyMessages: 500,
    description: 'LinkedIn Premium subscription limits'
  },
  sales_navigator: {
    label: 'Sales Navigator',
    dailyConnections: 80,
    weeklyConnections: 200,
    dailyMessages: 150,
    weeklyMessages: 700,
    description: 'Sales Navigator subscription limits'
  },
  recruiter: {
    label: 'LinkedIn Recruiter',
    dailyConnections: 100,
    weeklyConnections: 200,
    dailyMessages: 200,
    weeklyMessages: 1000,
    description: 'LinkedIn Recruiter subscription limits'
  }
}

export function AccountSettingsModal({ account, open, onClose }) {
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)
  
  const [accountType, setAccountType] = useState(account?.account_type || 'free')
  const [dailyConnectionLimit, setDailyConnectionLimit] = useState(account?.daily_connection_limit || 15)
  const [weeklyConnectionLimit, setWeeklyConnectionLimit] = useState(account?.weekly_connection_limit || 105)
  const [dailyMessageLimit, setDailyMessageLimit] = useState(account?.daily_message_limit || 30)
  const [weeklyMessageLimit, setWeeklyMessageLimit] = useState(account?.weekly_message_limit || 300)

  const handleAccountTypeChange = (newType) => {
    setAccountType(newType)
    const preset = ACCOUNT_TYPE_PRESETS[newType]
    if (preset) {
      setDailyConnectionLimit(preset.dailyConnections)
      setWeeklyConnectionLimit(preset.weeklyConnections)
      setDailyMessageLimit(preset.dailyMessages)
      setWeeklyMessageLimit(preset.weeklyMessages)
    }
  }

  // Check if user has overridden the recommended limits
  const currentPreset = ACCOUNT_TYPE_PRESETS[accountType]
  const hasOverriddenLimits = currentPreset && (
    dailyConnectionLimit !== currentPreset.dailyConnections ||
    weeklyConnectionLimit !== currentPreset.weeklyConnections ||
    dailyMessageLimit !== currentPreset.dailyMessages ||
    weeklyMessageLimit !== currentPreset.weeklyMessages
  )

  // Check if limits are dangerously high
  const isDangerous = 
    dailyConnectionLimit > 100 || 
    weeklyConnectionLimit > 200 ||
    dailyMessageLimit > 150 ||
    weeklyMessageLimit > 700

  const handleSave = async () => {
    // Show confirmation if user has overridden limits or set dangerous values
    if (hasOverriddenLimits || isDangerous) {
      const confirmMessage = isDangerous
        ? '⚠️ WARNING: You have set limits that exceed LinkedIn\'s safe recommendations. This significantly increases the risk of account restrictions or bans.\n\nAre you sure you want to proceed?'
        : '⚠️ You have modified the recommended limits for this account type. Using custom limits may increase the risk of LinkedIn restrictions.\n\nAre you sure you want to proceed?'
      
      if (!confirm(confirmMessage)) {
        return
      }
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('linkedin_accounts')
        .update({
          account_type: accountType,
          daily_connection_limit: dailyConnectionLimit,
          weekly_connection_limit: weeklyConnectionLimit,
          daily_message_limit: dailyMessageLimit,
          weekly_message_limit: weeklyMessageLimit,
          updated_at: new Date().toISOString()
        })
        .eq('id', account.id)

      if (error) throw error

      toast.success('Account settings updated successfully')
      queryClient.invalidateQueries({ queryKey: ['unipile-accounts'] })
      onClose()
    } catch (error) {
      console.error('Error updating account settings:', error)
      toast.error('Failed to update account settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-full sm:max-w-[600px] lg:max-w-[700px] max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Account Settings</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Configure rate limits for {account?.full_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 py-2 sm:py-4">
          {/* Account Type Selector */}
          <div className="space-y-2">
            <Label htmlFor="account-type" className="text-foreground">Account Type</Label>
            <Select value={accountType} onValueChange={handleAccountTypeChange}>
              <SelectTrigger id="account-type" className="bg-background border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {Object.entries(ACCOUNT_TYPE_PRESETS).map(([key, preset]) => (
                  <SelectItem key={key} value={key} className="text-foreground focus:bg-secondary">
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentPreset && (
              <div className="flex items-start gap-2 p-2 sm:p-3 rounded-lg bg-info/10 border border-info/20">
                <Info className="w-4 h-4 text-info mt-0.5 flex-shrink-0" />
                <p className="text-xs text-info">{currentPreset.description}</p>
              </div>
            )}
          </div>

          {/* Connection Limits */}
          <div className="space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <h3 className="text-sm font-medium text-foreground">Connection Request Limits</h3>
              <span className="text-xs text-muted-foreground">Recommended by LinkedIn</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="daily-connections" className="text-foreground text-sm">Daily Limit</Label>
                <Input
                  id="daily-connections"
                  type="number"
                  min="1"
                  max="100"
                  value={dailyConnectionLimit}
                  onChange={(e) => setDailyConnectionLimit(parseInt(e.target.value) || 0)}
                  className={`bg-background text-foreground ${
                    dailyConnectionLimit !== currentPreset?.dailyConnections
                      ? 'border-amber-500 focus:border-amber-500'
                      : 'border-border'
                  } ${
                    dailyConnectionLimit > 100
                      ? 'border-destructive focus:border-destructive'
                      : ''
                  }`}
                />
                <p className="text-xs text-muted-foreground">
                  {accountType === 'free' ? 'Recommended: 15/day' : 'Recommended: 80/day'}
                  {dailyConnectionLimit !== currentPreset?.dailyConnections && (
                    <span className="text-amber-500 ml-1">(Modified)</span>
                  )}
                  {dailyConnectionLimit > 100 && (
                    <span className="text-destructive ml-1">(⚠️ Too High!)</span>
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="weekly-connections" className="text-foreground text-sm">Weekly Limit</Label>
                <Input
                  id="weekly-connections"
                  type="number"
                  min="1"
                  max="200"
                  value={weeklyConnectionLimit}
                  onChange={(e) => setWeeklyConnectionLimit(parseInt(e.target.value) || 0)}
                  className={`bg-background text-foreground ${
                    weeklyConnectionLimit !== currentPreset?.weeklyConnections
                      ? 'border-amber-500 focus:border-amber-500'
                      : 'border-border'
                  } ${
                    weeklyConnectionLimit > 200
                      ? 'border-destructive focus:border-destructive'
                      : ''
                  }`}
                />
                <p className="text-xs text-muted-foreground">
                  {accountType === 'free' ? 'Recommended: 105/week' : 'Maximum: 200/week'}
                  {weeklyConnectionLimit !== currentPreset?.weeklyConnections && (
                    <span className="text-amber-500 ml-1">(Modified)</span>
                  )}
                  {weeklyConnectionLimit > 200 && (
                    <span className="text-destructive ml-1">(⚠️ Too High!)</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Message Limits */}
          <div className="space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <h3 className="text-sm font-medium text-foreground">Message Limits</h3>
              <span className="text-xs text-muted-foreground">Safe automation limits</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="daily-messages" className="text-foreground text-sm">Daily Limit</Label>
                <Input
                  id="daily-messages"
                  type="number"
                  min="1"
                  max="200"
                  value={dailyMessageLimit}
                  onChange={(e) => setDailyMessageLimit(parseInt(e.target.value) || 0)}
                  className={`bg-background text-foreground ${
                    dailyMessageLimit !== currentPreset?.dailyMessages
                      ? 'border-amber-500 focus:border-amber-500'
                      : 'border-border'
                  } ${
                    dailyMessageLimit > 150
                      ? 'border-destructive focus:border-destructive'
                      : ''
                  }`}
                />
                <p className="text-xs text-muted-foreground">
                  Recommended: {accountType === 'free' ? '30' : accountType === 'premium' ? '100' : '150'}/day
                  {dailyMessageLimit !== currentPreset?.dailyMessages && (
                    <span className="text-amber-500 ml-1">(Modified)</span>
                  )}
                  {dailyMessageLimit > 150 && (
                    <span className="text-destructive ml-1">(⚠️ Too High!)</span>
                  )}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="weekly-messages" className="text-foreground text-sm">Weekly Limit</Label>
                <Input
                  id="weekly-messages"
                  type="number"
                  min="1"
                  max="1000"
                  value={weeklyMessageLimit}
                  onChange={(e) => setWeeklyMessageLimit(parseInt(e.target.value) || 0)}
                  className={`bg-background text-foreground ${
                    weeklyMessageLimit !== currentPreset?.weeklyMessages
                      ? 'border-amber-500 focus:border-amber-500'
                      : 'border-border'
                  } ${
                    weeklyMessageLimit > 700
                      ? 'border-destructive focus:border-destructive'
                      : ''
                  }`}
                />
                <p className="text-xs text-muted-foreground">
                  Recommended: {accountType === 'free' ? '300' : accountType === 'premium' ? '500' : '700'}/week
                  {weeklyMessageLimit !== currentPreset?.weeklyMessages && (
                    <span className="text-amber-500 ml-1">(Modified)</span>
                  )}
                  {weeklyMessageLimit > 700 && (
                    <span className="text-destructive ml-1">(⚠️ Too High!)</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="p-3 sm:p-4 rounded-lg bg-warning/10 border border-warning/20">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-warning mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-warning">Important Safety Information</p>
                <p className="text-xs text-warning/80">
                  Exceeding LinkedIn's limits may result in account restrictions or bans. 
                  The recommended limits are based on official Unipile documentation and industry best practices.
                  Always maintain a high acceptance rate (&gt;25%) to avoid restrictions.
                </p>
              </div>
            </div>
          </div>

          {/* Override Warning */}
          {hasOverriddenLimits && (
            <div className="p-3 sm:p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-amber-500">Custom Limits Detected</p>
                  <p className="text-xs text-amber-500/80">
                    You have modified the recommended limits for {currentPreset?.label}. 
                    Using custom limits may increase the risk of LinkedIn restrictions.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Danger Warning */}
          {isDangerous && (
            <div className="p-3 sm:p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive">⚠️ High Risk Configuration</p>
                  <p className="text-xs text-destructive/80">
                    Your limits exceed LinkedIn's safe recommendations. This significantly increases 
                    the risk of account restrictions or permanent bans. We strongly recommend using 
                    the preset limits for your account type.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 sm:gap-3 pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="w-full sm:w-auto border-border text-foreground"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-foreground"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
