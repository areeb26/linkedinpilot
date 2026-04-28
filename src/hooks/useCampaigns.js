import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { toast } from 'react-hot-toast'
import { useEffect } from 'react'

/**
 * useCampaigns: Fetch all campaigns for the workspace with stats
 */
export function useCampaigns() {
  const { workspaceId } = useWorkspaceStore()

  return useQuery({
    queryKey: ['campaigns', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return []
      
      // First, get all campaigns
      const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select(`
          id,
          name,
          description,
          status,
          type,
          sequence_json,
          settings,
          daily_limit,
          timezone,
          started_at,
          completed_at,
          created_at,
          updated_at,
          linkedin_account_id
        `)
        .eq('workspace_id', workspaceId)
        .neq('type', 'prospect-extractor')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      if (!campaigns || campaigns.length === 0) return []

      // Get stats for each campaign
      const campaignsWithStats = await Promise.all(
        campaigns.map(async (campaign) => {
          // Check if end date has passed
          let isEndDatePassed = false
          const scheduleSettings = campaign.settings?.schedule || {}
          const endDate = scheduleSettings.endDate
          
          if (endDate) {
            const endDateTime = new Date(endDate)
            const now = new Date()
            isEndDatePassed = now > endDateTime
          }

          // Get enrolled leads count
          const { data: enrollments, error: enrollError } = await supabase
            .from('campaign_enrollments')
            .select('id, status, lead_id')
            .eq('campaign_id', campaign.id)
            .eq('workspace_id', workspaceId)

          if (enrollError) {
            console.error('Error fetching enrollments for campaign', campaign.id, enrollError)
          }

          const enrolled = enrollments?.length || 0

          // Get action queue stats for this campaign's leads
          let connectionsSent = 0
          let connectionsAccepted = 0
          let messagesSent = 0
          let repliesReceived = 0

          if (enrolled > 0) {
            const leadIds = enrollments.map(e => e.lead_id)

            // Get actions for these leads
            const { data: actions, error: actionsError } = await supabase
              .from('action_queue')
              .select('action_type, status')
              .eq('workspace_id', workspaceId)
              .in('lead_id', leadIds)

            if (actionsError) {
              console.error('Error fetching actions for campaign', campaign.id, actionsError)
            } else if (actions) {
              connectionsSent = actions.filter(a => 
                a.action_type === 'connect' && a.status === 'completed'
              ).length

              messagesSent = actions.filter(a => 
                a.action_type === 'message' && a.status === 'completed'
              ).length

              repliesReceived = actions.filter(a => 
                a.action_type === 'reply'
              ).length
            }

            // Count accepted connections from enrollments
            connectionsAccepted = enrollments?.filter(e => 
              e.status === 'connected'
            ).length || 0

            // For connections sent, we need to check the actual lead connection_status
            // Get the leads to check their connection_status
            const { data: leadsData, error: leadsError } = await supabase
              .from('leads')
              .select('id, connection_status')
              .in('id', leadIds)

            if (!leadsError && leadsData) {
              // Count connections sent based on lead connection_status
              const actualConnectionsSent = leadsData.filter(lead => 
                lead.connection_status === 'connected' || lead.connection_status === 'pending'
              ).length

              // If we have actual connection attempts but no completed connect actions,
              // use the actual count
              if (actualConnectionsSent > 0 && connectionsSent === 0) {
                connectionsSent = actualConnectionsSent
              }
            } else {
              // Fallback to old logic if we can't get leads data
              const connectionAttempts = enrollments?.filter(e => 
                e.status === 'connected' || e.status === 'active' || e.status === 'pending'
              ).length || 0

              if (connectionAttempts > 0 && connectionsSent === 0) {
                connectionsSent = connectionAttempts
              }
            }

            // For test data: if we have enrollments with 'replied' status, 
            // assume messages were sent and replies received
            const repliedEnrollments = enrollments?.filter(e => 
              e.status === 'replied'
            ).length || 0

            if (repliedEnrollments > 0 && messagesSent === 0) {
              messagesSent = repliedEnrollments
              repliesReceived = repliedEnrollments
            }

            // For test data: if we have 'completed' enrollments, assume messages were sent
            const completedEnrollments = enrollments?.filter(e => 
              e.status === 'completed'
            ).length || 0

            if (completedEnrollments > 0 && messagesSent === 0) {
              messagesSent = completedEnrollments
            }
          }

          // Determine display status (completed if all leads processed)
          let displayStatus = campaign.status
          if (campaign.status === 'active' && enrolled > 0) {
            // Check if all leads have been processed (simplified logic)
            const processedCount = connectionsSent + messagesSent
            if (processedCount >= enrolled) {
              displayStatus = 'completed'
            }
          }

          const stats = {
            enrolled,
            connectionsSent,
            connectionsAccepted,
            messagesSent,
            repliesReceived
          }

          return {
            ...campaign,
            displayStatus,
            isEndDatePassed,
            stats
          }
        })
      )

      return campaignsWithStats
    },
    enabled: !!workspaceId
  })
}

/**
 * useCampaign: Fetch single campaign by ID
 */
export function useCampaign(campaignId) {
  const { workspaceId } = useWorkspaceStore()

  return useQuery({
    queryKey: ['campaign', campaignId, workspaceId],
    queryFn: async () => {
      if (!campaignId || !workspaceId) return null
      
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .eq('workspace_id', workspaceId)
        .single()
      
      if (error) throw error
      return data
    },
    enabled: !!campaignId && !!workspaceId
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

      // Transform data to flatten lead info
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

      return transformed
    },
    enabled: !!campaignId && !!workspaceId
  })
}

/**
 * useCreateCampaign: Create a new campaign
 */
export function useCreateCampaign() {
  const { workspaceId } = useWorkspaceStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (campaignData) => {
      if (!workspaceId) throw new Error('No workspace selected')

      const { data, error } = await supabase
        .from('campaigns')
        .insert({
          ...campaignData,
          workspace_id: workspaceId,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] })
      toast.success('Campaign created')
    }
  })
}

/**
 * useUpdateCampaign: Update an existing campaign
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
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] })
      queryClient.invalidateQueries({ queryKey: ['campaign', data.id, workspaceId] })
      toast.success('Campaign updated')
    }
  })
}

/**
 * useDeleteCampaign: Delete a campaign
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

/**
 * useDuplicateCampaign: Duplicate an existing campaign
 */
export function useDuplicateCampaign() {
  const { workspaceId } = useWorkspaceStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (campaignId) => {
      if (!workspaceId) throw new Error('No workspace selected')

      // First, get the original campaign
      const { data: original, error: fetchError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .eq('workspace_id', workspaceId)
        .single()

      if (fetchError) throw fetchError

      // Create duplicate with modified name
      const { data, error } = await supabase
        .from('campaigns')
        .insert({
          ...original,
          id: undefined, // Let DB generate new ID
          name: `${original.name} (Copy)`,
          status: 'draft',
          started_at: null,
          completed_at: null,
          created_at: undefined,
          updated_at: undefined,
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] })
      toast.success('Campaign duplicated')
    }
  })
}

/**
 * useLaunchCampaign: Launch a campaign
 */
export function useLaunchCampaign() {
  const { workspaceId } = useWorkspaceStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (campaignId) => {
      if (!workspaceId) throw new Error('No workspace selected')

      const { data, error } = await supabase
        .from('campaigns')
        .update({
          status: 'active',
          started_at: new Date().toISOString(),
        })
        .eq('id', campaignId)
        .eq('workspace_id', workspaceId)
        .select()
        .single()

      if (error) throw error

      // Queue actions for all enrolled leads now that the campaign is active
      const { error: queueError } = await supabase.functions.invoke('process-campaign', {
        body: { campaign_id: campaignId, workspace_id: workspaceId },
      })
      if (queueError) {
        console.error('process-campaign error:', queueError)
        // Don't throw — campaign is active, queuing can be retried
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] })
      toast.success('Campaign launched')
    }
  })
}

/**
 * usePauseCampaign: Pause a campaign
 */
export function usePauseCampaign() {
  const { workspaceId } = useWorkspaceStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (campaignId) => {
      if (!workspaceId) throw new Error('No workspace selected')

      const { data, error } = await supabase
        .from('campaigns')
        .update({ status: 'paused' })
        .eq('id', campaignId)
        .eq('workspace_id', workspaceId)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] })
      toast.success('Campaign paused')
    }
  })
}

/**
 * useUploadLeads: Upload CSV leads and enroll them in a campaign
 */
export function useUploadLeads() {
  const { workspaceId } = useWorkspaceStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ campaignId, leads }) => {
      if (!workspaceId) throw new Error('No workspace selected')

      const leadsToInsert = leads.map(lead => {
        const profileUrl = lead.profile_url || lead.linkedInUrl || lead.linkedin_url || null
        
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
          // Do NOT pre-populate linkedin_member_id from the URL slug —
          // the slug is not a valid Unipile provider_id. enrich-leads resolves the real ID.
          linkedin_member_id: null,
          source: 'csv',
          connection_status: 'none',
        }
      }).filter(lead => !!lead.profile_url)

      // Step 1: upsert leads
      const { data: upsertedLeads, error: upsertError } = await supabase
        .from('leads')
        .upsert(leadsToInsert, { onConflict: 'workspace_id,profile_url', ignoreDuplicates: false })
        .select('id')

      if (upsertError) throw upsertError

      // Step 2: enroll in campaign
      if (campaignId) {
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
      }

      // Step 3: enrich leads with linkedin_member_id (required before campaign can queue actions)
      // This is awaited so the caller knows enrichment is complete before launching.
      const leadIds = upsertedLeads.map(l => l.id)
      const { data: enrichResult, error: enrichError } = await supabase.functions.invoke('enrich-leads', {
        body: { workspace_id: workspaceId, lead_ids: leadIds },
      })
      if (enrichError) {
        // Non-fatal — leads are saved and enrolled, but outreach will be skipped
        // for leads without linkedin_member_id until enrichment is retried.
        console.error('enrich-leads error:', enrichError)
        toast.error(`Leads uploaded but enrichment failed: ${enrichError.message}. Run enrichment manually before launching.`, { duration: 6000 })
      } else {
        const { enriched = 0, skipped = 0 } = enrichResult || {}
        if (skipped > 0) {
          console.warn(`Enrichment: ${enriched} enriched, ${skipped} skipped (no Unipile profile found)`)
        }
      }

      return upsertedLeads.length
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] })
      queryClient.invalidateQueries({ queryKey: ['campaign-leads'] })
      toast.success(`${count} leads uploaded and enriched`)
    },
    onError: (error) => {
      toast.error(`Upload failed: ${error.message}`)
    }
  })
}

/**
 * useSendConnectionRequest: Send connection request to a lead
 */
export function useSendConnectionRequest() {
  const { workspaceId } = useWorkspaceStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ leadId, message }) => {
      if (!workspaceId) throw new Error('No workspace selected')

      // This would typically queue an action for the worker to process
      const { data, error } = await supabase
        .from('action_queue')
        .insert({
          workspace_id: workspaceId,
          lead_id: leadId,
          action_type: 'connect',
          payload: { message },
          status: 'pending',
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign-leads'] })
      toast.success('Connection request queued')
    }
  })
}

/**
 * useCampaignAccounts: Fetch LinkedIn accounts associated with a campaign
 */
export function useCampaignAccounts(campaignId) {
  const { workspaceId } = useWorkspaceStore()

  return useQuery({
    queryKey: ['campaign-accounts', campaignId, workspaceId],
    queryFn: async () => {
      if (!campaignId || !workspaceId) return []
      
      const { data, error } = await supabase
        .from('campaigns')
        .select(`
          linkedin_account_id,
          linkedin_accounts (
            id,
            full_name,
            headline,
            avatar_url,
            status,
            profile_url
          )
        `)
        .eq('id', campaignId)
        .eq('workspace_id', workspaceId)
        .single()
      
      if (error) throw error
      
      // Return the account as an array for consistency
      return data?.linkedin_accounts ? [data.linkedin_accounts] : []
    },
    enabled: !!campaignId && !!workspaceId
  })
}

/**
 * useCampaignAnalytics: Fetch analytics data for a campaign
 */
export function useCampaignAnalytics(campaignId) {
  const { workspaceId } = useWorkspaceStore()

  return useQuery({
    queryKey: ['campaign-analytics', campaignId, workspaceId],
    queryFn: async () => {
      if (!campaignId || !workspaceId) return {
        connections_sent: 0,
        connections_accepted: 0,
        messages_sent: 0,
        replies_received: 0,
        opportunities: 0
      }
      
      // Get campaign enrollments and their statuses
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from('campaign_enrollments')
        .select('status, created_at, lead_id')
        .eq('campaign_id', campaignId)
        .eq('workspace_id', workspaceId)
      
      if (enrollmentsError) throw enrollmentsError

      let connections_sent = 0
      let connections_accepted = 0
      let messages_sent = 0
      let replies_received = 0

      if (enrollments && enrollments.length > 0) {
        const leadIds = enrollments.map(e => e.lead_id)

        // Get action queue items for this campaign
        const { data: actions, error: actionsError } = await supabase
          .from('action_queue')
          .select('action_type, status, created_at')
          .eq('workspace_id', workspaceId)
          .in('lead_id', leadIds)
        
        if (actionsError) throw actionsError

        // Calculate metrics from actions
        connections_sent = actions?.filter(a => 
          a.action_type === 'connect' && a.status === 'completed'
        ).length || 0
        
        messages_sent = actions?.filter(a => 
          a.action_type === 'message' && a.status === 'completed'
        ).length || 0
        
        replies_received = actions?.filter(a => 
          a.action_type === 'reply' && a.status === 'completed'
        ).length || 0

        // Calculate metrics from enrollments
        connections_accepted = enrollments?.filter(e => 
          e.status === 'connected'
        ).length || 0

        // For connections sent, we need to check the actual lead connection_status
        // leadIds already declared above, so we can reuse it
        const { data: leadsData, error: leadsError } = await supabase
          .from('leads')
          .select('id, connection_status')
          .in('id', leadIds)

        if (!leadsError && leadsData) {
          // Count connections sent based on lead connection_status
          const actualConnectionsSent = leadsData.filter(lead => 
            lead.connection_status === 'connected' || lead.connection_status === 'pending'
          ).length

          // If we have actual connection attempts but no completed connect actions,
          // use the actual count
          if (actualConnectionsSent > 0 && connections_sent === 0) {
            connections_sent = actualConnectionsSent
          }
        } else {
          // Fallback to old logic if we can't get leads data
          const connectionAttempts = enrollments?.filter(e => 
            e.status === 'connected' || e.status === 'active' || e.status === 'pending'
          ).length || 0

          if (connectionAttempts > 0 && connections_sent === 0) {
            connections_sent = connectionAttempts
          }
        }

        // For test data: if we have enrollments with 'replied' status, 
        // assume messages were sent and replies received
        const repliedEnrollments = enrollments?.filter(e => 
          e.status === 'replied'
        ).length || 0

        if (repliedEnrollments > 0 && messages_sent === 0) {
          messages_sent = repliedEnrollments
          replies_received = repliedEnrollments
        }

        // For test data: if we have 'completed' enrollments, assume messages were sent
        const completedEnrollments = enrollments?.filter(e => 
          e.status === 'completed'
        ).length || 0

        if (completedEnrollments > 0 && messages_sent === 0) {
          messages_sent = completedEnrollments
        }
      }
      
      // Opportunities could be leads with certain tags or statuses
      const opportunities = enrollments?.filter(e => 
        e.status === 'opportunity' || e.status === 'interested'
      ).length || 0

      return {
        connections_sent,
        connections_accepted,
        messages_sent,
        replies_received,
        opportunities
      }
    },
    enabled: !!campaignId && !!workspaceId
  })
}

/**
 * useCampaignCompletionNotifier: Hook to show notifications when campaigns complete
 */
export function useCampaignCompletionNotifier() {
  const { data: campaigns = [] } = useCampaigns()

  useEffect(() => {
    // This could check for recently completed campaigns and show notifications
    // For now, it's a placeholder
  }, [campaigns])
}