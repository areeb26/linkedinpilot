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

async function fetchStats(workspaceId, days) {
  const since = getStartDate(days)

  const [actionsRes, messagesRes, leadsRes] = await Promise.all([
    supabase
      .from('actions_log')
      .select('action_type, status')
      .eq('workspace_id', workspaceId)
      .gte('executed_at', since),

    supabase
      .from('messages')
      .select('direction')
      .eq('workspace_id', workspaceId)
      .gte('created_at', since),

    supabase
      .from('leads')
      .select('connection_status')
      .eq('workspace_id', workspaceId),
  ])

  if (actionsRes.error) throw actionsRes.error
  if (messagesRes.error) throw messagesRes.error
  if (leadsRes.error) throw leadsRes.error

  const actions = actionsRes.data ?? []
  const msgs = messagesRes.data ?? []
  const leads = leadsRes.data ?? []

  const connectionsSent = actions.filter((a) => a.action_type === 'connect').length
  const profileViews = actions.filter((a) => a.action_type === 'view_profile').length
  const messagesSent = actions.filter((a) => a.action_type === 'message').length

  const repliesReceived = msgs.filter((m) => m.direction === 'inbound').length
  const outboundMessages = msgs.filter((m) => m.direction === 'outbound').length

  const connectionsAccepted = leads.filter(
    (l) => l.connection_status === 'accepted'
  ).length

  // Opportunities = accepted connections who have replied (intersect is approximated
  // as total accepted connections — adjust when a joined query is available)
  const opportunitiesSum = connectionsAccepted

  const acceptanceRate =
    connectionsSent > 0
      ? Math.round((connectionsAccepted / connectionsSent) * 100)
      : 0

  const replyRate =
    outboundMessages > 0
      ? Math.round((repliesReceived / outboundMessages) * 100)
      : 0

  return {
    connectionsSent,
    connectionsAccepted,
    messagesSent,
    repliesReceived,
    profileViews,
    opportunitiesSum,
    acceptanceRate,
    replyRate,
  }
}

export function useDashboardStats() {
  const workspaceId = useWorkspaceStore((s) => s.workspaceId)
  const timeFilter = useUiStore((s) => s.timeFilter)

  return useQuery({
    queryKey: ['dashboard-stats', workspaceId, timeFilter],
    queryFn: () => fetchStats(workspaceId, timeFilter),
    enabled: !!workspaceId,
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}
