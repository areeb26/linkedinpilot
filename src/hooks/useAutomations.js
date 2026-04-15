import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { toast } from 'react-hot-toast'

/**
 * useAutomations: Fetches all inbound automations for the workspace
 */
export function useAutomations() {
  const { workspaceId } = useWorkspaceStore()

  return useQuery({
    queryKey: ['automations', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return []

      const { data, error } = await supabase
        .from('automations')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    },
    enabled: !!workspaceId
  })
}

/**
 * useCreateAutomation
 */
export function useCreateAutomation() {
  const queryClient = useQueryClient()
  const { workspaceId } = useWorkspaceStore()

  return useMutation({
    mutationFn: async (automation) => {
      const { data, error } = await supabase
        .from('automations')
        .insert([{ ...automation, workspace_id: workspaceId }])
        .select()
      
      if (error) throw error
      return data[0]
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] })
      toast.success('Automation created successfully')
    }
  })
}

/**
 * useUpdateAutomation
 */
export function useUpdateAutomation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      const { data, error } = await supabase
        .from('automations')
        .update(updates)
        .eq('id', id)
        .select()
      
      if (error) throw error
      return data[0]
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] })
      toast.success('Automation updated')
    }
  })
}

/**
 * useToggleAutomation
 */
export function useToggleAutomation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status }) => {
      const { data, error } = await supabase
        .from('automations')
        .update({ status: status === 'active' ? 'inactive' : 'active' })
        .eq('id', id)
        .select()
      
      if (error) throw error
      return data[0]
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] })
    }
  })
}

/**
 * useDeleteAutomation
 */
export function useDeleteAutomation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('automations')
        .delete()
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] })
      toast.success('Automation deleted')
    }
  })
}
