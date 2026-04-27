import React, { useState, useCallback, useMemo } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useDropzone } from 'react-dropzone'
import Papa from 'papaparse'
import { useImportLeads } from '@/hooks/useLeads'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Upload, X, FileText } from 'lucide-react'
import { z } from 'zod'

const DATABASE_FIELDS = [
  { key: 'full_name', label: 'Full Name' },
  { key: 'title', label: 'Job Title' },
  { key: 'company', label: 'Company' },
  { key: 'linkedin_url', label: 'LinkedIn URL' },
  { key: 'email', label: 'Email' },
  { key: 'location', label: 'Location' },
]

const leadSchema = z.object({
  full_name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal('')),
  linkedin_url: z.string().url("Invalid URL").optional().or(z.literal('')),
  title: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  status: z.string().default('new')
})

export function ImportModal({ isOpen, onClose }) {
  const [file, setFile] = useState(null)
  const [data, setData] = useState([])
  const [headers, setHeaders] = useState([])
  const [mapping, setMapping] = useState({})
  const importMutation = useImportLeads()

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0]
    setFile(file)
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setHeaders(results.meta.fields || [])
        setData(results.data.slice(0, 5))
        const newMapping = {}
        results.meta.fields.forEach(h => {
          const matched = DATABASE_FIELDS.find(f => 
            f.label.toLowerCase() === h.toLowerCase() || 
            f.key.toLowerCase() === h.toLowerCase()
          )
          if (matched) newMapping[h] = matched.key
        })
        setMapping(newMapping)
      }
    })
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false
  })

  const mappedLeads = useMemo(() => {
    return data.map(row => {
      const lead = { status: 'new' }
      Object.entries(mapping).forEach(([csvHeader, dbKey]) => {
        if (dbKey !== 'none') lead[dbKey] = row[csvHeader]
      })
      const result = leadSchema.safeParse(lead)
      return { data: lead, isValid: result.success, errors: result.success ? null : result.error.format() }
    })
  }, [data, mapping])

  const handleImport = () => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const validLeads = results.data
          .map(row => {
            const lead = { status: 'new' }
            Object.entries(mapping).forEach(([csvHeader, dbKey]) => {
              if (dbKey !== 'none') lead[dbKey] = row[csvHeader]
            })
            return lead
          })
          .filter(lead => leadSchema.safeParse(lead).success)

        if (validLeads.length === 0) {
          alert('No valid leads found in CSV.')
          return
        }

        importMutation.mutate(validLeads, {
          onSuccess: onClose
        })
      }
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Leads</DialogTitle>
          <DialogDescription>Map your CSV columns to database fields. Invalid rows will be skipped.</DialogDescription>
        </DialogHeader>

        {!file ? (
          <div {...getRootProps()} className={`mt-4 border-2 border-dashed rounded-lg p-12 text-center transition-all cursor-pointer ${
            isDragActive ? 'border-purple-500 bg-purple-500/10' : 'border-[var(--color-border)] hover:border-[var(--color-ring)]'
          }`}>
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 text-[var(--color-text-secondary)] mx-auto mb-4" />
            <p className="text-[var(--color-text-primary)] font-medium">Click or drag CSV file here</p>
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            <div className="flex items-center justify-between bg-[var(--color-input)] p-3 rounded-md border border-[var(--color-border)]">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-purple-500" />
                <span className="text-white text-sm font-medium">{file.name}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setFile(null)}><X className="h-4 w-4" /></Button>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium text-white flex items-center gap-2">
                Mapping Preview 
                {mappedLeads.some(l => !l.isValid) && <Badge variant="destructive" className="ml-2">Contains Errors</Badge>}
              </h4>
              <div className="rounded-md border border-white/10 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-white/5">
                      <TableHead>Field</TableHead>
                      {data.map((_, i) => <TableHead key={i}>Row {i+1}</TableHead>)}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {DATABASE_FIELDS.map(field => (
                      <TableRow key={field.key}>
                        <TableCell className="font-medium text-white">
                          <Select 
                            value={Object.entries(mapping).find(([_, v]) => v === field.key)?.[0] || 'none'} 
                            onValueChange={(val) => {
                              setMapping(prev => {
                                const next = { ...prev }
                                Object.keys(next).forEach(k => { if(next[k] === field.key) delete next[k] })
                                if (val !== 'none') next[val] = field.key
                                return next
                              })
                            }}
                          >
                            <SelectTrigger className="w-full text-xs h-8 bg-transparent border-none">
                              <SelectValue placeholder={`Map ${field.label}...`} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Not mapped</SelectItem>
                              {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        {mappedLeads.map((lead, i) => (
                          <TableCell key={i} className={`text-xs ${!lead.isValid && lead.errors?.[field.key] ? 'text-red-400' : 'text-[var(--color-text-secondary)]'}`}>
                            {lead.data[field.key] || '-'}
                            {!lead.isValid && lead.errors?.[field.key] && (
                              <div className="text-[10px] mt-1 text-red-500 font-medium">
                                {lead.errors[field.key]._errors[0]}
                              </div>
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            disabled={!file || importMutation.isPending} 
            onClick={handleImport}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {importMutation.isPending ? 'Importing...' : 'Confirm Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
