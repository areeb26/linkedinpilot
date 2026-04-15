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
