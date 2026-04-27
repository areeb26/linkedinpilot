import { useState, useEffect } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useWorkspaceConfig } from '@/hooks/useLeads'

export function IcpConfigModal({ isOpen, onClose }) {
  const { data: config, updateConfig, isUpdating } = useWorkspaceConfig()
  const [formData, setFormData] = useState({
    titles: '',
    industries: '',
    keywords: ''
  })

  useEffect(() => {
    if (config) {
      setFormData({
        titles: config.titles?.join(', ') || '',
        industries: config.industries?.join(', ') || '',
        keywords: config.keywords?.join(', ') || ''
      })
    }
  }, [config])

  const handleSave = () => {
    const newConfig = {
      titles: formData.titles.split(',').map(s => s.trim()).filter(Boolean),
      industries: formData.industries.split(',').map(s => s.trim()).filter(Boolean),
      keywords: formData.keywords.split(',').map(s => s.trim()).filter(Boolean)
    }
    updateConfig(newConfig, {
      onSuccess: onClose
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>ICP Configuration</DialogTitle>
          <DialogDescription>
            Define your Ideal Customer Profile. This will be used to score your extracted leads.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="titles">Target Job Titles</Label>
            <Textarea 
              id="titles"
              placeholder="CEO, Founder, CTO, VP of Sales..."
              value={formData.titles}
              onChange={(e) => setFormData(prev => ({ ...prev, titles: e.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="industries">Target Industries</Label>
            <Textarea 
              id="industries"
              placeholder="SaaS, Fintech, Healthcare..."
              value={formData.industries}
              onChange={(e) => setFormData(prev => ({ ...prev, industries: e.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="keywords">Negative Keywords</Label>
            <Textarea 
              id="keywords"
              placeholder="Intern, Student, Retired..."
              value={formData.keywords}
              onChange={(e) => setFormData(prev => ({ ...prev, keywords: e.target.value }))}
            />
            <p className="text-[10px] text-[var(--color-text-secondary)]">Comma separated values</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={isUpdating} className="bg-purple-600 hover:bg-purple-700 text-white">
            {isUpdating ? 'Saving...' : 'Save Configuration'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
