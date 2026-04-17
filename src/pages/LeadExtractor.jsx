import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { LeadExtractorWizard } from '@/components/extractor/LeadExtractorWizard'
import { useExtractions, useExtractionLeads } from '@/hooks/useExtractions'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import { 
  Search, 
  Rocket, 
  Plus, 
  MoreHorizontal,
  ChevronLeft,
  Download,
  ExternalLink,
  FileText,
  Send,
  User,
  Building2,
  MapPin,
  GraduationCap,
  Award,
  FileSignature,
  Users,
  Globe,
  LinkedIn
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'react-hot-toast'

export default function LeadExtractor() {
  const [isWizardOpen, setIsWizardOpen] = useState(false)
  const [selectedExtraction, setSelectedExtraction] = useState(null)
  const [campaignSearch, setCampaignSearch] = useState('')
  const { workspaceId } = useWorkspaceStore()
  
  const { extractions, isLoading } = useExtractions()
  const { extraction, leads, isLoading: isDetailLoading } = useExtractionLeads(selectedExtraction)

  // Filter extractions by search
  const filteredExtractions = extractions.filter(ext => 
    ext.campaigns?.name?.toLowerCase().includes(campaignSearch.toLowerCase()) ||
    ext.linkedin_accounts?.full_name?.toLowerCase().includes(campaignSearch.toLowerCase())
  )

  const handleViewDetails = (id) => {
    setSelectedExtraction(id)
  }

  const handleBack = () => {
    setSelectedExtraction(null)
  }

  const handleExportLeads = (extractionId) => {
    toast.success('Export functionality coming soon!')
  }

  const handleAddToCampaign = (extractionId) => {
    toast.success('Add to Campaign functionality coming soon!')
  }

  // Detail View
  if (selectedExtraction) {
    return (
      <ExtractionDetail 
        extraction={extraction}
        leads={leads}
        isLoading={isDetailLoading}
        onBack={handleBack}
        onAddToCampaign={() => handleAddToCampaign(selectedExtraction)}
        onExport={() => handleExportLeads(selectedExtraction)}
      />
    )
  }

  // List View
  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center bg-[#1a1a1a]/50 p-6 rounded-2xl border border-white/5 backdrop-blur-sm">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Lead Extractor
          </h2>
          <p className="text-[#94a3b8] text-sm mt-1">Extract and enrich leads from LinkedIn searches, posts, and Sales Navigator.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-6 px-4 py-2 bg-white/5 rounded-xl border border-white/5">
            <div className="flex items-center gap-2">
              <Rocket className="h-4 w-4 text-purple-400" />
              <span className="text-xs font-bold text-[#94a3b8] uppercase tracking-widest">Credits</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold text-white">990</span>
              <span className="text-[10px] text-[#94a3b8] font-medium uppercase">credits</span>
            </div>
          </div>
          <Button 
            onClick={() => setIsWizardOpen(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 h-11 rounded-xl font-bold shadow-lg shadow-purple-500/20"
          >
            <Plus className="h-5 w-5 mr-2" /> Extract Leads
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
          <Input 
            placeholder="Search campaigns..." 
            className="pl-10 bg-[#1a1a1a] border-white/10 text-white placeholder:text-[#94a3b8]"
            value={campaignSearch}
            onChange={(e) => setCampaignSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="border-white/10 bg-[#1a1a1a] text-[#94a3b8]">
            All Status <span className="ml-2">▼</span>
          </Button>
          <Button variant="outline" className="border-white/10 bg-[#1a1a1a] text-[#94a3b8]">
            All Types <span className="ml-2">▼</span>
          </Button>
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="bg-[#1a1a1a] rounded-xl border border-white/5 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-white/5 hover:bg-transparent">
              <TableHead className="text-[#94a3b8] font-medium">Campaign</TableHead>
              <TableHead className="text-[#94a3b8] font-medium">LinkedIn Account</TableHead>
              <TableHead className="text-[#94a3b8] font-medium">Type</TableHead>
              <TableHead className="text-[#94a3b8] font-medium">Progress</TableHead>
              <TableHead className="text-[#94a3b8] font-medium">Status</TableHead>
              <TableHead className="text-[#94a3b8] font-medium w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-[#94a3b8]">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-4 w-4 border-2 border-purple-500 border-t-transparent animate-spin rounded-full" />
                    <span>Loading campaigns...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredExtractions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-[#94a3b8]">
                  No extraction campaigns found.
                </TableCell>
              </TableRow>
            ) : (
              filteredExtractions.map((extraction) => (
                <TableRow key={extraction.id} className="border-white/5 hover:bg-white/5">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center">
                        <Search className="h-4 w-4 text-[#94a3b8]" />
                      </div>
                      <div>
                        <div className="font-medium text-white">{extraction.campaigns?.name || 'Untitled Extraction'}</div>
                        <div className="text-xs text-[#94a3b8]">{format(new Date(extraction.created_at), 'M/d/yyyy')}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={extraction.linkedin_accounts?.avatar_url} />
                        <AvatarFallback className="bg-purple-500/20 text-purple-400 text-xs">
                          {extraction.linkedin_accounts?.full_name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-white text-sm">{extraction.linkedin_accounts?.full_name || 'Unknown Account'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-xs">
                      Search Extraction
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <LeadCount extractionId={extraction.id} workspaceId={workspaceId} />
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-xs capitalize">
                      {extraction.status === 'done' ? 'Finished' : extraction.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-[#94a3b8] hover:text-white hover:bg-white/10">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-[#1e1e1e] border-white/10">
                        <DropdownMenuItem 
                          onClick={() => handleViewDetails(extraction.id)}
                          className="text-white hover:bg-white/10 cursor-pointer"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-white hover:bg-white/10 cursor-pointer">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Source
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuItem 
                          onClick={() => handleAddToCampaign(extraction.id)}
                          className="text-white hover:bg-white/10 cursor-pointer"
                        >
                          <Send className="h-4 w-4 mr-2" />
                          Add to Campaign
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleExportLeads(extraction.id)}
                          className="text-white hover:bg-white/10 cursor-pointer"
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export Leads
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-[#94a3b8]">
        <span>Showing 1-{filteredExtractions.length} of {filteredExtractions.length} campaigns</span>
        <div className="flex items-center gap-2">
          <span>Show</span>
          <select className="bg-[#1a1a1a] border border-white/10 rounded px-2 py-1 text-white">
            <option>10</option>
            <option>25</option>
            <option>50</option>
          </select>
          <span>per page</span>
        </div>
      </div>

      <LeadExtractorWizard isOpen={isWizardOpen} onOpenChange={setIsWizardOpen} />
    </div>
  )
}

// Extraction Detail Component
function ExtractionDetail({ extraction, leads, isLoading, onBack, onAddToCampaign, onExport }) {
  if (isLoading || !extraction) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="h-8 w-8 border-2 border-purple-500 border-t-transparent animate-spin rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={onBack}
            className="text-[#94a3b8] hover:text-white hover:bg-white/10"
          >
            <ChevronLeft className="h-5 w-5 mr-1" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-white">
              {extraction.campaigns?.name || 'Untitled Extraction'}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[#94a3b8] text-sm">
                Created {format(new Date(extraction.created_at), 'MMM d, yyyy')}
              </span>
              <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 text-xs">
                Search Extraction
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={onBack}
            className="border-white/10 bg-transparent text-[#94a3b8] hover:text-white hover:bg-white/10"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button 
            onClick={onAddToCampaign}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Send className="h-4 w-4 mr-2" />
            Add to Campaign
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Leads Found */}
        <div className="bg-[#1a1a1a] rounded-xl border border-white/5 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#94a3b8] text-sm">Leads Found</p>
              <p className="text-3xl font-bold text-white mt-1">{leads.length}</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <User className="h-6 w-6 text-blue-400" />
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="bg-[#1a1a1a] rounded-xl border border-white/5 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#94a3b8] text-sm">Status</p>
              <p className="text-3xl font-bold text-white mt-1">
                {extraction.status === 'done' ? 'Finished' : extraction.status}
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center">
              <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Account Used */}
        <div className="bg-[#1a1a1a] rounded-xl border border-white/5 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[#94a3b8] text-sm">Account Used</p>
              <div className="flex items-center gap-2 mt-1">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={extraction.linkedin_accounts?.avatar_url} />
                  <AvatarFallback className="bg-purple-500/20 text-purple-400">
                    {extraction.linkedin_accounts?.full_name?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-white font-medium">
                  {extraction.linkedin_accounts?.full_name || 'Unknown Account'}
                </span>
              </div>
              <p className="text-[#94a3b8] text-xs mt-1">LinkedIn Account</p>
            </div>
          </div>
        </div>
      </div>

      {/* Extracted Leads Section */}
      <div className="bg-[#1a1a1a] rounded-xl border border-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white">Extracted Leads</h3>
            <p className="text-[#94a3b8] text-sm">{leads.length} leads found</p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
            <Input 
              placeholder="Search leads..." 
              className="pl-10 bg-[#0f0f0f] border-white/10 text-white placeholder:text-[#94a3b8]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-[#94a3b8] font-medium">
                  Contact <span className="text-xs">↕</span>
                </TableHead>
                <TableHead className="text-[#94a3b8] font-medium">
                  Location <span className="text-xs">↕</span>
                </TableHead>
                <TableHead className="text-[#94a3b8] font-medium">
                  Company <span className="text-xs">↕</span>
                </TableHead>
                <TableHead className="text-[#94a3b8] font-medium">
                  Education <span className="text-xs">↕</span>
                </TableHead>
                <TableHead className="text-[#94a3b8] font-medium">
                  Certifications <span className="text-xs">↕</span>
                </TableHead>
                <TableHead className="text-[#94a3b8] font-medium">
                  About <span className="text-xs">↕</span>
                </TableHead>
                <TableHead className="text-[#94a3b8] font-medium">
                  Network <span className="text-xs">↕</span>
                </TableHead>
                <TableHead className="text-[#94a3b8] font-medium">
                  Languages <span className="text-xs">↕</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-[#94a3b8]">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-4 w-4 border-2 border-purple-500 border-t-transparent animate-spin rounded-full" />
                      <span>Loading leads...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : leads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-[#94a3b8]">
                    No leads found for this extraction.
                  </TableCell>
                </TableRow>
              ) : (
                leads.map((lead) => (
                  <TableRow key={lead.id} className="border-white/5 hover:bg-white/5">
                    {/* Contact */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={lead.avatar_url} />
                          <AvatarFallback className="bg-purple-500/20 text-purple-400">
                            {lead.full_name?.charAt(0) || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-white flex items-center gap-1">
                            {lead.full_name}
                            <svg className="h-4 w-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                            </svg>
                          </div>
                          <div className="text-xs text-[#94a3b8] max-w-[200px] truncate">
                            {lead.headline || lead.title || 'No title'}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Location */}
                    <TableCell>
                      <div className="flex items-center gap-1 text-[#94a3b8]">
                        <MapPin className="h-4 w-4" />
                        <span className="text-sm">{lead.location || '-'}</span>
                      </div>
                    </TableCell>

                    {/* Company */}
                    <TableCell>
                      <div className="flex items-center gap-1 text-[#94a3b8]">
                        <Building2 className="h-4 w-4" />
                        <span className="text-sm">{lead.company || '-'}</span>
                      </div>
                    </TableCell>

                    {/* Education */}
                    <TableCell>
                      <div className="flex items-center gap-1 text-[#94a3b8]">
                        <GraduationCap className="h-4 w-4" />
                        <span className="text-sm">-</span>
                      </div>
                    </TableCell>

                    {/* Certifications */}
                    <TableCell>
                      <div className="flex items-center gap-1 text-[#94a3b8]">
                        <Award className="h-4 w-4" />
                        <span className="text-sm">-</span>
                      </div>
                    </TableCell>

                    {/* About */}
                    <TableCell>
                      <div className="flex items-center gap-1 text-[#94a3b8]">
                        <FileSignature className="h-4 w-4" />
                        <span className="text-sm">-</span>
                      </div>
                    </TableCell>

                    {/* Network */}
                    <TableCell>
                      <div className="flex items-center gap-1 text-[#94a3b8]">
                        <Users className="h-4 w-4" />
                        <span className="text-sm">-</span>
                      </div>
                    </TableCell>

                    {/* Languages */}
                    <TableCell>
                      <div className="flex items-center gap-1 text-[#94a3b8]">
                        <Globe className="h-4 w-4" />
                        <span className="text-sm">-</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

// LeadCount component - fetches actual count of leads for an extraction
function LeadCount({ extractionId, workspaceId }) {
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!workspaceId) return

    const fetchCount = async () => {
      const isOrphan = extractionId === 'orphan-direct-scrape'

      if (isOrphan) {
        const { count: leadCount, error } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .is('action_queue_id', null)
          .eq('source', 'lead-extractor')
        if (!error) {
          setCount(leadCount || 0)
        }
        setLoading(false)
        return
      }

      const { data: extractionData } = await supabase
        .from('action_queue')
        .select('created_at')
        .eq('id', extractionId)
        .single()

      if (extractionData) {
        const { count: leadCount, error } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .eq('action_queue_id', extractionId)
        if (!error) {
          setCount(leadCount || 0)
        }
      }
      setLoading(false)
    }

    fetchCount()
  }, [extractionId, workspaceId])

  if (loading) {
    return <span className="text-green-400 text-sm">-</span>
  }

  return (
    <span className="text-green-400 text-sm">
      {count} lead{count !== 1 ? 's' : ''} found
    </span>
  )
}
