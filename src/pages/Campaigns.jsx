import { useState } from 'react'
import { useCampaigns } from '@/hooks/useCampaigns'
import CampaignCard from '@/components/campaigns/CampaignCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Search, FilterX, Loader2, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Campaigns() {
  const { data: campaigns = [], isLoading } = useCampaigns()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesStatus = filter === 'all' || campaign.status === filter
    const matchesSearch = campaign.name.toLowerCase().includes(search.toLowerCase()) ||
                          campaign.type.toLowerCase().includes(search.toLowerCase())
    return matchesStatus && matchesSearch
  })

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground text-sm">Manage and monitor your LinkedIn outreach sequences.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button asChild className="bg-primary hover:opacity-90 text-primary-foreground shadow-lg shadow-primary/20 px-6 transition-all duration-200 hover:scale-[1.02] hover-lift">
            <Link to="/campaigns/new">
              <Plus className="w-4 h-4 mr-2" /> Create Campaign
            </Link>
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border animate-slide-up stagger-1">
        <div className="relative w-full md:w-80 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Search campaigns..."
            className="pl-10 bg-background border-input text-foreground placeholder:text-muted-foreground focus:border-primary/50 transition-all rounded-lg"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Tabs value={filter} onValueChange={setFilter} className="w-full md:w-auto">
          <TabsList className="bg-muted border border-border p-1 rounded-lg">
            <TabsTrigger value="all" className="data-[state=active]:bg-background data-[state=active]:text-foreground text-muted-foreground text-xs font-semibold px-4 transition-all">All</TabsTrigger>
            <TabsTrigger value="active" className="data-[state=active]:bg-success/10 data-[state=active]:text-success text-muted-foreground text-xs font-semibold px-4 transition-all">Active</TabsTrigger>
            <TabsTrigger value="paused" className="data-[state=active]:bg-warning/10 data-[state=active]:text-warning text-muted-foreground text-xs font-semibold px-4 transition-all">Paused</TabsTrigger>
            <TabsTrigger value="draft" className="data-[state=active]:bg-info/10 data-[state=active]:text-info text-muted-foreground text-xs font-semibold px-4 transition-all">Drafts</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32 space-y-4 animate-fade-in">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-muted-foreground text-sm font-medium animate-pulse-subtle">Loading campaigns...</p>
        </div>
      ) : filteredCampaigns.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-slide-up stagger-2">
          {filteredCampaigns.map((campaign, i) => (
            <div key={campaign.id} className={`stagger-${(i % 5) + 1}`}>
              <CampaignCard campaign={campaign} />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center space-y-6 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border border-border">
            <Sparkles className="w-8 h-8 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">No campaigns found</h3>
            <p className="text-muted-foreground text-sm max-w-md">
              Your outreach canvas awaits. Create your first campaign to start connecting with prospects.
            </p>
          </div>
          <Button asChild variant="outline" className="border-border text-foreground hover:bg-secondary px-6">
            <Link to="/campaigns/new">
              <Plus className="w-4 h-4 mr-2" />
              Create your first campaign
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
