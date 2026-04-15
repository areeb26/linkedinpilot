import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { toast } from 'react-hot-toast'

export function useActionQueue() {
  const { workspaceId } = useWorkspaceStore()
  const [actions, setActions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!workspaceId) {
      setActions([])
      setIsLoading(false)
      return
    }

    const fetchActions = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const { data, error: fetchError } = await supabase
          .from('action_queue')
          .select(`
            *,
            linkedin_accounts (full_name, avatar_url),
            campaigns (name)
          `)
          .eq('workspace_id', workspaceId)
          .eq('action_type', 'scrapeLeads')
          .order('created_at', { ascending: false })
          .limit(5)

        if (fetchError) {
          console.error('Error fetching action queue:', fetchError)
          setError(fetchError.message)
          toast.error('Failed to load action queue')
        } else {
          setActions(data || [])
        }
      } catch (err) {
        console.error('Unexpected error in fetchActions:', err)
        setError(err.message)
        toast.error('Failed to load action queue')
      } finally {
        setIsLoading(false)
      }
    }

    fetchActions()

    // Realtime subscription
    const channel = supabase
      .channel(`dashboard_action_queue_${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'action_queue',
          filter: `workspace_id=eq.${workspaceId}`
        },
        () => {
          fetchActions()
        }
      )
      .subscribe()

    return () => {
      // Proper cleanup: unsubscribe then remove
      channel.unsubscribe().then(() => {
        supabase.removeChannel(channel)
      })
    }
  }, [workspaceId])

  return { actions, isLoading, error }
}
