import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Service role key — bypasses RLS, safe because we validate workspace ownership below
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { action_id, workspace_id, status, result } = await req.json()

    if (!action_id || !workspace_id || !status) {
      return new Response(JSON.stringify({ error: 'action_id, workspace_id, and status are required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    // Validate action belongs to claimed workspace (prevents cross-workspace tampering)
    const { data: existing, error: fetchError } = await supabase
      .from('action_queue')
      .select('id, workspace_id')
      .eq('id', action_id)
      .eq('workspace_id', workspace_id)
      .single()

    if (fetchError || !existing) {
      return new Response(JSON.stringify({ error: 'Action not found or workspace mismatch' }), {
        status: 404, headers: corsHeaders,
      })
    }

    const updates: Record<string, unknown> = { status }
    if (status === 'processing') updates.started_at = new Date().toISOString()
    if (status === 'done' || status === 'failed' || status === 'completed') {
      updates.executed_at = new Date().toISOString()
    }
    if (result !== undefined) updates.result = result

    // Normalize 'completed' → 'done' to match schema constraint
    if (updates.status === 'completed') updates.status = 'done'

    const { error: updateError } = await supabase
      .from('action_queue')
      .update(updates)
      .eq('id', action_id)

    if (updateError) throw updateError

    // Append to actions_log for done/failed actions
    if (updates.status === 'done' || updates.status === 'failed') {
      const { data: action } = await supabase
        .from('action_queue')
        .select('campaign_id, lead_id, linkedin_account_id, action_type')
        .eq('id', action_id)
        .single()

      if (action) {
        await supabase.from('actions_log').insert({
          workspace_id,
          action_queue_id: action_id,
          campaign_id: action.campaign_id,
          lead_id: action.lead_id,
          linkedin_account_id: action.linkedin_account_id,
          action_type: action.action_type,
          status: updates.status,
          result: result ?? null,
          executed_at: new Date().toISOString(),
        })
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: corsHeaders,
    })
  }
})
