import { useState, useRef } from 'react'
import { useUploadLeads } from '@/hooks/useCampaigns'
import { Button } from '@/components/ui/button'
import { Upload, X, FileText, AlertCircle } from 'lucide-react'

// Flexible column name → schema field mapping
const COLUMN_MAP = {
  profile_url: ['profile_url', 'linkedin_url', 'linkedin', 'url', 'profile'],
  first_name:  ['first_name', 'firstname', 'first'],
  last_name:   ['last_name', 'lastname', 'last'],
  full_name:   ['full_name', 'fullname', 'name'],
  headline:    ['headline', 'bio', 'summary'],
  company:     ['company', 'company_name', 'organization', 'employer'],
  title:       ['title', 'job_title', 'position', 'role'],
  email:       ['email', 'email_address'],
  location:    ['location', 'city', 'country'],
}

function mapHeader(header) {
  const normalized = header.toLowerCase().trim().replace(/\s+/g, '_')
  for (const [field, aliases] of Object.entries(COLUMN_MAP)) {
    if (aliases.includes(normalized)) return field
  }
  return null
}

function parseCSVLine(line) {
  const values = []
  let current = ''
  let inQuotes = false
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  values.push(current.trim())
  return values
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []

  const rawHeaders = parseCSVLine(lines[0]).map(h => h.replace(/^["']|["']$/g, ''))
  const mappedHeaders = rawHeaders.map(mapHeader)

  return lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    const row = {}
    mappedHeaders.forEach((field, i) => {
      if (field) row[field] = values[i]?.replace(/^["']|["']$/g, '').trim() || ''
    })
    return row
  }).filter(row => row.profile_url)
}

const TEMPLATE_CSV = [
  'profile_url,first_name,last_name,headline,company,title,email,location',
  'https://linkedin.com/in/johndoe,John,Doe,Software Engineer,Acme Inc,Senior Engineer,john@acme.com,New York',
  'https://linkedin.com/in/janedoe,Jane,Doe,Product Manager,Beta Corp,PM,jane@beta.com,San Francisco',
].join('\n')

export default function LeadUploadModal({ campaignId, onClose }) {
  const [step, setStep] = useState('upload')
  const [parsedLeads, setParsedLeads] = useState([])
  const [error, setError] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)
  const uploadLeads = useUploadLeads()

  const handleFile = (file) => {
    if (!file) return
    if (!file.name.endsWith('.csv')) {
      setError('Only .csv files are supported')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const leads = parseCSV(e.target.result)
      if (leads.length === 0) {
        setError('No valid leads found. CSV must have a profile_url (or linkedin_url) column.')
        return
      }
      setError(null)
      setParsedLeads(leads)
      setStep('preview')
    }
    reader.readAsText(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'leads_template.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const handleImport = async () => {
    await uploadLeads.mutateAsync({ campaignId, leads: parsedLeads })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#1e1e1e] border border-white/5 rounded-xl w-full max-w-2xl mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="text-foreground font-semibold">Upload Leads</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {step === 'upload' ? (
            <>
              <div
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                  isDragging ? 'border-primary bg-primary/5' : 'border-white/10 hover:border-primary/40'
                }`}
              >
                <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-foreground font-medium mb-1">Drop CSV here or click to browse</p>
                <p className="text-muted-foreground text-sm">
                  Required column: <code className="text-primary bg-primary/10 px-1 rounded">profile_url</code>
                </p>
                <p className="text-muted-foreground text-xs mt-2">
                  Optional: first_name, last_name, headline, company, title, email, location
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={e => handleFile(e.target.files[0])}
              />

              {error && (
                <div className="mt-3 flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <button
                onClick={downloadTemplate}
                className="mt-4 flex items-center gap-2 text-primary text-sm hover:underline"
              >
                <FileText className="w-4 h-4" />
                Download CSV template
              </button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground text-sm mb-4">
                <span className="text-foreground font-medium">{parsedLeads.length} leads</span> detected — preview (first 5 rows):
              </p>

              <div className="overflow-x-auto rounded-lg border border-white/5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.03]">
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">Name</th>
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">Company / Title</th>
                      <th className="text-left px-3 py-2 text-muted-foreground font-medium">Profile URL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedLeads.slice(0, 5).map((lead, i) => (
                      <tr key={i} className="border-b border-white/5 last:border-0">
                        <td className="px-3 py-2 text-foreground">
                          {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.full_name || '—'}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {[lead.company, lead.title].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className="px-3 py-2 text-primary truncate max-w-[200px]">
                          {lead.profile_url}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {parsedLeads.length > 5 && (
                <p className="text-muted-foreground text-xs mt-2">
                  …and {parsedLeads.length - 5} more
                </p>
              )}

              <div className="flex items-center justify-between mt-5">
                <button
                  onClick={() => { setStep('upload'); setParsedLeads([]) }}
                  className="text-muted-foreground text-sm hover:text-foreground transition-colors"
                >
                  ← Back
                </button>
                <Button
                  onClick={handleImport}
                  disabled={uploadLeads.isPending}
                  className="bg-primary hover:bg-purple-700 text-white"
                >
                  {uploadLeads.isPending ? 'Importing…' : `Import ${parsedLeads.length} Lead${parsedLeads.length !== 1 ? 's' : ''}`}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
