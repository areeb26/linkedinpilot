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

    const { messages, threadId } = await req.json()

    const { userId, error: authError } = await resolveAuth(req, supabase)
    if (authError || !userId) {
      return new Response(JSON.stringify({ error: authError || 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const conversation = Array.isArray(messages)
      ? messages.map((m: { sender?: string; body?: string; content?: string }) =>
          `${m.sender || 'Unknown'}: ${m.body || m.content || ''}`
        ).join('\n')
      : String(messages)

    const prompt = `You are an AI assistant helping with LinkedIn outreach replies.

Conversation so far:
${conversation}

Generate exactly 3 short, natural reply suggestions for the most recent message. Each suggestion should be 1-2 sentences, professional but conversational, and move the conversation forward.

Respond with only a valid JSON array of 3 strings, no markdown. Example: ["Reply 1", "Reply 2", "Reply 3"]`

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

    let suggestions
    try {
      suggestions = JSON.parse(rawText.replace(/```json\n?|\n?```/g, '').trim())
    } catch {
      suggestions = [rawText.trim()]
    }

    return new Response(JSON.stringify({ suggestions }), { headers: corsHeaders })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders })
  }
})
