// @ts-ignore - Deno imports
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
// @ts-ignore - Deno imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @ts-ignore - Deno imports
import { corsHeaders, handleCors } from '../_shared/cors.ts'
// @ts-ignore - Deno imports
import { resolveAuth } from '../_shared/auth.ts'

declare const Deno: { env: { get(key: string): string | undefined } }

/**
 * Extract the LinkedIn public identifier from a profile URL.
 * e.g. https://www.linkedin.com/in/satyanadella/ → "satyanadella"
 */
function extractIdentifier(profileUrl: string): string | null {
  const match = profileUrl.match(/\/in\/([^/?#]+)/)
  return match ? match[1].replace(/\/$/, '') : null
}

serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const { workspace_id, lead_ids } = body

    if (!workspace_id) {
      return new Response(JSON.stringify({ error: 'workspace_id is required' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    const { userId, error: authError } = await resolveAuth(req, supabase, workspace_id)
    if (authError || !userId) {
      return new Response(JSON.stringify({ error: authError || 'Unauthorized' }), {
        status: 401,
        headers: corsHeaders,
      })
    }

    // Get the active LinkedIn account for this workspace
    const { data: account, error: accountError } = await supabase
      .from('linkedin_accounts')
      .select('id, unipile_account_id')
      .eq('workspace_id', workspace_id)
      .eq('status', 'active')
      .limit(1)
      .single()

    if (accountError || !account?.unipile_account_id) {
      return new Response(JSON.stringify({
        error: 'No active LinkedIn account found for this workspace',
      }), { status: 400, headers: corsHeaders })
    }

    const unipileAccountId = account.unipile_account_id

    // Fetch leads that need enrichment:
    // - linkedin_member_id is null, OR
    // - linkedin_member_id looks like a URL slug (contains letters/hyphens) rather than
    //   a real Unipile provider_id (which is a numeric string like "ACoAA..." or all digits)
    // We detect slugs by checking for hyphens — real provider_ids never contain hyphens.
    let query = supabase
      .from('leads')
      .select('id, profile_url, full_name')
      .eq('workspace_id', workspace_id)
      .not('profile_url', 'is', null)
      .or('linkedin_member_id.is.null,linkedin_member_id.like.%-%')

    // If specific lead IDs were provided, scope to those only
    if (Array.isArray(lead_ids) && lead_ids.length > 0) {
      query = query.in('id', lead_ids)
    }

    const { data: leads, error: leadsError } = await query.limit(500)
    if (leadsError) throw leadsError

    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ success: true, enriched: 0, skipped: 0 }), {
        headers: corsHeaders,
      })
    }

    const unipileDsn = Deno.env.get('UNIPILE_DSN')
    const unipileApiKey = Deno.env.get('UNIPILE_API_KEY')

    if (!unipileDsn || !unipileApiKey) {
      return new Response(JSON.stringify({ error: 'Unipile credentials not configured' }), {
        status: 500,
        headers: corsHeaders,
      })
    }

    const unipileBase = `https://${unipileDsn}/api/v1`
    const unipileHeaders = {
      'X-API-KEY': unipileApiKey,
      'Accept': 'application/json',
    }

    let enriched = 0
    let skipped = 0

    // Process leads in parallel batches of 5 to stay within Supabase's 60s timeout
    // while being faster than sequential processing.
    const BATCH_SIZE = 5
    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const batch = leads.slice(i, i + BATCH_SIZE)
      await Promise.all(batch.map(async (lead) => {
        const identifier = extractIdentifier(lead.profile_url)
        if (!identifier) {
          skipped++
          return
        }

        try {
          const resp = await fetch(
            `${unipileBase}/users/${encodeURIComponent(identifier)}?account_id=${encodeURIComponent(unipileAccountId)}`,
            { headers: unipileHeaders }
          )

          if (!resp.ok) {
            console.warn(`Unipile lookup failed for ${identifier}: HTTP ${resp.status}`)
            skipped++
            return
          }

          const profile = await resp.json()
          const providerId = profile?.provider_id
          if (!providerId) {
            console.warn(`No provider_id in Unipile response for ${identifier}`)
            skipped++
            return
          }

          await supabase
            .from('leads')
            .update({
              linkedin_member_id: providerId,
              ...(profile.name ? { full_name: profile.name } : {}),
              ...(profile.headline ? { headline: profile.headline } : {}),
            })
            .eq('id', lead.id)

          enriched++
        } catch (err) {
          console.error(`Failed to enrich lead ${lead.id}:`, err)
          skipped++
        }
      }))
    }

    return new Response(JSON.stringify({ success: true, enriched, skipped }), {
      headers: corsHeaders,
    })
  } catch (error) {
    console.error('enrich-leads error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    })
  }
})
