import { supabase } from './supabase'

/**
 * All Gemini calls go through Supabase Edge Functions.
 * Never call Gemini API directly from the frontend.
 */
export async function invokeAI(functionName, payload) {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body: payload,
  })

  if (error) throw error
  return data
}
