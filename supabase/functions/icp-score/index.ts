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

    const { leads, config } = await req.json()

    const { userId, error: authError } = await resolveAuth(req, supabase)
    if (authError || !userId) {
      return new Response(JSON.stringify({ error: authError || 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const prompt = `You are an ICP (Ideal Customer Profile) scoring engine.

ICP Config: ${JSON.stringify(config)}

Score each lead from 0-100 based on how well they match the ICP. Return a JSON array with the same leads, each having an added "icp_score" field (integer 0-100) and "icp_reasons" field (array of short strings explaining the score).

Leads to score:
${JSON.stringify(leads)}

Respond with only valid JSON array, no markdown.`

    const geminiKey = Deno.env.get('GEMINI_API_KEY')!
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    )
    const geminiData = await geminiRes.json()
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '[]'

    let scoredLeads
    try {
      scoredLeads = JSON.parse(rawText.replace(/```json\n?|\n?```/g, '').trim())
    } catch {
      throw new Error('Gemini returned invalid JSON')
    }

    return new Response(JSON.stringify({ scoredLeads }), { headers: corsHeaders })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
