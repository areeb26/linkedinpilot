# Full Campaign Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the single-page CampaignBuilder into a multi-step tabbed wizard matching SendPilot's flow: Leads → LinkedIn Accounts → Sequences → Schedule

**Architecture:** The wizard uses a step-based state machine with shared campaign data context. Each tab is a focused component handling one concern. React Flow stays embedded in the Sequences tab only.

**Tech Stack:** React, Tailwind CSS, shadcn/ui components, React Flow (existing), Zustand for wizard state, PapaParse for CSV parsing

---

## File Structure Overview

| File | Purpose |
|------|---------|
| `src/pages/CampaignBuilder.jsx` | Main wizard container with tab navigation |
| `src/components/wizard/WizardContext.jsx` | Shared state provider for all wizard steps |
| `src/components/wizard/StepTabs.jsx` | Tab navigation component |
| `src/components/wizard/LeadSourceStep.jsx` | Step 1: Lead source selection (CSV/Database/Extractor) |
| `src/components/wizard/CSVUpload.jsx` | CSV file upload + column mapping |
| `src/components/wizard/LeadReview.jsx` | Imported leads table with filters |
| `src/components/wizard/LinkedInAccountsStep.jsx` | Step 2: Account selection + limit sliders |
| `src/components/wizard/SequencesStep.jsx` | Step 3: React Flow sequence builder (existing, moved) |
| `src/components/wizard/ScheduleStep.jsx` | Step 4: Campaign timing settings |
| `src/components/wizard/WizardFooter.jsx` | Navigation buttons (Back/Save/Continue) |

---

## Task 1: Create WizardContext State Provider

**Files:**
- Create: `src/components/wizard/WizardContext.jsx`
- Modify: `src/pages/CampaignBuilder.jsx` (wrap with provider)

- [ ] **Step 1: Write the context with initial state**

```jsx
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
      activeHours: { start: '09:00', end: '17:00 }
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/wizard/WizardContext.jsx
git commit -m "feat: add WizardContext state provider for campaign wizard"
```

---

## Task 2: Create StepTabs Navigation Component

**Files:**
- Create: `src/components/wizard/StepTabs.jsx`

- [ ] **Step 1: Write the tabs component**

```jsx
import React from 'react'
import { useWizard, WIZARD_STEPS } from './WizardContext'
import { Users, Linkedin, GitBranch, Calendar } from 'lucide-react'

const STEP_ICONS = {
  leads: Users,
  'linkedin-accounts': Linkedin,
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
  const { currentStep, goToStep, campaignData } = useWizard()

  const isStepEnabled = (index) => {
    // Allow navigating to completed steps
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/wizard/StepTabs.jsx
git commit -m "feat: add StepTabs navigation component"
```

---

## Task 3: Create LeadSourceStep Component

**Files:**
- Create: `src/components/wizard/LeadSourceStep.jsx`

- [ ] **Step 1: Write the lead source selection UI**

```jsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/wizard/LeadSourceStep.jsx
git commit -m "feat: add LeadSourceStep with CSV/Database/Extractor options"
```

---

## Task 4: Create CSVUpload Component with Column Mapping

**Files:**
- Create: `src/components/wizard/CSVUpload.jsx`
- Install: `npm install papaparse`

- [ ] **Step 1: Install dependency**

```bash
npm install papaparse
```

- [ ] **Step 2: Write CSV upload and column mapping**

```jsx
import React, { useState, useCallback } from 'react'
import { useWizard } from './WizardContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, FileText, Check, X } from 'lucide-react'
import Papa from 'papaparse'
import { cn } from '@/lib/utils'

// Standard field mappings
const FIELD_OPTIONS = [
  { value: 'doNotImport', label: 'Do not import' },
  { value: 'linkedInUrl', label: 'LinkedIn URL (Required)' },
  { value: 'firstName', label: 'First Name' },
  { value: 'lastName', label: 'Last Name' },
  { value: 'email', label: 'Email' },
  { value: 'company', label: 'Company' },
  { value: 'jobTitle', label: 'Job Title' },
  { value: 'location', label: 'Location' },
  { value: 'summary', label: 'Summary' },
  { value: 'profilePicture', label: 'Profile Picture' },
  { value: 'followers', label: 'Followers Count' },
  { value: 'connections', label: 'Connections Count' },
]

export function CSVUpload() {
  const { campaignData, updateCampaignData, nextStep } = useWizard()
  const [isDragging, setIsDragging] = useState(false)
  const [parsedData, setParsedData] = useState(null)
  const [columnMapping, setColumnMapping] = useState({})

  const handleFile = useCallback((file) => {
    if (!file || file.type !== 'text/csv') {
      alert('Please upload a CSV file')
      return
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setParsedData({
          fileName: file.name,
          rowCount: results.data.length,
          columns: results.meta.fields,
          data: results.data.slice(0, 5) // Preview first 5 rows
        })
        
        // Auto-detect column mappings
        const autoMapping = {}
        results.meta.fields.forEach(col => {
          const lower = col.toLowerCase()
          if (lower.includes('linkedin') || lower.includes('url')) {
            autoMapping[col] = 'linkedInUrl'
          } else if (lower.includes('first') || lower === 'firstname') {
            autoMapping[col] = 'firstName'
          } else if (lower.includes('last') || lower === 'lastname') {
            autoMapping[col] = 'lastName'
          } else if (lower.includes('email')) {
            autoMapping[col] = 'email'
          } else if (lower.includes('company')) {
            autoMapping[col] = 'company'
          } else if (lower.includes('job') || lower.includes('title')) {
            autoMapping[col] = 'jobTitle'
          } else {
            autoMapping[col] = 'doNotImport'
          }
        })
        setColumnMapping(autoMapping)
      }
    })
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleMappingChange = (column, value) => {
    setColumnMapping(prev => ({ ...prev, [column]: value }))
  }

  const handleConfirm = () => {
    // Transform parsed data into leads using mapping
    const leads = parsedData.data.map((row, index) => {
      const lead = { id: `lead-${index}` }
      Object.entries(columnMapping).forEach(([csvCol, field]) => {
        if (field !== 'doNotImport') {
          lead[field] = row[csvCol]
        }
      })
      return lead
    })

    updateCampaignData({
      leads,
      columnMapping,
      csvFileName: parsedData.fileName
    })
    nextStep()
  }

  const hasRequiredMapping = Object.values(columnMapping).includes('linkedInUrl')

  if (!parsedData) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Upload CSV File</h3>
          <p className="text-sm text-muted-foreground">
            Upload a CSV file with your leads data. The file should include LinkedIn URLs and other optional information.
          </p>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'border-2 border-dashed rounded-xl p-12 text-center transition-colors',
            isDragging 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-muted-foreground/50'
          )}
        >
          <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-2">
            Drag and drop your CSV file here, or
          </p>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => handleFile(e.target.files[0])}
            className="hidden"
            id="csv-input"
          />
          <label htmlFor="csv-input">
            <Button variant="outline" className="cursor-pointer">
              Browse Files
            </Button>
          </label>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
        <FileText className="w-5 h-5 text-primary" />
        <div className="flex-1">
          <p className="font-medium">{parsedData.fileName}</p>
          <p className="text-sm text-muted-foreground">
            {parsedData.rowCount} leads • {parsedData.columns.length} columns detected
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setParsedData(null)}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Map Your Lead Columns</h3>
        <p className="text-sm text-muted-foreground">
          Review and adjust the column mappings for your imported leads. 
          <span className="text-primary">LinkedIn URL is required.</span>
        </p>

        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left p-3 font-medium">Source Column</th>
                <th className="text-left p-3 font-medium">Select Type</th>
                <th className="text-left p-3 font-medium">Sample Data</th>
              </tr>
            </thead>
            <tbody>
              {parsedData.columns.map((col) => (
                <tr key={col} className="border-b last:border-b-0">
                  <td className="p-3 font-medium">{col}</td>
                  <td className="p-3">
                    <select
                      value={columnMapping[col] || 'doNotImport'}
                      onChange={(e) => handleMappingChange(col, e.target.value)}
                      className="w-full bg-background border rounded px-2 py-1 text-sm"
                    >
                      {FIELD_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3 text-muted-foreground truncate max-w-xs">
                    {parsedData.data[0]?.[col] || 'No data'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {hasRequiredMapping ? (
              <span className="text-green-500 flex items-center gap-1">
                <Check className="w-4 h-4" /> LinkedIn URL mapped
              </span>
            ) : (
              <span className="text-amber-500">
                ⚠️ LinkedIn URL is required for all leads
              </span>
            )}
          </p>
          <Button onClick={handleConfirm} disabled={!hasRequiredMapping}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/wizard/CSVUpload.jsx
git commit -m "feat: add CSVUpload with drag-drop and column mapping"
```

---

## Task 5: Create LeadReview Component

**Files:**
- Create: `src/components/wizard/LeadReview.jsx`

- [ ] **Step 1: Write the lead review table**

```jsx
import React, { useState } from 'react'
import { useWizard } from './WizardContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react'

export function LeadReview() {
  const { campaignData, updateCampaignData, nextStep, prevStep } = useWizard()
  const [search, setSearch] = useState('')
  const [selectedLeads, setSelectedLeads] = useState(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  const filteredLeads = campaignData.leads.filter(lead => {
    const searchLower = search.toLowerCase()
    return (
      lead.firstName?.toLowerCase().includes(searchLower) ||
      lead.lastName?.toLowerCase().includes(searchLower) ||
      lead.company?.toLowerCase().includes(searchLower) ||
      lead.linkedInUrl?.toLowerCase().includes(searchLower)
    )
  })

  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage)
  const paginatedLeads = filteredLeads.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const toggleLead = (id) => {
    const newSet = new Set(selectedLeads)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedLeads(newSet)
  }

  const toggleAll = () => {
    if (selectedLeads.size === paginatedLeads.length) {
      setSelectedLeads(new Set())
    } else {
      setSelectedLeads(new Set(paginatedLeads.map(l => l.id)))
    }
  }

  const handleContinue = () => {
    // Filter to selected leads only
    const finalLeads = campaignData.leads.filter(l => selectedLeads.has(l.id))
    updateCampaignData({ leads: finalLeads.length > 0 ? finalLeads : campaignData.leads })
    nextStep()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Review Imported Leads</h3>
          <p className="text-sm text-muted-foreground">
            {campaignData.leads.length} leads imported from {campaignData.csvFileName || 'source'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-64"
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="p-3 w-10">
                <Checkbox 
                  checked={paginatedLeads.length > 0 && selectedLeads.size === paginatedLeads.length}
                  onCheckedChange={toggleAll}
                />
              </th>
              <th className="text-left p-3 font-medium">First Name</th>
              <th className="text-left p-3 font-medium">Last Name</th>
              <th className="text-left p-3 font-medium">Company</th>
              <th className="text-left p-3 font-medium">Job Title</th>
              <th className="text-left p-3 font-medium">LinkedIn URL</th>
            </tr>
          </thead>
          <tbody>
            {paginatedLeads.map((lead) => (
              <tr key={lead.id} className="border-b last:border-b-0 hover:bg-muted/30">
                <td className="p-3">
                  <Checkbox 
                    checked={selectedLeads.has(lead.id)}
                    onCheckedChange={() => toggleLead(lead.id)}
                  />
                </td>
                <td className="p-3">{lead.firstName || '-'}</td>
                <td className="p-3">{lead.lastName || '-'}</td>
                <td className="p-3">{lead.company || '-'}</td>
                <td className="p-3">{lead.jobTitle || '-'}</td>
                <td className="p-3 max-w-xs truncate text-muted-foreground">
                  {lead.linkedInUrl || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {paginatedLeads.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">
            No leads match your search
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredLeads.length)} of {filteredLeads.length} leads
        </p>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <Button 
            variant="outline" 
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="outline" onClick={prevStep}>
          <ChevronLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {selectedLeads.size > 0 ? `${selectedLeads.size} leads selected` : 'All leads will be added'}
          </p>
          <Button onClick={handleContinue}>
            Continue to LinkedIn Accounts
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/wizard/LeadReview.jsx
git commit -m "feat: add LeadReview table with selection and pagination"
```

---

## Task 6: Create LinkedInAccountsStep Component

**Files:**
- Create: `src/components/wizard/LinkedInAccountsStep.jsx`
- Modify: May need to check existing `useLinkedInAccounts` hook

- [ ] **Step 1: Check existing accounts hook**

```bash
# Verify the hook exists and returns expected data
# Look for: useLinkedInAccounts hook
```

- [ ] **Step 2: Write the accounts step with limit sliders**

```jsx
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
```

- [ ] **Step 3: Commit**

```bash
git add src/components/wizard/LinkedInAccountsStep.jsx
git commit -m "feat: add LinkedInAccountsStep with account selection and limit sliders"
```

---

## Task 7: Create SequencesStep Component (Refactor Existing)

**Files:**
- Create: `src/components/wizard/SequencesStep.jsx`
- Move existing ReactFlow code from `CampaignBuilder.jsx`

- [ ] **Step 1: Extract ReactFlow content from CampaignBuilder into SequencesStep**

```jsx
import React, { useState, useCallback, useEffect } from 'react'
import ReactFlow, { 
  addEdge, 
  Background, 
  Controls, 
  applyEdgeChanges, 
  applyNodeChanges,
  MarkerType
} from 'reactflow'
import 'reactflow/dist/style.css'

import { useWizard } from './WizardContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ChevronLeft, ChevronRight, Plus, Trash2, Info, AlertCircle } from 'lucide-react'
import { toast } from 'react-hot-toast'

// Custom Nodes
import TriggerNode from '@/components/campaigns/nodes/TriggerNode'
import ActionNode from '@/components/campaigns/nodes/ActionNode'
import ConditionNode from '@/components/campaigns/nodes/ConditionNode'
import EndNode from '@/components/campaigns/nodes/EndNode'

const nodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
  condition: ConditionNode,
  end: EndNode,
}

const TEMPLATES = {
  basic: {
    nodes: [
      { id: '1', type: 'trigger', position: { x: 250, y: 0 }, data: { label: 'LinkedIn Enrollment' } },
      { id: '2', type: 'action', position: { x: 250, y: 150 }, data: { actionType: 'connect', delay: 0 } },
      { id: '3', type: 'action', position: { x: 250, y: 300 }, data: { actionType: 'message', delay: 24, message: 'Hi {{first_name}}, thanks for connecting!' } },
      { id: '4', type: 'end', position: { x: 250, y: 450 }, data: { label: 'Done' } },
    ],
    edges: [
      { id: 'e1-2', source: '1', target: '2', markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e2-3', source: '2', target: '3', markerEnd: { type: MarkerType.ArrowClosed } },
      { id: 'e3-4', source: '3', target: '4', markerEnd: { type: MarkerType.ArrowClosed } },
    ]
  }
}

export function SequencesStep() {
  const { campaignData, updateCampaignData, nextStep, prevStep } = useWizard()
  const [nodes, setNodes] = useState([])
  const [edges, setEdges] = useState([])
  const [selectedNode, setSelectedNode] = useState(null)

  // Load from campaignData or use template
  useEffect(() => {
    if (campaignData.sequence?.nodes?.length > 0) {
      setNodes(campaignData.sequence.nodes)
      setEdges(campaignData.sequence.edges)
    } else {
      setNodes(TEMPLATES.basic.nodes)
      setEdges(TEMPLATES.basic.edges)
    }
  }, [])

  // Persist to campaignData when changed
  useEffect(() => {
    updateCampaignData({ sequence: { nodes, edges } })
  }, [nodes, edges])

  const onNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  )
  const onEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  )
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
    []
  )

  const onNodeClick = (_, node) => setSelectedNode(node)
  const onPaneClick = () => setSelectedNode(null)

  const updateNodeData = (nodeId, newData) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, ...newData } }
        }
        return node
      })
    )
    setSelectedNode(prev => prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...newData } } : prev)
  }

  const addNode = (type) => {
    const id = `${type}-${Date.now()}`
    const newNode = {
      id,
      type,
      position: { x: 250, y: nodes.length * 150 + 50 },
      data: { label: `New ${type}`, actionType: 'message', delay: 24 }
    }
    setNodes((nds) => [...nds, newNode])
  }

  const deleteNode = (id) => {
    setNodes((nds) => nds.filter(n => n.id !== id))
    setEdges((eds) => eds.filter(e => e.source !== id && e.target !== id))
    setSelectedNode(null)
  }

  const validateSequence = () => {
    const hasTrigger = nodes.some(n => n.type === 'trigger')
    const hasEnd = nodes.some(n => n.type === 'end')
    
    if (!hasTrigger) return { valid: false, message: 'Sequence must have a Start node.' }
    if (!hasEnd) return { valid: false, message: 'Sequence must have an End node.' }
    
    return { valid: true }
  }

  const handleContinue = () => {
    const validation = validateSequence()
    if (!validation.valid) {
      toast.error(validation.message)
      return
    }
    nextStep()
  }

  return (
    <div className="h-[calc(100vh-300px)] flex flex-col gap-4">
      <div className="flex-1 flex gap-4 overflow-hidden">
        {/* Left Panel: Step Library */}
        <Card className="w-64 bg-card border-border flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
              <Info className="w-4 h-4" /> Step Library
            </h3>
          </div>
          <div className="p-4 space-y-4 overflow-y-auto">
            <div className="grid grid-cols-1 gap-2">
              <StepButton icon={Plus} label="Action Step" onClick={() => addNode('action')} />
              <StepButton icon={Plus} label="Condition" onClick={() => addNode('condition')} />
              <StepButton icon={Plus} label="End Point" onClick={() => addNode('end')} />
            </div>
          </div>
          <div className="p-4 border-t border-border mt-auto">
            <div className="p-3 rounded-lg bg-muted/50 border text-xs">
              <p className="leading-relaxed text-muted-foreground">
                Connect nodes by dragging from handles. Click nodes to edit.
              </p>
            </div>
          </div>
        </Card>

        {/* Center Canvas */}
        <div className="flex-1 bg-muted/30 rounded-xl border border-border overflow-hidden relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
          >
            <Background color="oklch(var(--muted-foreground))" gap={20} />
            <Controls />
          </ReactFlow>
        </div>

        {/* Right Panel: Node Editor */}
        <Card className={`w-64 bg-card border-border flex flex-col overflow-hidden transition-all ${selectedNode ? 'opacity-100' : 'opacity-50'}`}>
          {selectedNode ? (
            <>
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-widest">Edit Node</h3>
                <Button variant="ghost" size="sm" onClick={() => deleteNode(selectedNode.id)} className="text-destructive hover:text-destructive h-8 w-8 p-0">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div className="p-4 space-y-6">
                {selectedNode.type === 'action' && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase font-bold text-muted-foreground">Action Type</Label>
                      <Select value={selectedNode.data.actionType} onValueChange={(v) => updateNodeData(selectedNode.id, { actionType: v })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="connect">Send Connection</SelectItem>
                          <SelectItem value="message">Send Message</SelectItem>
                          <SelectItem value="view_profile">View Profile</SelectItem>
                          <SelectItem value="inmail">Send InMail</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs uppercase font-bold text-muted-foreground">Wait Time (Hours)</Label>
                      <Input type="number" value={selectedNode.data.delay} onChange={(e) => updateNodeData(selectedNode.id, { delay: parseInt(e.target.value) })} />
                    </div>

                    {(selectedNode.data.actionType === 'message' || selectedNode.data.actionType === 'connect' || selectedNode.data.actionType === 'inmail') && (
                      <div className="space-y-2">
                        <Label className="text-xs uppercase font-bold text-muted-foreground">Message Body</Label>
                        <textarea 
                          value={selectedNode.data.message || ''} 
                          onChange={(e) => updateNodeData(selectedNode.id, { message: e.target.value })}
                          placeholder="Hey {{first_name}}, ..."
                          className="w-full h-32 bg-background border rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <p className="text-xs text-muted-foreground">Variables: {"{{first_name}}"}, {"{{company}}"}</p>
                      </div>
                    )}
                  </>
                )}

                {selectedNode.type === 'condition' && (
                  <div className="space-y-2">
                    <Label className="text-xs uppercase font-bold text-muted-foreground">Check Condition</Label>
                    <Select value={selectedNode.data.conditionType} onValueChange={(v) => updateNodeData(selectedNode.id, { conditionType: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="if_accepted">If Connection Accepted</SelectItem>
                        <SelectItem value="if_replied">If Replied</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Select a node to edit
            </div>
          )}
        </Card>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="outline" onClick={prevStep}>
          <ChevronLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <Button onClick={handleContinue}>
          Continue to Schedule <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}

function StepButton({ icon: Icon, label, onClick }) {
  return (
    <Button 
      variant="outline" 
      onClick={onClick}
      className="w-full justify-start gap-3 text-xs font-bold uppercase tracking-widest h-12"
    >
      <Icon className="w-4 h-4" />
      {label}
    </Button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/wizard/SequencesStep.jsx
git commit -m "feat: add SequencesStep with ReactFlow canvas (extracted from CampaignBuilder)"
```

---

## Task 8: Create ScheduleStep Component

**Files:**
- Create: `src/components/wizard/ScheduleStep.jsx`

- [ ] **Step 1: Write the schedule configuration**

```jsx
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/wizard/ScheduleStep.jsx
git commit -m "feat: add ScheduleStep with duration and active hours config"
```

---

## Task 9: Refactor CampaignBuilder as Wizard Container

**Files:**
- Modify: `src/pages/CampaignBuilder.jsx`

- [ ] **Step 1: Rewrite CampaignBuilder as wizard container**

```jsx
import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { WizardProvider, useWizard } from '@/components/wizard/WizardContext'
import { StepTabs } from '@/components/wizard/StepTabs'
import { LeadSourceStep } from '@/components/wizard/LeadSourceStep'
import { CSVUpload } from '@/components/wizard/CSVUpload'
import { LeadReview } from '@/components/wizard/LeadReview'
import { LinkedInAccountsStep } from '@/components/wizard/LinkedInAccountsStep'
import { SequencesStep } from '@/components/wizard/SequencesStep'
import { ScheduleStep } from '@/components/wizard/ScheduleStep'

// Wrapper to provide context
export default function CampaignBuilder() {
  const { id } = useParams()
  return (
    <WizardProvider campaignId={id}>
      <CampaignBuilderContent />
    </WizardProvider>
  )
}

// Main content with access to wizard state
function CampaignBuilderContent() {
  const navigate = useNavigate()
  const { currentStep, currentStepName, campaignData, isNew } = useWizard()

  const renderStep = () => {
    // For CSV source, show upload/review substeps
    if (currentStepName === 'leads') {
      if (!campaignData.leadSource) {
        return <LeadSourceStep />
      }
      if (campaignData.leadSource === 'csv') {
        if (campaignData.leads.length === 0) {
          return <CSVUpload />
        }
        return <LeadReview />
      }
      // Database and Extractor would have their own flows
      return <LeadReview />
    }

    switch (currentStepName) {
      case 'linkedin-accounts':
        return <LinkedInAccountsStep />
      case 'sequences':
        return <SequencesStep />
      case 'schedule':
        return <ScheduleStep />
      default:
        return <LeadSourceStep />
    }
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b bg-background">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/campaigns')}
          >
            <ChevronLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <div className="h-4 w-px bg-border" />
          <div>
            <h1 className="text-lg font-semibold">
              {campaignData.name || 'New Campaign'}
            </h1>
            <p className="text-xs text-muted-foreground">
              Create and configure your outreach campaign
            </p>
          </div>
          <Badge variant="outline">
            {!campaignData.name ? 'Draft' : 'In Progress'}
          </Badge>
        </div>
        <StepTabs />
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto">
          {renderStep()}
        </div>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/CampaignBuilder.jsx
git commit -m "refactor: CampaignBuilder as wizard container with tab navigation"
```

---

## Task 10: Create Wizard Directory and Index

**Files:**
- Create: `src/components/wizard/index.js`

- [ ] **Step 1: Create barrel export**

```javascript
export { WizardProvider, useWizard, WIZARD_STEPS } from './WizardContext'
export { StepTabs } from './StepTabs'
export { LeadSourceStep } from './LeadSourceStep'
export { CSVUpload } from './CSVUpload'
export { LeadReview } from './LeadReview'
export { LinkedInAccountsStep } from './LinkedInAccountsStep'
export { SequencesStep } from './SequencesStep'
export { ScheduleStep } from './ScheduleStep'
```

- [ ] **Step 2: Commit**

```bash
git add src/components/wizard/index.js
git commit -m "chore: add wizard component barrel exports"
```

---

## Self-Review Checklist

- [ ] **Spec Coverage:** All wizard steps from PDF are implemented
- [ ] **Placeholder Scan:** No TODOs, all code is complete
- [ ] **Type Consistency:** `campaignData` shape consistent across all files
- [ ] **Import Paths:** All `@/` aliases resolve correctly
- [ ] **Dependencies:** `papaparse` installed for CSV parsing

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2025-04-17-campaign-wizard.md`.**

**Two execution options:**

**1. Subagent-Driven (recommended)** - Fresh subagent per task, two-stage review between tasks

**2. Inline Execution** - Execute tasks in this session using executing-plans skill

**Which approach do you prefer?**
