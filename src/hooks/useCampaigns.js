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

      // 1. Fetch base campaigns
      const { data: campaigns, error: campaignError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })

      if (campaignError) throw campaignError
      if (!campaigns.length) return []

      const campaignIds = campaigns.map(c => c.id)

      // 2. Fetch enrollment stats
      // We need: total enrolled, replied status count, and connection_status from leads
      const { data: enrollments, error: enrollError } = await supabase
        .from('campaign_enrollments')
        .select(`
          campaign_id,
          status,
          leads (
            connection_status
          )
        `)
        .in('campaign_id', campaignIds)

      if (enrollError) throw enrollError

      // 3. Fetch opportunity stats
      const { data: opportunities, error: oppError } = await supabase
        .from('opportunities')
        .select('campaign_id, value')
        .in('campaign_id', campaignIds)

      if (oppError) throw oppError

      // 4. Aggregate metrics client-side
      return campaigns.map(campaign => {
        const campaignEnrollments = enrollments.filter(e => e.campaign_id === campaign.id)
        const campaignOpps = opportunities.filter(o => o.campaign_id === campaign.id)

        const enrolled = campaignEnrollments.length
        const totalValue = campaignOpps.reduce((sum, opp) => sum + (Number(opp.value) || 0), 0)
        
        const repliedCount = campaignEnrollments.filter(e => e.status === 'replied').length
        const acceptedCount = campaignEnrollments.filter(e => e.leads?.connection_status === 'connected').length

        return {
          ...campaign,
          stats: {
            enrolled,
            repliedRate: enrolled > 0 ? (repliedCount / enrolled) * 100 : 0,
            acceptedRate: enrolled > 0 ? (acceptedCount / enrolled) * 100 : 0,
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
            title
          )
        `)
        .eq('campaign_id', campaignId)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      // Transform data to flatten lead info
      return data.map(enrollment => ({
        enrollment_id: enrollment.id,
        status: enrollment.status,
        enrolled_at: enrollment.created_at,
        ...enrollment.leads
      }))
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
      
      // First get campaign to find linked_account_ids
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .select('linked_account_ids, daily_limit')
        .eq('id', campaignId)
        .eq('workspace_id', workspaceId)
        .single()
      
      if (campaignError) throw campaignError
      
      const accountIds = campaign?.linked_account_ids || []
      if (accountIds.length === 0) return []
      
      // Fetch account details
      const { data: accounts, error } = await supabase
        .from('linkedin_accounts')
        .select('id, full_name, headline, avatar_url, status, daily_connection_limit, daily_message_limit, today_connections, today_messages')
        .in('id', accountIds)
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
      
      // Count actions by type for this campaign
      const { data: actions, error } = await supabase
        .from('actions_log')
        .select('action_type, status')
        .eq('campaign_id', campaignId)
        .eq('workspace_id', workspaceId)
      
      if (error) throw error
      
      // Aggregate stats
      const stats = {
        connections_sent: actions.filter(a => a.action_type === 'connection_request' && a.status === 'pending').length,
        connections_accepted: actions.filter(a => a.action_type === 'connection_request' && a.status === 'completed').length,
        messages_sent: actions.filter(a => a.action_type === 'message' && a.status === 'completed').length,
        replies_received: actions.filter(a => a.action_type === 'reply' || a.status === 'replied').length,
        opportunities: 0
      }
      
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
      const { id: _, created_at: __, updated_at: ___, started_at: ____, completed_at: _____, workspace_id, ...cloneData } = original
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
    mutationFn: async ({ leadId, profileUrl, linkedinAccountId, note }) => {
      if (!workspaceId) throw new Error('No workspace selected')

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

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
              payload: {
                profile_url: profileUrl,
                message: note || null,
              },
            },
          }),
        }
      )

      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Failed to queue connection request')
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-leads'] })
      toast.success('Connection request queued')
    },
    onError: (err) => {
      toast.error(err.message)
    },
  })
}

/**
 * useUpdateAccountLimits: Update daily_connection_limit / daily_message_limit for an account
 */
export function useUpdateAccountLimits() {
  const { workspaceId } = useWorkspaceStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ accountId, connectionLimit, messageLimit }) => {
      if (!workspaceId) throw new Error('No workspace selected')
      const { data, error } = await supabase
        .from('linkedin_accounts')
        .update({
          daily_connection_limit: connectionLimit,
          daily_message_limit: messageLimit,
        })
        .eq('id', accountId)
        .eq('workspace_id', workspaceId)
        .select()

      if (error) throw error
      return data[0]
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-accounts'] })
      toast.success('Limits updated')
    }
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

      const leadsToInsert = leads.map(lead => ({
        workspace_id: workspaceId,
        first_name: lead.first_name || null,
        last_name: lead.last_name || null,
        full_name: lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || null,
        headline: lead.headline || null,
        company: lead.company || null,
        title: lead.title || null,
        email: lead.email || null,
        location: lead.location || null,
        profile_url: lead.profile_url,
        source: 'csv',
        connection_status: 'none',
      }))

      const { data: upsertedLeads, error: upsertError } = await supabase
        .from('leads')
        .upsert(leadsToInsert, { onConflict: 'workspace_id,profile_url', ignoreDuplicates: false })
        .select('id')

      if (upsertError) throw upsertError

      const enrollments = upsertedLeads.map(lead => ({
        workspace_id: workspaceId,
        campaign_id: campaignId,
        lead_id: lead.id,
        status: 'active',
      }))

      const { error: enrollError } = await supabase
        .from('campaign_enrollments')
        .upsert(enrollments, { onConflict: 'campaign_id,lead_id', ignoreDuplicates: true })

      if (enrollError) throw enrollError

      return upsertedLeads.length
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['campaign-leads'] })
      toast.success(`${count} lead${count !== 1 ? 's' : ''} uploaded`)
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
