/**
 * Unipile Webhook Handler
 *
 * Receives POST callbacks from Unipile when a hosted auth connection succeeds.
 * Payload: { status: "CREATION_SUCCESS", account_id: "...", name: "workspaceId:userId" }
 *
 * The `name` field is set by us when creating the hosted auth link and contains
 * "{workspaceId}:{userId}" so we can match the account to the right workspace.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const body = await req.json()
    console.log('[unipile-webhook] Received:', JSON.stringify(body))

    const { status, account_id, name } = body

    // Only handle successful connections
    if (status !== 'CREATION_SUCCESS' && status !== 'RECONNECTED') {
      console.log('[unipile-webhook] Ignoring status:', status)
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
    }

    if (!account_id) {
      console.error('[unipile-webhook] Missing account_id')
      return new Response(JSON.stringify({ error: 'Missing account_id' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    // Parse workspace_id from the name field (format: "workspaceId:userId")
    const [workspaceId, userId] = (name ?? '').split(':')

    if (!workspaceId) {
      console.error('[unipile-webhook] Could not parse workspaceId from name:', name)
      return new Response(JSON.stringify({ error: 'Missing workspaceId in name' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Check if this unipile_account_id already exists — prevent duplicates
    const { data: existing } = await supabase
      .from('linkedin_accounts')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('unipile_account_id', account_id)
      .maybeSingle()

    if (existing) {
      console.log('[unipile-webhook] Account already exists, skipping:', account_id)
      return new Response(JSON.stringify({ ok: true, skipped: true }), { headers: corsHeaders })
    }

    // Find the most recently created linkedin_accounts row in this workspace
    // that doesn't yet have a unipile_account_id
    const { data: rows, error: fetchError } = await supabase
      .from('linkedin_accounts')
      .select('id')
      .eq('workspace_id', workspaceId)
      .is('unipile_account_id', null)
      .order('created_at', { ascending: false })
      .limit(1)

    if (fetchError) {
      console.error('[unipile-webhook] Fetch error:', fetchError)
      throw fetchError
    }

    if (rows && rows.length > 0) {
      // Update existing row
      const { error: updateError } = await supabase
        .from('linkedin_accounts')
        .update({ unipile_account_id: account_id, status: 'active' })
        .eq('id', rows[0].id)

      if (updateError) throw updateError
      console.log('[unipile-webhook] Updated existing row:', rows[0].id)
    } else {
      // Insert a new row
      const { error: insertError } = await supabase
        .from('linkedin_accounts')
        .insert({
          workspace_id: workspaceId,
          user_id: userId || null,
          full_name: 'LinkedIn Account',
          login_method: 'hosted',
          status: 'active',
          unipile_account_id: account_id,
        })

      if (insertError) throw insertError
      console.log('[unipile-webhook] Inserted new row for account_id:', account_id)
    }

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders })
  } catch (error) {
    console.error('[unipile-webhook] Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
