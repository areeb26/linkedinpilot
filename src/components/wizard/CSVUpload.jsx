import React, { useState, useCallback } from 'react'
import { useWizard } from './WizardContext'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, FileText, Check, X, Loader2, AlertCircle } from 'lucide-react'
import Papa from 'papaparse'
import { cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024

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
  const [isLoading, setIsLoading] = useState(false)
  const [parseError, setParseError] = useState(null)
  const [parsedData, setParsedData] = useState(null)
  const [columnMapping, setColumnMapping] = useState({})

  const handleFile = useCallback((file) => {
    setParseError(null)
    
    if (!file) return
    
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error('File size exceeds 10MB limit')
      return
    }
    
    // Check file type (accept .csv and text/csv)
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      toast.error('Please upload a CSV file')
      return
    }

    setIsLoading(true)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setIsLoading(false)
        
        if (results.errors.length > 0) {
          console.warn('CSV parsing warnings:', results.errors)
        }
        
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
        
        toast.success(`Loaded ${results.data.length} leads from ${file.name}`)
      },
      error: (error) => {
        setIsLoading(false)
        setParseError(error.message)
        toast.error(`Failed to parse CSV: ${error.message}`)
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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Parsing CSV file...</p>
      </div>
    )
  }

  if (!parsedData) {
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Upload CSV File</h3>
          <p className="text-sm text-muted-foreground">
            Upload a CSV file with your leads data. Maximum file size: 10MB.
          </p>
        </div>

        {parseError && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{parseError}</span>
          </div>
        )}

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
          <p className="text-xs text-muted-foreground mt-4">
            Maximum file size: 10MB
          </p>
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
