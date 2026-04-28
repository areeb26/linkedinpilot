import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { toast } from 'react-hot-toast'

/**
 * useConversations: Fetches unique threads and their latest messages
 */
export function useConversations() {
  const { workspaceId } = useWorkspaceStore()

  return useQuery({
    queryKey: ['conversations', workspaceId],
    queryFn: async () => {
      console.log('[useConversations] Starting fetch, workspaceId:', workspaceId)

      if (!workspaceId) {
        console.warn('[useConversations] No workspaceId, returning empty')
        return []
      }

      try {
        console.log('[useConversations] Querying Supabase for messages...')

        // Detailed fetch with joins
        const { data, error } = await supabase
          .from('messages')
          .select(`
            *,
            lead:leads(*),
            account:linkedin_accounts(full_name, avatar_url)
          `)
          .eq('workspace_id', workspaceId)
          .order('sent_at', { ascending: false })

        console.log('[useConversations] Supabase response:', { dataLength: data?.length, error })

        if (error) {
          console.error('[useConversations] Supabase error:', error)
          throw error
        }

        if (!data || data.length === 0) {
          console.log('[useConversations] No messages found for workspace:', workspaceId)
          return []
        }

        console.log('[useConversations] Raw messages count:', data.length)

        // Group by thread_id and keep only the latest message
        const threads = []
        const seenThreads = new Set()

        data.forEach(msg => {
          if (!seenThreads.has(msg.thread_id)) {
            seenThreads.add(msg.thread_id)
            threads.push({
              thread_id: msg.thread_id,
              lastMessage: msg,
              lead: msg.lead,
              account: msg.account,
              unreadCount: 0
            })
          }
        })

        console.log('[useConversations] Unique threads found:', threads.length)

        // Calculate unread counts
        threads.forEach(thread => {
          thread.unreadCount = data.filter(m => m.thread_id === thread.thread_id && !m.is_read && m.direction === 'inbound').length
        })

        console.log('[useConversations] Returning threads:', threads.length)
        return threads

      } catch (error) {
        console.error('[useConversations] Error:', error)
        throw error
      }
    },
    enabled: !!workspaceId
  })
}

/**
 * useThread: Fetch full history for a thread
 */
export function useThread(threadId) {
  const { workspaceId } = useWorkspaceStore()

  return useQuery({
    queryKey: ['thread', threadId, workspaceId],
    queryFn: async () => {
      if (!threadId || !workspaceId) {
        console.log('[useThread] Skipping query - missing threadId or workspaceId:', { threadId, workspaceId })
        return []
      }

      console.log('[useThread] Fetching messages for thread:', threadId, 'workspace:', workspaceId)

      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          lead:leads(*),
          account:linkedin_accounts(*)
        `)
        .eq('thread_id', threadId)
        .eq('workspace_id', workspaceId)
        .order('sent_at', { ascending: true })

      if (error) {
        console.error('[useThread] Query error:', error)
        throw error
      }

      console.log('[useThread] Fetched', data?.length || 0, 'messages')
      return data || []
    },
    enabled: !!threadId && !!workspaceId
  })
}

/**
 * useMarkRead
 */
export function useMarkRead() {
  const queryClient = useQueryClient()
  const { workspaceId } = useWorkspaceStore()

  return useMutation({
    mutationFn: async (threadId) => {
      const { error } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('thread_id', threadId)
        .eq('workspace_id', workspaceId)
        .eq('is_read', false)
        .eq('direction', 'inbound')
      
      if (error) throw error
    },
    onSuccess: (_, threadId) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['thread', threadId] })
    }
  })
}

/**
 * useSendMessage
 */
export function useSendMessage() {
  const queryClient = useQueryClient()
  const { workspaceId } = useWorkspaceStore()

  return useMutation({
    mutationFn: async ({ thread_id, body, lead_id, linkedin_account_id, campaign_id, profile_url }) => {
      const { data, error } = await supabase
        .from('messages')
        .insert([{
          workspace_id: workspaceId,
          thread_id,
          body,
          lead_id,
          linkedin_account_id,
          campaign_id,
          direction: 'outbound',
          sent_at: new Date().toISOString()
        }])
        .select()

      if (error) throw error

      // Queue the actual LinkedIn delivery via worker/extension
      if (profile_url && linkedin_account_id) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          fetch(
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
                  action_type: 'message',
                  linkedin_account_id,
                  lead_id,
                  campaign_id: campaign_id || null,
                  payload: { profile_url, message: body, threadId: thread_id },
                },
              }),
            }
          ).catch((err) => console.error('Failed to queue message action:', err))
        }
      }

      return data[0]
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['thread', data.thread_id] })
    }
  })
}

/**
 * useSetLabel (Sentiment)
 */
export function useSetLabel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ messageId, sentiment }) => {
      const { error } = await supabase
        .from('messages')
        .update({ sentiment })
        .eq('id', messageId)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      queryClient.invalidateQueries({ queryKey: ['thread'] })
    }
  })
}

/**
 * useRealtime: Listens for new messages globally
 */
export function useRealtime() {
  const queryClient = useQueryClient()
  const { workspaceId } = useWorkspaceStore()

  useEffect(() => {
    if (!workspaceId || supabase.supabaseUrl.includes('placeholder')) return

    const channel = supabase
      .channel(`public:messages:workspace:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for all changes (INSERT, UPDATE)
          schema: 'public',
          table: 'messages',
          filter: `workspace_id=eq.${workspaceId}`
        },
        (payload) => {
          try {
            console.log('Message change detected:', payload)
            queryClient.invalidateQueries({ queryKey: ['conversations'] })
            queryClient.invalidateQueries({ queryKey: ['thread', payload.new.thread_id] })
            
            if (payload.eventType === 'INSERT' && payload.new.direction === 'inbound') {
              toast('New message received', {
                icon: '📩',
              })
            }
          } catch (err) {
            console.error('Realtime callback error:', err)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [workspaceId, queryClient])
}
