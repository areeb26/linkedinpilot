import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { useAuthStore } from '@/store/authStore'
import { format } from 'date-fns'
import { toast } from 'react-hot-toast'

export function useLinkedInAccounts() {
  const { workspaceId } = useWorkspaceStore()

  return useQuery({
    queryKey: ['linkedin-accounts', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return []

      // Fetch accounts
      const { data: accounts, error: accError } = await supabase
        .from('linkedin_accounts')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })

      if (accError) throw accError

      // Fetch today's action counts per account
      const today = format(new Date(), 'yyyy-MM-dd')
      const { data: stats, error: statsError } = await supabase
        .from('actions_log')
        .select('linkedin_account_id, action_type')
        .eq('workspace_id', workspaceId)
        .gte('executed_at', `${today}T00:00:00Z`)

      if (statsError) throw statsError

      // Aggregate stats
      return accounts.map(acc => {
        const accStats = stats?.filter(s => s.linkedin_account_id === acc.id) || []
        return {
          ...acc,
          today_connections: accStats.filter(s => s.action_type === 'connect').length,
          today_messages: accStats.filter(s => s.action_type === 'message').length
        }
      })
    },
    enabled: !!workspaceId
  })
}

export function useAddAccount() {
  const queryClient = useQueryClient()
  const { workspaceId } = useWorkspaceStore()
  const { user } = useAuthStore()

  return useMutation({
    mutationFn: async (accountData) => {
      const { data, error } = await supabase
        .from('linkedin_accounts')
        .insert([{ 
          ...accountData, 
          workspace_id: workspaceId,
          user_id: user?.id 
        }])
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedin-accounts', workspaceId] })
    }
  })
}

export function useUpdateAccount() {
  const queryClient = useQueryClient()
  const { workspaceId } = useWorkspaceStore()

  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      const { data, error } = await supabase
        .from('linkedin_accounts')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedin-accounts', workspaceId] })
    }
  })
}

export function useToggleAccount() {
  const queryClient = useQueryClient()
  const { workspaceId } = useWorkspaceStore()

  return useMutation({
    mutationFn: async ({ id, status }) => {
      const newStatus = status === 'active' ? 'paused' : 'active'
      const { data, error } = await supabase
        .from('linkedin_accounts')
        .update({ status: newStatus })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedin-accounts', workspaceId] })
    }
  })
}

export function useDeleteAccount() {
  const queryClient = useQueryClient()
  const { workspaceId } = useWorkspaceStore()

  return useMutation({
    mutationFn: async (id) => {
      if (!workspaceId) throw new Error('No workspace selected')
      const { error } = await supabase
        .from('linkedin_accounts')
        .delete()
        .eq('id', id)
        .eq('workspace_id', workspaceId)

      if (error) throw error
      return id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedin-accounts', workspaceId] })
    }
  })
}

