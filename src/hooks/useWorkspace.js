import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useWorkspaceStore } from '@/store/workspaceStore'

export function useWorkspace() {
  const { workspaceId } = useWorkspaceStore()

  return useQuery({
    queryKey: ['workspace', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return null
      
      const { data, error } = await supabase
        .from('workspaces')
        .select(`
          *,
          settings:workspace_settings(*)
        `)
        .eq('id', workspaceId)
        .single()
        
      if (error) throw error
      return data
    },
    enabled: !!workspaceId
  })
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient()
  const { workspaceId } = useWorkspaceStore()

  return useMutation({
    mutationFn: async (updates) => {
      const { data, error } = await supabase
        .from('workspaces')
        .update(updates)
        .eq('id', workspaceId)
        .select()
        
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] })
    }
  })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  const { workspaceId } = useWorkspaceStore()

  return useMutation({
    mutationFn: async (updates) => {
      const { data, error } = await supabase
        .from('workspace_settings')
        .upsert({ 
          workspace_id: workspaceId,
          ...updates 
        })
        .select()
        
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] })
    }
  })
}
