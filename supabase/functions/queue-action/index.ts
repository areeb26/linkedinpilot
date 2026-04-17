import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      req.headers.get('authorization')?.split(' ')[1] || ''
    )

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: corsHeaders,
      })
    }

    const body = await req.json()
    const { workspace_id, action } = body
    const worker_url = Deno.env.get('LOGIN_WORKER_URL') || null

    // Verify user is member of workspace
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
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

    // If credentials login method, notify worker
    if (worker_url) {
      const { data: account } = await supabase
        .from('linkedin_accounts')
        .select('login_method')
        .eq('id', action.linkedin_account_id)
        .single()

      if (account?.login_method === 'credentials') {
        fetch(`${worker_url}/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action_id: queuedAction.id }),
        }).catch((err) => {
          console.error('Failed to notify worker:', err)
        })
      }
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
