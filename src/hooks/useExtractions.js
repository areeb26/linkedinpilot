import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { toast } from 'react-hot-toast'

export function useExtractions() {
  const { workspaceId } = useWorkspaceStore()
  const [extractions, setExtractions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!workspaceId) {
      setExtractions([])
      setIsLoading(false)
      return
    }

    const fetchExtractions = async () => {
      setIsLoading(true)
      setError(null)
      try {
        // Fetch action_queue items with scrapeLeads action_type
        // These are treated as extraction "campaigns"
        const { data, error: fetchError } = await supabase
          .from('action_queue')
          .select(`
            *,
            linkedin_accounts (id, full_name, avatar_url),
            campaigns (id, name, type)
          `)
          .eq('workspace_id', workspaceId)
          .eq('action_type', 'scrapeLeads')
          .order('created_at', { ascending: false })

        if (fetchError) {
          console.error('Error fetching extractions:', fetchError)
          setError(fetchError.message)
          toast.error('Failed to load extractions')
          return
        }

        const rows = data || []

        // Also surface leads that were scraped by the extension *without* going
        // through the wizard (no action_queue_id). They live in the leads table
        // with action_queue_id=null but still belong on the Lead Extractor page.
        const { data: orphanLeads, error: orphanError } = await supabase
          .from('leads')
          .select('id, created_at')
          .eq('workspace_id', workspaceId)
          .is('action_queue_id', null)
          .eq('source', 'lead-extractor')
          .order('created_at', { ascending: false })
          .limit(1)

        if (orphanError) {
          console.warn('Orphan lead lookup failed (non-fatal):', orphanError)
        }

        if (orphanLeads && orphanLeads.length > 0) {
          rows.unshift({
            id: 'orphan-direct-scrape',
            workspace_id: workspaceId,
            action_type: 'scrapeLeads',
            status: 'done',
            created_at: orphanLeads[0].created_at,
            linkedin_accounts: null,
            campaigns: { id: null, name: 'Direct Extension Scrape', type: 'lead-extractor' },
            _orphan: true,
          })
        }

        setExtractions(rows)
      } catch (err) {
        console.error('Unexpected error in fetchExtractions:', err)
        setError(err.message)
        toast.error('Failed to load extractions')
      } finally {
        setIsLoading(false)
      }
    }

    fetchExtractions()

    // Realtime subscription
    const channel = supabase
      .channel(`dashboard_extractions_${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'action_queue',
          filter: `workspace_id=eq.${workspaceId}`
        },
        () => {
          fetchExtractions()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'leads',
          filter: `workspace_id=eq.${workspaceId}`
        },
        () => {
          // New leads may include orphan scrapes — re-derive the synthetic row.
          fetchExtractions()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe().then(() => {
        supabase.removeChannel(channel)
      })
    }
  }, [workspaceId])

  return { extractions, isLoading, error }
}

export function useExtractionLeads(extractionId) {
  const { workspaceId } = useWorkspaceStore()
  const [leads, setLeads] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [extraction, setExtraction] = useState(null)

  useEffect(() => {
    if (!workspaceId || !extractionId) {
      setLeads([])
      setExtraction(null)
      setIsLoading(false)
      return
    }

    const fetchData = async () => {
      setIsLoading(true)
      try {
        const isOrphan = extractionId === 'orphan-direct-scrape'

        if (isOrphan) {
          // Synthetic extraction — represents leads scraped directly by the
          // extension without a matching action_queue row.
          setExtraction({
            id: extractionId,
            status: 'done',
            created_at: new Date().toISOString(),
            linkedin_accounts: null,
            campaigns: { id: null, name: 'Direct Extension Scrape', type: 'lead-extractor' },
          })
        } else {
          // Fetch extraction details
          const { data: extractionData, error: extractionError } = await supabase
            .from('action_queue')
            .select(`
              *,
              linkedin_accounts (id, full_name, avatar_url),
              campaigns (id, name, type)
            `)
            .eq('id', extractionId)
            .single()

          if (extractionError) throw extractionError
          setExtraction(extractionData)
        }

        console.log('[DEBUG] Fetching leads for workspace:', workspaceId)

        // Fetch leads associated with this extraction. For the synthetic
        // "orphan" extraction, pull every lead that was scraped without an
        // action_queue_id so the Lead Extractor can display them.
        let leadsQuery = supabase
          .from('leads')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })
          .limit(100)

        if (isOrphan) {
          leadsQuery = leadsQuery.is('action_queue_id', null).eq('source', 'lead-extractor')
        } else {
          leadsQuery = leadsQuery.eq('action_queue_id', extractionId)
        }

        const { data: leadsData, error: leadsError } = await leadsQuery

        console.log('[DEBUG] leads with source=lead-extractor:', leadsData?.length || 0, leadsError)

        // If no leads found, try fetching all leads (debugging)
        if (!leadsData || leadsData.length === 0) {
          const { data: allLeads, error: allLeadsError } = await supabase
            .from('leads')
            .select('id, full_name, source, created_at')
            .eq('workspace_id', workspaceId)
            .order('created_at', { ascending: false })
            .limit(10)
          
          console.log('[DEBUG] All leads in workspace:', allLeads, allLeadsError)
        }

        if (leadsError) throw leadsError
        setLeads(leadsData || [])
      } catch (err) {
        console.error('Error fetching extraction data:', err)
        toast.error('Failed to load extraction details')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [workspaceId, extractionId])

  return { extraction, leads, isLoading }
}
