import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useWorkspaceStore } from '@/store/workspaceStore'

export function useTeam() {
  const { workspaceId } = useWorkspaceStore()

  return useQuery({
    queryKey: ['team', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return []
      
      const { data, error } = await supabase
        .from('team_members')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true })
        
      if (error) throw error
      return data
    },
    enabled: !!workspaceId
  })
}

export function useInvitations() {
  const { workspaceId } = useWorkspaceStore()

  return useQuery({
    queryKey: ['invitations', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return []
      
      const { data, error } = await supabase
        .from('team_invitations')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('status', 'pending')
        
      if (error) throw error
      return data
    },
    enabled: !!workspaceId
  })
}

export function useInviteMember() {
  const queryClient = useQueryClient()
  const { workspaceId } = useWorkspaceStore()

  return useMutation({
    mutationFn: async ({ email, role }) => {
      const { data, error } = await supabase
        .from('team_invitations')
        .insert({
          workspace_id: workspaceId,
          email,
          role,
          invited_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations', workspaceId] })
    }
  })
}

export function useRemoveMember() {
  const queryClient = useQueryClient()
  const { workspaceId } = useWorkspaceStore()

  return useMutation({
    mutationFn: async (memberId) => {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberId)
        
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', workspaceId] })
    }
  })
}
