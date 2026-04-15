import React from 'react'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { 
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem 
} from '@/components/ui/select'
import { Search } from 'lucide-react'

export function LeadFilters({ 
  search, 
  setSearch, 
  status, 
  setStatus, 
  icpRange, 
  setIcpRange 
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-lg bg-[#1e1e1e] border border-white/5">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94a3b8]" />
        <Input 
          placeholder="Search leads..." 
          className="pl-9 bg-[#0f0f0f] border-white/5"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="bg-[#0f0f0f] border-white/5">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
            <SelectItem value="bounced">Bounced</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="md:col-span-2 px-2">
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs text-[#94a3b8]">ICP Score Range</label>
          <span className="text-xs font-medium text-purple-400">{icpRange[0]} - {icpRange[1]}</span>
        </div>
        <Slider 
          value={icpRange} 
          onValueChange={setIcpRange} 
          max={100} 
          step={1} 
          className="mt-2" 
        />
      </div>
    </div>
  )
}
