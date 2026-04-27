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

    const { cookie, workspace_id, profile } = await req.json()

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
    const cookie_encrypted = await encryptValue(cookie, aesSecret)

    // Check if an account with this member_id already exists in this workspace
    const memberId = profile?.member_id || null
    let existingId: string | null = null

    if (memberId) {
      const { data: existing } = await supabase
        .from('linkedin_accounts')
        .select('id')
        .eq('workspace_id', workspace_id)
        .eq('linkedin_member_id', memberId)
        .maybeSingle()
      existingId = existing?.id ?? null
    }

    let account, upsertError

    if (existingId) {
      // Update existing account
      const { data, error } = await supabase
        .from('linkedin_accounts')
        .update({
          full_name: profile?.full_name || 'LinkedIn Account',
          avatar_url: profile?.avatar_url || null,
          profile_url: profile?.profile_url || null,
          login_method: 'cookies',
          status: 'active',
          cookie_encrypted,
        })
        .eq('id', existingId)
        .select()
        .single()
      account = data
      upsertError = error
    } else {
      // Insert new account
      const { data, error } = await supabase
        .from('linkedin_accounts')
        .insert({
          workspace_id,
          user_id: userId,
          full_name: profile?.full_name || 'LinkedIn Account',
          avatar_url: profile?.avatar_url || null,
          profile_url: profile?.profile_url || null,
          linkedin_member_id: memberId,
          login_method: 'cookies',
          status: 'active',
          cookie_encrypted,
        })
        .select()
        .single()
      account = data
      upsertError = error
    }

    if (upsertError) throw upsertError

    return new Response(JSON.stringify({ success: true, account }), { headers: corsHeaders })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
