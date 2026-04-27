import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useWorkspaceStore } from '../store/workspaceStore'
import { useUiStore } from '../store/uiStore'

function getStartDate(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

function buildEmptyBuckets(days) {
  const buckets = {}
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const iso = d.toISOString().slice(0, 10) // YYYY-MM-DD
    buckets[iso] = {
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      isoDate: iso,
      connectionsSent: 0,
      messagesSent: 0,
      profileViews: 0,
    }
  }
  return buckets
}

async function fetchChartData(workspaceId, days) {
  const since = getStartDate(days)

  const { data, error } = await supabase
    .from('actions_log')
    .select('action_type, executed_at')
    .eq('workspace_id', workspaceId)
    .eq('status', 'done')
    .gte('executed_at', since)
    .order('executed_at', { ascending: true })

  if (error) throw error

  const buckets = buildEmptyBuckets(days)

  for (const row of data ?? []) {
    const iso = row.executed_at.slice(0, 10)
    if (!buckets[iso]) continue

    if (row.action_type === 'connect') buckets[iso].connectionsSent += 1
    else if (row.action_type === 'message') buckets[iso].messagesSent += 1
    else if (row.action_type === 'view_profile') buckets[iso].profileViews += 1
  }

  return Object.values(buckets)
}

export function useChartData() {
  const workspaceId = useWorkspaceStore((s) => s.workspaceId)
  const timeFilter = useUiStore((s) => s.timeFilter)

  return useQuery({
    queryKey: ['chart-data', workspaceId, timeFilter],
    queryFn: () => fetchChartData(workspaceId, timeFilter),
    enabled: !!workspaceId,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}
