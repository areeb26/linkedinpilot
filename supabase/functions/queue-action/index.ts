import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { resolveAuth } from '../_shared/auth.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const { workspace_id, action } = body
    const worker_url = Deno.env.get('LOGIN_WORKER_URL') || null

    const { userId, error: authError } = await resolveAuth(req, supabase, workspace_id)
    if (authError || !userId) {
      return new Response(JSON.stringify({ error: authError || 'Unauthorized' }), {
        status: 401,
        headers: corsHeaders,
      })
    }

    // Verify user is member of workspace
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', userId)
      .single()

    if (!teamMember) {
      return new Response(JSON.stringify({ error: 'Not a workspace member' }), {
        status: 403,
        headers: corsHeaders,
      })
    }

    // Insert action into queue
    const { data: queuedAction, error: insertError } = await supabase
      .from('action_queue')
      .insert({
        ...action,
        workspace_id,
        status: 'pending',
      })
      .select()
      .single()

    if (insertError) throw insertError

    // Route outreach actions to Python worker regardless of login_method
    // Extension only handles scrapeLeads — everything else is backend
    const WORKER_ACTION_TYPES = ['connect', 'message', 'view_profile', 'withdraw', 'inmail', 'scrapeLeads']

    if (worker_url && WORKER_ACTION_TYPES.includes(action.action_type)) {
      fetch(`${worker_url}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true',
          'ngrok-skip-browser-warning': 'true',
        },
        body: JSON.stringify({ action_id: queuedAction.id }),
      }).catch((err) => {
        console.error('Failed to notify worker:', err)
      })
    }

    return new Response(JSON.stringify({ success: true, action: queuedAction }), {
      headers: corsHeaders,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
