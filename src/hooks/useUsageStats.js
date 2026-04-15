import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { startOfMonth, endOfMonth } from 'date-fns'

export function useUsageStats() {
  const { workspaceId } = useWorkspaceStore()

  return useQuery({
    queryKey: ['usage-stats', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null
      
      const now = new Date()
      const start = startOfMonth(now).toISOString()
      const end = endOfMonth(now).toISOString()

      // 1. Total Connected Seats
      const { count: seatsCount } = await supabase
        .from('linkedin_accounts')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .neq('status', 'disconnected')

      // 2. Total Leads in Database
      const { count: leadsCount } = await supabase
        .from('leads')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)

      // 3. Actions Executed This Month
      const { count: actionsCount } = await supabase
        .from('actions_log')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .gte('executed_at', start)
        .lte('executed_at', end)

      return {
        seats_used: seatsCount || 0,
        leads_total: leadsCount || 0,
        actions_this_month: actionsCount || 0,
        period_start: start,
        period_end: end
      }
    },
    enabled: !!workspaceId
  })
}
