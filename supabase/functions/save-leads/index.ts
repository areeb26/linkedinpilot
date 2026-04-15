import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

/**
 * save-leads — upserts scraped leads and optionally updates an action_queue row.
 *
 * Body:
 *   workspace_id     string   — required
 *   leads            Lead[]   — required (can be empty to just update status)
 *   campaign_id      string?  — enroll leads into campaign_enrollments
 *   action_queue_id  string?  — update action_queue status when provided
 *   action_status    string?  — status value to write (e.g. "completed", "failed")
 */
serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Use service role key — bypasses RLS so extension can write leads
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const { workspace_id, leads = [], campaign_id, action_queue_id, action_status } = body

    if (!workspace_id) {
      return new Response(JSON.stringify({ error: 'workspace_id is required' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    let savedCount = 0
    const savedLeadIds: string[] = []

    // 1. Upsert leads (deduplicate by workspace_id + profile_url)
    if (leads.length > 0) {
      const rows = leads
        .filter((l: any) => l.profile_url && l.profile_url.includes('/in/'))
        .map((l: any) => ({
          workspace_id,
          action_queue_id: action_queue_id || null, // Add action_queue_id here
          profile_url: l.profile_url,
          full_name: l.full_name || null,
          first_name: l.first_name || l.full_name?.split(' ')[0] || null,
          last_name: l.last_name || (l.full_name?.split(' ').slice(1).join(' ') || null),
          headline: l.headline || null,
          title: l.title || null,
          company: l.company || null,
          location: l.location || null,
          avatar_url: l.avatar_url || null,
          linkedin_member_id: l.member_id || null,
          industry: l.industry || null,
          source: l.source || 'lead-extractor',
          connection_status: l.connection_status || 'none',
          status: 'new',
        }))

      if (rows.length > 0) {
        const { data: upserted, error: upsertError } = await supabase
          .from('leads')
          .upsert(rows, {
            onConflict: 'workspace_id,profile_url',
            ignoreDuplicates: false,
          })
          .select('id')

        if (upsertError) {
          console.error('Lead upsert error:', upsertError)
          throw upsertError
        }

        savedCount = upserted?.length ?? 0
        upserted?.forEach((r: any) => savedLeadIds.push(r.id))
      }
    }

    // 2. Enroll leads into campaign if campaign_id provided
    if (campaign_id && savedLeadIds.length > 0) {
      const enrollments = savedLeadIds.map((lead_id) => ({
        workspace_id,
        campaign_id,
        lead_id,
        status: 'pending',
      }))

      const { error: enrollError } = await supabase
        .from('campaign_enrollments')
        .upsert(enrollments, {
          onConflict: 'campaign_id,lead_id',
          ignoreDuplicates: true,
        })

      if (enrollError) {
        // Non-fatal — leads are saved, enrollment failed
        console.error('Campaign enrollment error:', enrollError)
      }
    }

    // 3. Update action_queue status if requested
    if (action_queue_id && action_status) {
      const { error: statusError } = await supabase
        .from('action_queue')
        .update({
          status: action_status,
          result: { leads_saved: savedCount },
          updated_at: new Date().toISOString(),
        })
        .eq('id', action_queue_id)
        .eq('workspace_id', workspace_id)

      if (statusError) {
        console.error('Action status update error:', statusError)
      }
    }

    return new Response(
      JSON.stringify({ success: true, saved: savedCount, lead_ids: savedLeadIds }),
      { headers: corsHeaders }
    )
  } catch (error: any) {
    console.error('save-leads error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
