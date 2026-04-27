import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'
import { resolveAuth } from '../_shared/auth.ts'

async function encryptValue(plaintext: string, keyStr: string): Promise<string> {
  const keyBytes = new TextEncoder().encode(keyStr.slice(0, 32).padEnd(32, '0'))
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext))
  const ivB64 = btoa(String.fromCharCode(...iv))
  const encB64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)))
  return `${ivB64}:${encB64}`
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { email, password, workspace_id } = await req.json()

    const { userId, error: authError } = await resolveAuth(req, supabase, workspace_id)
    if (authError || !userId) {
      return new Response(JSON.stringify({ error: authError || 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const { data: member } = await supabase
      .from('team_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', userId)
      .single()
    if (!member) {
      return new Response(JSON.stringify({ error: 'Not a workspace member' }), { status: 403, headers: corsHeaders })
    }

    const aesSecret = Deno.env.get('WORKSPACE_AES_SECRET')!
    const [li_email_enc, li_password_enc] = await Promise.all([
      encryptValue(email, aesSecret),
      encryptValue(password, aesSecret),
    ])

    const { data: account, error: insertError } = await supabase
      .from('linkedin_accounts')
      .upsert({
        workspace_id,
        user_id: userId,
        full_name: email,
        email,
        login_method: 'credentials',
        status: 'pending',
        li_email_enc,
        li_password_enc,
      }, {
        onConflict: 'workspace_id,email',
        ignoreDuplicates: false,
      })
      .select()
      .single()
    if (insertError) throw insertError

    const { data: queuedAction, error: queueError } = await supabase
      .from('action_queue')
      .insert({
        workspace_id,
        linkedin_account_id: account.id,
        action_type: 'login',
        payload: {},
        status: 'pending',
      })
      .select()
      .single()
    if (queueError) throw queueError

    const workerUrl = Deno.env.get('LOGIN_WORKER_URL')
    if (workerUrl) {
      fetch(`${workerUrl}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: queuedAction.id }),
      }).catch((err) => console.error('Failed to notify worker:', err))
    }

    return new Response(JSON.stringify({ success: true, account }), { headers: corsHeaders })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
