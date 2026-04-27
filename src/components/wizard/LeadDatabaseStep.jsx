import React, { useState } from 'react'
import { useWizard } from './WizardContext'
import { useLeads } from '@/hooks/useLeads'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Search, ChevronLeft, ChevronRight, Loader2, Users } from 'lucide-react'

export function LeadDatabaseStep() {
  const { updateCampaignData, nextStep, prevStep } = useWizard()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(new Set())

  const { data, isLoading } = useLeads({ search, page })
  const leads = data?.data ?? []
  const total = data?.count ?? 0
  const totalPages = Math.ceil(total / 50)

  const toggle = (id) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  const toggleAll = () => {
    if (leads.every(l => selected.has(l.id))) {
      const next = new Set(selected)
      leads.forEach(l => next.delete(l.id))
      setSelected(next)
    } else {
      const next = new Set(selected)
      leads.forEach(l => next.add(l.id))
      setSelected(next)
    }
  }

  const handleContinue = () => {
    const chosenLeads = leads
      .filter(l => selected.has(l.id))
      .map(l => ({
        id: l.id,
        firstName: l.first_name,
        lastName: l.last_name,
        full_name: l.full_name,
        headline: l.headline,
        company: l.company,
        title: l.title,
        linkedInUrl: l.profile_url,
        profile_url: l.profile_url,
        avatar_url: l.avatar_url,
        connection_status: l.connection_status,
      }))
    updateCampaignData({ leads: chosenLeads })
    nextStep()
  }

  const allPageSelected = leads.length > 0 && leads.every(l => selected.has(l.id))

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-1">Select from Lead Database</h2>
        <p className="text-muted-foreground text-sm">Pick leads from your existing database to enroll in this campaign</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, company, title..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9"
          />
        </div>
        {selected.size > 0 && (
          <Badge variant="secondary">{selected.size} selected</Badge>
        )}
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <Users className="w-10 h-10 text-muted-foreground" />
            <p className="font-medium">No leads found</p>
            <p className="text-sm text-muted-foreground">Try a different search or import leads first.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/30">
              <tr>
                <th className="p-3 w-10">
                  <Checkbox checked={allPageSelected} onCheckedChange={toggleAll} />
                </th>
                <th className="p-3 text-left font-medium text-muted-foreground">Name</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Company</th>
                <th className="p-3 text-left font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => (
                <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/20 cursor-pointer" onClick={() => toggle(lead.id)}>
                  <td className="p-3" onClick={e => e.stopPropagation()}>
                    <Checkbox checked={selected.has(lead.id)} onCheckedChange={() => toggle(lead.id)} />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-7 h-7">
                        <AvatarImage src={lead.avatar_url} />
                        <AvatarFallback className="text-xs">{lead.first_name?.[0]}{lead.last_name?.[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{lead.full_name || `${lead.first_name} ${lead.last_name}`}</p>
                        <p className="text-xs text-muted-foreground">{lead.title}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">{lead.company || '—'}</td>
                  <td className="p-3">
                    <Badge variant="outline" className="text-xs capitalize">{lead.connection_status || 'none'}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="icon" onClick={() => setPage(p => p - 1)} disabled={page === 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="icon" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="outline" onClick={prevStep}>
          <ChevronLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button onClick={handleContinue} disabled={selected.size === 0} className="bg-primary">
          Continue with {selected.size} lead{selected.size !== 1 ? 's' : ''} <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
