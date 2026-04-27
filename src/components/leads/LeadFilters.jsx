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
  setIcpRange,
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-[var(--space-3)] p-[var(--space-3)] rounded-xs bg-[var(--color-surface-strong)] border border-[var(--color-border)]">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-secondary)]" />
        <Input
          placeholder="Search leads..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Status filter */}
      <div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-[var(--color-surface-strong)] border-[var(--color-border)] rounded-xs">
            <SelectItem value="all" className="text-[var(--color-text-on-strong)] focus:bg-[var(--color-border)]">All Statuses</SelectItem>
            <SelectItem value="new" className="text-[var(--color-text-on-strong)] focus:bg-[var(--color-border)]">New</SelectItem>
            <SelectItem value="contacted" className="text-[var(--color-text-on-strong)] focus:bg-[var(--color-border)]">Contacted</SelectItem>
            <SelectItem value="replied" className="text-[var(--color-text-on-strong)] focus:bg-[var(--color-border)]">Replied</SelectItem>
            <SelectItem value="bounced" className="text-[var(--color-text-on-strong)] focus:bg-[var(--color-border)]">Bounced</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ICP Score Range */}
      <div className="md:col-span-2 px-2">
        <div className="flex justify-between items-center mb-2">
          <label className="text-xs text-[var(--color-text-secondary)]">ICP Score Range</label>
          <span className="text-xs font-medium text-[var(--color-surface-raised)]">
            {icpRange[0]} – {icpRange[1]}
          </span>
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
