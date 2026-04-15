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
    const { workspace_id, account_data, encrypted_credentials, worker_url } = body

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

    // Insert account with encrypted credentials
    const { data: account, error: insertError } = await supabase
      .from('linkedin_accounts')
      .insert({
        ...account_data,
        workspace_id,
        user_id: user.id,
        ...encrypted_credentials,
      })
      .select()
      .single()

    if (insertError) throw insertError

    // If credentials method, notify Python worker
    if (account_data.login_method === 'credentials' && worker_url) {
      await fetch(`${worker_url}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => {
        console.warn('Worker health check failed')
      })
    }

    return new Response(JSON.stringify({ success: true, account }), {
      headers: corsHeaders,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
