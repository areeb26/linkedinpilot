import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { toast } from 'react-hot-toast'

// ─── Query key factory ────────────────────────────────────────────────────────
export const extractionKeys = {
  all:    (wsId) => ['extractions', wsId],
  leads:  (wsId, extractionId) => ['extraction-leads', wsId, extractionId],
}

// ─── useExtractions ───────────────────────────────────────────────────────────
// Converted from manual useState/useEffect to React Query so:
//   • Data is cached — navigating away and back is instant
//   • Mutations can call invalidateQueries to refresh immediately
//   • Background refetch keeps data fresh without blocking the UI
export function useExtractions() {
  const { workspaceId } = useWorkspaceStore()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: extractionKeys.all(workspaceId),
    queryFn: async () => {
      if (!workspaceId) return []

      const { data, error } = await supabase
        .from('action_queue')
        .select(`
          *,
          linkedin_accounts (id, full_name, avatar_url),
          campaigns (id, name, type)
        `)
        .eq('workspace_id', workspaceId)
        .eq('action_type', 'scrapeLeads')
        .order('created_at', { ascending: false })

      if (error) throw error

      const rows = data || []

      // Surface leads scraped directly by the extension (no action_queue_id)
      const { data: orphanLeads } = await supabase
        .from('leads')
        .select('id, created_at')
        .eq('workspace_id', workspaceId)
        .is('action_queue_id', null)
        .eq('source', 'prospect-extractor')
        .order('created_at', { ascending: false })
        .limit(1)

      if (orphanLeads?.length > 0) {
        rows.unshift({
          id: 'orphan-direct-scrape',
          workspace_id: workspaceId,
          action_type: 'scrapeLeads',
          status: 'done',
          created_at: orphanLeads[0].created_at,
          linkedin_accounts: null,
          campaigns: { id: null, name: 'Direct Extension Scrape', type: 'prospect-extractor' },
          _orphan: true,
        })
      }

      return rows
    },
    enabled: !!workspaceId,
    staleTime: 30_000,       // 30s — extractions change infrequently
    gcTime:    5 * 60_000,   // keep in cache 5 min after unmount
  })

  // Realtime subscription — invalidate the query when action_queue changes
  useEffect(() => {
    if (!workspaceId) return
    let channel = null
    let active = true

    const timer = setTimeout(() => {
      if (!active) return
      channel = supabase
        .channel(`extractions_rt_${workspaceId}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'action_queue',
          filter: `workspace_id=eq.${workspaceId}`,
        }, () => {
          if (active) queryClient.invalidateQueries({ queryKey: extractionKeys.all(workspaceId) })
        })
        .subscribe()
    }, 100)

    return () => {
      active = false
      clearTimeout(timer)
      if (channel) supabase.removeChannel(channel)
    }
  }, [workspaceId, queryClient])

  return {
    extractions: query.data ?? [],
    isLoading:   query.isLoading,
    error:       query.error?.message ?? null,
  }
}

// ─── useExtractionLeads ───────────────────────────────────────────────────────
export function useExtractionLeads(extractionId) {
  const { workspaceId } = useWorkspaceStore()

  const query = useQuery({
    queryKey: extractionKeys.leads(workspaceId, extractionId),
    queryFn: async () => {
      if (!workspaceId || !extractionId) return { extraction: null, leads: [] }

      const isOrphan = extractionId === 'orphan-direct-scrape'

      let extraction
      if (isOrphan) {
        extraction = {
          id: extractionId,
          status: 'done',
          created_at: new Date().toISOString(),
          linkedin_accounts: null,
          campaigns: { id: null, name: 'Direct Extension Scrape', type: 'prospect-extractor' },
        }
      } else {
        const { data, error } = await supabase
          .from('action_queue')
          .select(`*, linkedin_accounts (id, full_name, avatar_url), campaigns (id, name, type)`)
          .eq('id', extractionId)
          .single()
        if (error) throw error
        extraction = data
      }

      let leadsQuery = supabase
        .from('leads')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(500)

      if (isOrphan) {
        leadsQuery = leadsQuery.is('action_queue_id', null).eq('source', 'prospect-extractor')
      } else {
        leadsQuery = leadsQuery.eq('action_queue_id', extractionId)
      }

      const { data: leadsData, error: leadsError } = await leadsQuery
      if (leadsError) throw leadsError

      return { extraction, leads: leadsData ?? [] }
    },
    enabled: !!workspaceId && !!extractionId,
    staleTime: 30_000,
  })

  return {
    extraction: query.data?.extraction ?? null,
    leads:      query.data?.leads ?? [],
    isLoading:  query.isLoading,
  }
}
