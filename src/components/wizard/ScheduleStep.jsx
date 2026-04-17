import React from 'react'
import { useWizard } from './WizardContext'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Calendar, Clock, ChevronLeft, Rocket, Save } from 'lucide-react'
import { toast } from 'react-hot-toast'

const TIMEZONES = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
]

export function ScheduleStep() {
  const { campaignData, updateCampaignData, prevStep } = useWizard()
  const navigate = useNavigate()
  const schedule = campaignData.schedule

  const updateSchedule = (key, value) => {
    updateCampaignData({
      schedule: { ...schedule, [key]: value }
    })
  }

  const handleSaveDraft = async () => {
    // TODO: Call API to save campaign
    toast.success('Campaign saved as draft')
    navigate('/campaigns')
  }

  const handleLaunch = async () => {
    // TODO: Call API to launch campaign
    toast.success('Campaign launched successfully!')
    navigate('/campaigns')
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Campaign Schedule</h2>
        <p className="text-muted-foreground">
          Configure when your campaign will run and active hours
        </p>
      </div>

      {/* Start/End Dates */}
      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Campaign Duration</h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input 
              type="date" 
              value={schedule.startDate || ''}
              onChange={(e) => updateSchedule('startDate', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>End Date (Optional)</Label>
            <Input 
              type="date" 
              value={schedule.endDate || ''}
              onChange={(e) => updateSchedule('endDate', e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch 
            checked={!schedule.endDate}
            onCheckedChange={(checked) => updateSchedule('endDate', checked ? null : schedule.endDate || '')}
          />
          <Label className="cursor-pointer">Run indefinitely (no end date)</Label>
        </div>
      </Card>

      {/* Active Hours */}
      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Active Hours</h3>
        </div>

        <div className="space-y-2">
          <Label>Timezone</Label>
          <select
            value={schedule.timezone}
            onChange={(e) => updateSchedule('timezone', e.target.value)}
            className="w-full bg-background border rounded-lg px-3 py-2"
          >
            {TIMEZONES.map(tz => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Start Time</Label>
            <Input 
              type="time" 
              value={schedule.activeHours.start}
              onChange={(e) => updateSchedule('activeHours', { ...schedule.activeHours, start: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>End Time</Label>
            <Input 
              type="time" 
              value={schedule.activeHours.end}
              onChange={(e) => updateSchedule('activeHours', { ...schedule.activeHours, end: e.target.value })}
            />
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Campaign actions will only be sent during these hours in the selected timezone.
        </p>
      </Card>

      {/* Summary */}
      <Card className="p-6 bg-muted/30">
        <h3 className="font-semibold mb-4">Campaign Summary</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Campaign Name:</span>
            <p className="font-medium">{campaignData.name || 'Untitled Campaign'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Leads:</span>
            <p className="font-medium">{campaignData.leads.length} leads</p>
          </div>
          <div>
            <span className="text-muted-foreground">LinkedIn Accounts:</span>
            <p className="font-medium">{campaignData.selectedAccounts.length} accounts</p>
          </div>
          <div>
            <span className="text-muted-foreground">Daily Connection Limit:</span>
            <p className="font-medium">{campaignData.accountLimits.connectionRequests} per account</p>
          </div>
        </div>
      </Card>

      {/* Footer */}
      <div className="flex items-center justify-between pt-6 border-t">
        <Button variant="outline" onClick={prevStep}>
          <ChevronLeft className="w-4 h-4 mr-2" /> Back to Sequences
        </Button>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleSaveDraft}>
            <Save className="w-4 h-4 mr-2" /> Save Draft
          </Button>
          <Button onClick={handleLaunch} className="bg-primary">
            <Rocket className="w-4 h-4 mr-2" /> Launch Campaign
          </Button>
        </div>
      </div>
    </div>
  )
}
