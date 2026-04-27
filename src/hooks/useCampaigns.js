import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { toast } from 'react-hot-toast'

/**
 * useCampaigns: Fetches all campaigns with aggregated metrics
 */
export function useCampaigns() {
  const { workspaceId } = useWorkspaceStore()

  return useQuery({
    queryKey: ['campaigns', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return []

      // 1. Fetch base campaigns — exclude lead-extractor type (those belong to Prospect Extractor page)
      const { data: campaigns, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('workspace_id', workspaceId)
        .neq('type', 'prospect-extractor')
        .order('created_at', { ascending: false })

      if (campaignError) throw campaignError
      if (!campaigns.length) return []

      const campaignIds = campaigns.map(c => c.id)

      // 2. Fetch enrollment stats
      const { data: enrollments = [], error: enrollError } = await supabase
        .from('campaign_enrollments')
        .select(`
          campaign_id,
          status,
          leads (
            connection_status
          )
        `)
        .in('campaign_id', campaignIds)

      if (enrollError) console.warn('[useCampaigns] enrollments fetch failed:', enrollError.message)

      // 3. Fetch opportunity stats
      const { data: opportunities = [], error: oppError } = await supabase
        .from('opportunities')
        .select('campaign_id, value')
        .in('campaign_id', campaignIds)

      if (oppError) console.warn('[useCampaigns] opportunities fetch failed:', oppError.message)

      // 4. Fetch actual action counts from actions_log
      const { data: actions = [], error: actionsError } = await supabase
        .from('actions_log')
        .select('campaign_id, action_type, status')
        .in('campaign_id', campaignIds)
        .eq('workspace_id', workspaceId)

      if (actionsError) console.warn('[useCampaigns] actions fetch failed:', actionsError.message)

      // 5. Fetch messages for accurate message counts
      const { data: messages = [], error: messagesError } = await supabase
        .from('messages')
        .select('campaign_id, direction')
        .in('campaign_id', campaignIds)
        .eq('workspace_id', workspaceId)

      if (messagesError) console.warn('[useCampaigns] messages fetch failed:', messagesError.message)

      // 6. Fetch pending/processing queue items to determine true completion
      const { data: pendingQueue = [], error: queueError } = await supabase
        .from('action_queue')
        .select('campaign_id')
        .in('campaign_id', campaignIds)
        .in('status', ['pending', 'processing'])

      if (queueError) console.warn('[useCampaigns] queue fetch failed:', queueError.message)

      // Build a set of campaign IDs that still have work in the queue
      const campaignsWithPendingWork = new Set(pendingQueue.map(q => q.campaign_id))

      // 6. Aggregate metrics client-side
      return campaigns.map(campaign => {
        const campaignEnrollments = enrollments.filter(e => e.campaign_id === campaign.id)
        const campaignOpps = opportunities.filter(o => o.campaign_id === campaign.id)
        const campaignActions = actions.filter(a => a.campaign_id === campaign.id)
        const campaignMessages = messages.filter(m => m.campaign_id === campaign.id)

        const enrolled = campaignEnrollments.length
        const totalValue = campaignOpps.reduce((sum, opp) => sum + (Number(opp.value) || 0), 0)
        
        const repliedCount = campaignEnrollments.filter(e => e.status === 'replied').length
        const acceptedCount = campaignEnrollments.filter(e => {
          const lead = Array.isArray(e.leads) ? e.leads[0] : e.leads
          return lead?.connection_status === 'connected'
        }).length

        // Count actual actions
        const connectionsSent = campaignActions.filter(a => a.action_type === 'connect' && a.status === 'done').length
        const actionMessagesSent = campaignActions.filter(a => a.action_type === 'message' && a.status === 'done').length
        
        // Count messages from messages table (outbound = sent by us)
        const syncedMessagesSent = campaignMessages.filter(m => m.direction === 'outbound').length
        const syncedRepliesReceived = campaignMessages.filter(m => m.direction === 'inbound').length
        
        // Count enrollments marked as replied
        const enrollmentsReplied = campaignEnrollments.filter(e => e.status === 'replied').length
        
        // Prefer actions_log count; fall back to messages table if actions_log has nothing
        // (avoids double-counting since both tables may record the same send)
        const messagesSent = actionMessagesSent > 0 ? actionMessagesSent : syncedMessagesSent
        const repliesReceived = Math.max(enrollmentsReplied, syncedRepliesReceived)

        return {
          ...campaign,
          // A campaign is 'completed' only when:
          // - it was launched (has enrollments and actions were sent), AND
          // - there are no pending or processing actions left in the queue
          // Simply having sent connections to all enrolled leads is NOT enough —
          // there may still be follow-up messages, delays, or other steps pending.
          displayStatus: (
            campaign.status === 'active' &&
            enrolled > 0 &&
            connectionsSent > 0 &&
            !campaignsWithPendingWork.has(campaign.id)
          ) ? 'completed' : campaign.status,
          stats: {
            enrolled,
            connectionsSent,
            connectionsAccepted: acceptedCount,
            messagesSent,
            repliesReceived,
            repliedRate: enrolled > 0 ? (repliesReceived / enrolled) * 100 : 0,
            acceptedRate: connectionsSent > 0 ? (acceptedCount / connectionsSent) * 100 : 0,
            pipelineValue: totalValue
          }
        }
      })
    },
    enabled: !!workspaceId
  })
}

/**
 * useCampaign: Fetch single campaign detail
 */
export function useCampaign(id) {
  const { workspaceId } = useWorkspaceStore()

  return useQuery({
    queryKey: ['campaign', id, workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .single()
      
      if (error) throw error
      return data
    },
    enabled: !!id && !!workspaceId
  })
}

/**
 * useCampaignLeads: Fetch leads enrolled in a campaign
 */
export function useCampaignLeads(campaignId) {
  const { workspaceId } = useWorkspaceStore()

  return useQuery({
    queryKey: ['campaign-leads', campaignId, workspaceId],
    queryFn: async () => {
      if (!campaignId || !workspaceId) return []
      
      const { data, error } = await supabase
        .from('campaign_enrollments')
        .select(`
          id,
          status,
          created_at,
          leads (
            id,
            first_name,
            last_name,
            full_name,
            headline,
            profile_url,
            avatar_url,
            connection_status,
            company,
            title,
            notes
          )
        `)
        .eq('campaign_id', campaignId)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
      
      if (error) throw error

      console.log('[useCampaignLeads] Raw data from Supabase:', data)

      // Transform data to flatten lead info
      // Note: Supabase returns joined data as an array or object depending on relationship
      const transformed = data
        .filter(enrollment => !!enrollment.leads)
        .map(enrollment => {
          const lead = Array.isArray(enrollment.leads) ? enrollment.leads[0] : enrollment.leads
          return {
            enrollment_id: enrollment.id,
            status: enrollment.status,
            enrolled_at: enrollment.created_at,
            ...lead
          }
        })

      console.log('[useCampaignLeads] Transformed leads:', transformed)
      return transformed
    },
    enabled: !!campaignId && !!workspaceId
  })
}

/**
 * useCampaignAccounts: Fetch LinkedIn accounts used by campaign
 */
export function useCampaignAccounts(campaignId) {
  const { workspaceId } = useWorkspaceStore()

  return useQuery({
    queryKey: ['campaign-accounts', campaignId, workspaceId],
    queryFn: async () => {
      if (!campaignId || !workspaceId) return []
      
      // First get campaign to find linkedin_account_id
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('linkedin_account_id, daily_limit')
        .eq('id', campaignId)
        .eq('workspace_id', workspaceId)
        .single()

      if (campaignError) throw campaignError

      if (!campaign?.linkedin_account_id) {
        // Campaign has no assigned account — fall back to all workspace accounts
        const { data: allAccounts, error: allError } = await supabase
          .from('linkedin_accounts')
          .select('id, full_name, headline, avatar_url, status, daily_connection_limit, daily_message_limit, today_connections, today_messages')
          .eq('workspace_id', workspaceId)
          .neq('status', 'disconnected')
        if (allError) throw allError
        return (allAccounts || []).map(account => ({
          ...account,
          limits: {
            connection: account.daily_connection_limit || 5,
            message: account.daily_message_limit || 5,
            like: 20
          }
        }))
      }

      // Fetch account details
      const { data: accounts, error } = await supabase
        .from('linkedin_accounts')
        .select('id, full_name, headline, avatar_url, status, daily_connection_limit, daily_message_limit, today_connections, today_messages')
        .eq('id', campaign.linkedin_account_id)
        .eq('workspace_id', workspaceId)

      if (error) throw error

      return accounts.map(account => ({
        ...account,
        limits: {
          connection: account.daily_connection_limit || 20,
          message: account.daily_message_limit || 50,
          like: 20
        }
      }))
    },
    enabled: !!campaignId && !!workspaceId
  })
}

/**
 * useCampaignAnalytics: Fetch campaign stats from action_logs
 */
export function useCampaignAnalytics(campaignId) {
  const { workspaceId } = useWorkspaceStore()

  return useQuery({
    queryKey: ['campaign-analytics', campaignId, workspaceId],
    queryFn: async () => {
      if (!campaignId || !workspaceId) {
        return {
          connections_sent: 0,
          connections_accepted: 0,
          messages_sent: 0,
          replies_received: 0,
          opportunities: 0
        }
      }
      
      console.log('[useCampaignAnalytics] Fetching for campaign:', campaignId, 'workspace:', workspaceId)
      
      // Count actions by type for this campaign
      const { data: actions, error: actionsError } = await supabase
        .from('actions_log')
        .select('action_type, status')
        .eq('campaign_id', campaignId)
        .eq('workspace_id', workspaceId)

      if (actionsError) {
        console.error('[useCampaignAnalytics] Error fetching actions:', actionsError)
        throw actionsError
      }

      console.log('[useCampaignAnalytics] Actions fetched:', actions?.length, actions)

      // Count inbound messages (replies) for this campaign
      const { data: inboundMessages, error: inboundError } = await supabase
        .from('messages')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('workspace_id', workspaceId)
        .eq('direction', 'inbound')

      if (inboundError) {
        console.error('[useCampaignAnalytics] Error fetching inbound messages:', inboundError)
        throw inboundError
      }

      // Count outbound messages (messages sent) for this campaign
      const { data: outboundMessages, error: outboundError } = await supabase
        .from('messages')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('workspace_id', workspaceId)
        .eq('direction', 'outbound')

      if (outboundError) {
        console.error('[useCampaignAnalytics] Error fetching outbound messages:', outboundError)
      }

      // Get leads with connection_status='connected' for acceptance count
      const { data: leads, error: leadsError } = await supabase
        .from('campaign_enrollments')
        .select('leads!inner(connection_status)')
        .eq('campaign_id', campaignId)
        .eq('workspace_id', workspaceId)

      if (leadsError) {
        console.error('[useCampaignAnalytics] Error fetching leads:', leadsError)
      }

      const connectedLeads = leads?.filter(e => {
        const lead = Array.isArray(e.leads) ? e.leads[0] : e.leads
        return lead?.connection_status === 'connected'
      }).length || 0

      // Aggregate stats
      // Prefer actions_log count; fall back to messages table if actions_log has nothing
      const actionMessagesSent = actions.filter(a => a.action_type === 'message' && a.status === 'done').length
      const syncedMessagesSent = outboundMessages?.length || 0
      
      const stats = {
        connections_sent: actions.filter(a => a.action_type === 'connect' && a.status === 'done').length,
        connections_accepted: connectedLeads,
        messages_sent: actionMessagesSent > 0 ? actionMessagesSent : syncedMessagesSent,
        replies_received: inboundMessages?.length || 0,
        opportunities: 0
      }
      
      console.log('[useCampaignAnalytics] Computed stats:', stats)
      return stats
    },
    enabled: !!campaignId && !!workspaceId
  })
}

/**
 * useCreateCampaign
 */
export function useCreateCampaign() {
  const { workspaceId } = useWorkspaceStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (newCampaign) => {
      if (!workspaceId) throw new Error('No workspace selected')
      const { data, error } = await supabase
        .from('campaigns')
        .insert([{ ...newCampaign, workspace_id: workspaceId }])
        .select()
      
      if (error) throw error
      return data[0]
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] })
      toast.success('Campaign created successfully')
    }
  })
}

/**
 * useUpdateCampaign
 */
export function useUpdateCampaign() {
  const { workspaceId } = useWorkspaceStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      if (!workspaceId) throw new Error('No workspace selected')
      const { data, error } = await supabase
        .from('campaigns')
        .update(updates)
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .select()
      
      if (error) throw error
      return data[0]
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] })
      queryClient.invalidateQueries({ queryKey: ['campaign', data.id, workspaceId] })
      toast.success('Campaign updated')
    }
  })
}

/**
 * useLaunchCampaign
 */
export function useLaunchCampaign() {
  const { workspaceId } = useWorkspaceStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id) => {
      if (!workspaceId) throw new Error('No workspace selected')
      const { data, error } = await supabase
        .from('campaigns')
        .update({ status: 'active', started_at: new Date().toISOString() })
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .select()

      if (error) throw error

      // Queue actions for all enrolled leads
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-campaign`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ campaign_id: id, workspace_id: workspaceId }),
          }
        ).catch(err => console.error('process-campaign failed:', err))
      }

      return data[0]
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] })
      toast.success('Campaign launched! 🚀')
    }
  })
}

/**
 * usePauseCampaign
 */
export function usePauseCampaign() {
  const { workspaceId } = useWorkspaceStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id) => {
      if (!workspaceId) throw new Error('No workspace selected')
      const { data, error } = await supabase
        .from('campaigns')
        .update({ status: 'paused' })
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .select()
      
      if (error) throw error
      return data[0]
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] })
      toast.success('Campaign paused')
    }
  })
}

/**
 * useDuplicateCampaign
 */
export function useDuplicateCampaign() {
  const { workspaceId } = useWorkspaceStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id) => {
      if (!workspaceId) throw new Error('No workspace selected')
      // 1. Fetch the original
      const { data: original, error: fetchError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .eq('workspace_id', workspaceId)
        .single()
      
      if (fetchError) throw fetchError

      // 2. Insert copy
      const { id: _, created_at: __, updated_at: ___, started_at: ____, completed_at: _____, workspace_id: _ws, ...cloneData } = original
      const { data: clone, error: insertError } = await supabase
        .from('campaigns')
        .insert([{
          ...cloneData,
          workspace_id: workspaceId,
          name: `${original.name} (Copy)`,
          status: 'draft'
        }])
        .select()
      
      if (insertError) throw insertError
      return clone[0]
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] })
      toast.success('Campaign duplicated')
    }
  })
}

/**
 * useSendConnectionRequest: Queue a connection request action for a lead
 * Works for all login_method types:
 *   - credentials → queue-action notifies Python worker
 *   - extension/cookies → queue-action inserts pending; extension Realtime picks it up
 */
export function useSendConnectionRequest() {
  const { workspaceId } = useWorkspaceStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ leadId, profileUrl, linkedinAccountId, note, campaignId }) => {
      if (!workspaceId) throw new Error('No workspace selected')

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      // Fetch lead's linkedin_member_id (required for Unipile API)
      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .select('linkedin_member_id')
        .eq('id', leadId)
        .single()

      if (leadError) throw leadError

      const providerId = lead?.linkedin_member_id
      if (!providerId) {
        throw new Error('Lead missing linkedin_member_id. Please run lead enrichment first.')
      }

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/queue-action`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            workspace_id: workspaceId,
            action: {
              action_type: 'connect',
              linkedin_account_id: linkedinAccountId,
              lead_id: leadId,
              campaign_id: campaignId || null,
              payload: {
                provider_id: providerId,
                profile_url: profileUrl,
                message: note || null,
              },
            },
          }),
        }
      )

      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-leads'] })
      queryClient.invalidateQueries({ queryKey: ['campaign-analytics'] })
      toast.success('Connection request queued')
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })
}


/**
 * useUploadLeads: Upsert CSV leads + enroll them in a campaign
 */
export function useUploadLeads() {
  const { workspaceId } = useWorkspaceStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ campaignId, leads }) => {
      if (!workspaceId) throw new Error('No workspace selected')

      console.log('[useUploadLeads] Starting upload for campaign:', campaignId, 'leads:', leads.length)

      const leadsToInsert = leads.map(lead => {
        const profileUrl = lead.profile_url || lead.linkedInUrl || lead.linkedin_url || null
        
        // Extract linkedin_member_id from profile URL
        // Format: https://www.linkedin.com/in/username/ or https://linkedin.com/in/username
        let linkedinMemberId = null
        if (profileUrl) {
          const match = profileUrl.match(/\/in\/([^/?]+)/)
          if (match) {
            linkedinMemberId = match[1].replace(/\/$/, '') // Remove trailing slash
          }
        }
        
        return {
          workspace_id: workspaceId,
          first_name: lead.first_name || lead.firstName || null,
          last_name: lead.last_name || lead.lastName || null,
          full_name: lead.full_name || lead.fullName ||
            [lead.first_name || lead.firstName, lead.last_name || lead.lastName].filter(Boolean).join(' ') || null,
          headline: lead.headline || null,
          company: lead.company || null,
          title: lead.title || lead.jobTitle || null,
          email: lead.email || null,
          location: lead.location || null,
          profile_url: profileUrl,
          linkedin_member_id: linkedinMemberId, // Add extracted member ID
          source: 'csv',
          connection_status: 'none',
        }
      }).filter(lead => !!lead.profile_url) // profile_url is required for upsert conflict key

      console.log('[useUploadLeads] Leads to insert:', leadsToInsert.length)

      const { data: upsertedLeads, error: upsertError } = await supabase
        .from('leads')
        .upsert(leadsToInsert, { onConflict: 'workspace_id,profile_url', ignoreDuplicates: false })
        .select('id')

      if (upsertError) {
        console.error('[useUploadLeads] Leads upsert error:', upsertError)
        throw upsertError
      }

      console.log('[useUploadLeads] Upserted leads:', upsertedLeads?.length)

      const enrollments = upsertedLeads.map(lead => ({
        workspace_id: workspaceId,
        campaign_id: campaignId,
        lead_id: lead.id,
        status: 'active',
      }))

      console.log('[useUploadLeads] Enrollments to create:', enrollments.length)

      const { error: enrollError } = await supabase
        .from('campaign_enrollments')
        .upsert(enrollments, { onConflict: 'campaign_id,lead_id', ignoreDuplicates: true })

      if (enrollError) {
        console.error('[useUploadLeads] Enrollment error:', enrollError)
        throw enrollError
      }

      console.log('[useUploadLeads] Successfully enrolled leads')

      // Trigger background enrichment for leads without full data
      const leadsNeedingEnrichment = upsertedLeads.filter((_, idx) => {
        const originalLead = leads[idx]
        return !originalLead.first_name || !originalLead.firstName || !originalLead.full_name || !originalLead.fullName
      })

      if (leadsNeedingEnrichment.length > 0) {
        console.log('[useUploadLeads] Triggering enrichment for', leadsNeedingEnrichment.length, 'leads')
        // Call backend enrichment endpoint - wait for it to complete
        // Allow up to 5 minutes for large CSV files (100 leads * 3s = 5 minutes)
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000) // 5 minute timeout
          
          const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'}/api/enrich-leads`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workspace_id: workspaceId,
              lead_ids: leadsNeedingEnrichment.map(l => l.id)
            }),
            signal: controller.signal
          })
          clearTimeout(timeoutId)
          const result = await response.json()
          console.log('[useUploadLeads] Enrichment complete:', result)
        } catch (err) {
          if (err.name === 'AbortError') {
            console.warn('[useUploadLeads] Enrichment timed out after 5 minutes, proceeding anyway')
          } else {
            console.warn('[useUploadLeads] Enrichment request failed:', err)
          }
        }
      }

      return upsertedLeads.length
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-leads'] })
      toast.success(`${count} lead${count !== 1 ? 's' : ''} uploaded. Fetching profile data...`)
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })
}

/**
 * useDeleteCampaign
 */
export function useDeleteCampaign() {
  const { workspaceId } = useWorkspaceStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id) => {
      if (!workspaceId) throw new Error('No workspace selected')
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', id)
        .eq('workspace_id', workspaceId)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] })
      toast.success('Campaign deleted')
    }
  })
}
