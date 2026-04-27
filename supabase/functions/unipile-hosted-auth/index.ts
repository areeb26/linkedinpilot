/**
 * unipile-hosted-auth — Generate a Unipile hosted auth link server-side
 *
 * Per Unipile docs: "The utmost caution must be exercised to prevent the
 * inadvertent exposure of your X-API-KEY. It is necessary to establish an
 * intermediary backend process responsible for making this API call."
 *
 * This function generates the hosted auth link using the server-side API key
 * and returns the URL to the frontend without exposing the key.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    // Parse request body
    const { workspace_id, user_id } = await req.json()

    if (!workspace_id) {
      return new Response(JSON.stringify({ error: 'workspace_id is required' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    // Validate the caller is authenticated using the user's JWT
    const authHeader = req.headers.get('authorization') ?? ''
    const userJwt = authHeader.replace('Bearer ', '')

    if (!userJwt) {
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        status: 401,
        headers: corsHeaders,
      })
    }

    // Verify the user JWT and get user info
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Try to get user from JWT — use anon client for user validation
    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY') ?? supabaseServiceKey
    )

    let userId = user_id
    try {
      const { data: { user } } = await anonClient.auth.getUser(userJwt)
      if (user?.id) userId = user.id
    } catch {
      // Fall back to provided user_id
    }

    // Verify workspace exists and user has access
    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .select('id, owner_id')
      .eq('id', workspace_id)
      .single()

    if (wsError || !workspace) {
      return new Response(JSON.stringify({ error: 'Workspace not found' }), {
        status: 404,
        headers: corsHeaders,
      })
    }

    // Unipile credentials — server-side only, never exposed to frontend
    const unipileDsn = Deno.env.get('UNIPILE_DSN')
    const unipileApiKey = Deno.env.get('UNIPILE_API_KEY')

    if (!unipileDsn || !unipileApiKey) {
      console.error('[unipile-hosted-auth] Missing UNIPILE_DSN or UNIPILE_API_KEY secrets')
      return new Response(JSON.stringify({ error: 'Unipile credentials not configured on server. Set UNIPILE_DSN and UNIPILE_API_KEY secrets.' }), {
        status: 500,
        headers: corsHeaders,
      })
    }

    // Build the hosted auth payload per Unipile docs
    // Required fields: type, providers, api_url, expiresOn
    const expiresOn = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    const payload = {
      type: 'create',
      providers: ['LINKEDIN'],
      api_url: `https://${unipileDsn}`,
      expiresOn,
      // name is returned in the notify_url callback to match the account to workspace
      name: `${workspace_id}:${userId ?? workspace.owner_id}`,
      // notify_url receives { status, account_id, name } after successful connection
      notify_url: `${supabaseUrl}/functions/v1/unipile-webhook`,
    }

    console.log('[unipile-hosted-auth] Calling Unipile API:', JSON.stringify({ ...payload, api_url: '[REDACTED]' }))

    // Call Unipile API server-side — API key never leaves the server
    const unipileResponse = await fetch(`https://${unipileDsn}/api/v1/hosted/accounts/link`, {
      method: 'POST',
      headers: {
        'X-API-KEY': unipileApiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const responseText = await unipileResponse.text()
    console.log('[unipile-hosted-auth] Unipile response status:', unipileResponse.status)
    console.log('[unipile-hosted-auth] Unipile response body:', responseText)

    if (!unipileResponse.ok) {
      let errorBody: Record<string, unknown> = {}
      try { errorBody = JSON.parse(responseText) } catch { /* ignore */ }
      return new Response(
        JSON.stringify({ error: errorBody?.message ?? `Unipile API error ${unipileResponse.status}`, details: errorBody }),
        { status: unipileResponse.status, headers: corsHeaders }
      )
    }

    let data: Record<string, unknown> = {}
    try { data = JSON.parse(responseText) } catch { /* ignore */ }

    // data.url should be https://account.unipile.com/TOKEN
    const hostedUrl = data?.url as string | undefined
    if (!hostedUrl) {
      console.error('[unipile-hosted-auth] No url in Unipile response:', data)
      return new Response(JSON.stringify({ error: 'No URL in Unipile response', details: data }), {
        status: 500,
        headers: corsHeaders,
      })
    }

    console.log('[unipile-hosted-auth] Success, returning URL')
    return new Response(JSON.stringify({ url: hostedUrl }), { headers: corsHeaders })

  } catch (error) {
    console.error('[unipile-hosted-auth] Unexpected error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
