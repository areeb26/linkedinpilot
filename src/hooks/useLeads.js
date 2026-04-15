import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { toast } from 'react-hot-toast'

export function useLeads({ 
  page = 1, 
  search = '', 
  icp_min = 0, 
  icp_max = 100, 
  status = 'all', 
  tags = [] 
} = {}) {
  const { workspaceId } = useWorkspaceStore()
  const queryClient = useQueryClient()
  const pageSize = 50

  // Auto-refresh when new leads are inserted (e.g. by the Edge Function)
  useEffect(() => {
    if (!workspaceId) return

    const channel = supabase
      .channel(`dashboard_leads_${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'leads',
          filter: `workspace_id=eq.${workspaceId}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['leads'] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [workspaceId, queryClient])

  return useQuery({
    queryKey: ['leads', workspaceId, page, search, icp_min, icp_max, status, tags],
    queryFn: async () => {
      if (!workspaceId) {
        console.log('[Dashboard] No workspaceId, returning empty leads')
        return { data: [], count: 0 }
      }

      console.log(`[Dashboard] Fetching leads for workspace: ${workspaceId}`)

      let query = supabase
        .from('leads')
        .select('*', { count: 'exact' })
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,company.ilike.%${search}%,title.ilike.%${search}%,headline.ilike.%${search}%`)
      }

      if (icp_min > 0) query = query.gte('icp_score', icp_min)
      if (icp_max < 100) query = query.lte('icp_score', icp_max)
      if (status && status !== 'all') query = query.eq('status', status)
      if (tags && tags.length > 0) query = query.contains('tags', tags)

      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      const { data, error, count } = await query
      if (error) throw error
      console.log(`[Dashboard] Found ${count} leads in workspace ${workspaceId}`)
      return { data, count }
    },
    enabled: !!workspaceId,
  })
}

export function useCreateLead() {
  const { workspaceId } = useWorkspaceStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (newLead) => {
      const { data, error } = await supabase
        .from('leads')
        .insert([{ ...newLead, workspace_id: workspaceId }])
        .select()
      if (error) throw error
      return data[0]
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      toast.success('Lead created successfully')
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`)
    }
  })
}

export function useUpdateLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      const { data, error } = await supabase
        .from('leads')
        .update(updates)
        .eq('id', id)
        .select()
      if (error) throw error
      return data[0]
    },
    onMutate: async (updatedLead) => {
      await queryClient.cancelQueries({ queryKey: ['leads'] })
      const previousLeads = queryClient.getQueryData(['leads'])
      
      queryClient.setQueriesData({ queryKey: ['leads'] }, (old) => {
        if (!old) return old
        return {
          ...old,
          data: old.data.map(lead => 
            lead.id === updatedLead.id ? { ...lead, ...updatedLead } : lead
          )
        }
      })

      return { previousLeads }
    },
    onError: (err, updatedLead, context) => {
      queryClient.setQueriesData({ queryKey: ['leads'] }, context.previousLeads)
      toast.error(`Update failed: ${err.message}`)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
    onSuccess: () => {
      toast.success('Lead updated')
    }
  })
}

export function useDeleteLeads() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ids) => {
      const { error } = await supabase
        .from('leads')
        .delete()
        .in('id', ids)
      if (error) throw error
    },
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ['leads'] })
      const previousLeads = queryClient.getQueryData(['leads'])

      queryClient.setQueriesData({ queryKey: ['leads'] }, (old) => {
        if (!old) return old
        return {
          ...old,
          data: old.data.filter(lead => !ids.includes(lead.id)),
          count: old.count - ids.length
        }
      })

      return { previousLeads }
    },
    onError: (err, ids, context) => {
      queryClient.setQueriesData({ queryKey: ['leads'] }, context.previousLeads)
      toast.error(`Deletion failed: ${err.message}`)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
    onSuccess: () => {
      toast.success('Leads deleted')
    }
  })
}

export function useImportLeads() {
  const { workspaceId } = useWorkspaceStore()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (leads) => {
      const leadsWithWorkspace = leads.map(lead => ({
        ...lead,
        workspace_id: workspaceId
      }))

      const { data, error } = await supabase
        .from('leads')
        .insert(leadsWithWorkspace)
        .select()
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      toast.success(`${data.length} leads imported successfully`)
    },
    onError: (error) => {
      toast.error(`Import failed: ${error.message}`)
    }
  })
}

export function useWorkspaceConfig() {
  const { workspaceId } = useWorkspaceStore()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['workspace-config', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null
      const { data, error } = await supabase
        .from('workspaces')
        .select('icp_config')
        .eq('id', workspaceId)
        .single()
      
      if (error) throw error
      return data?.icp_config ?? {}
    },
    enabled: !!workspaceId
  })

  const updateMutation = useMutation({
    mutationFn: async (config) => {
      const { error } = await supabase
        .from('workspaces')
        .update({ icp_config: config })
        .eq('id', workspaceId)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-config', workspaceId] })
      toast.success('Configuration saved')
    },
    onError: (error) => {
      toast.error(`Failed to save: ${error.message}`)
    }
  })

  return { ...query, updateConfig: updateMutation.mutate, isUpdating: updateMutation.isPending }
}

export function useScoreLeads() {
  return useMutation({
    mutationFn: async ({ leads, config }) => {
      const { data, error } = await supabase.functions.invoke('icp-score', {
        body: { leads, config }
      })
      if (error) throw error
      return data.scoredLeads
    },
    onError: (error) => {
      toast.error(`Scoring failed: ${error.message}`)
    }
  })
}
