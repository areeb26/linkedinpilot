import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * useSuggestReply: Invokes the Edge Function to generate AI replies
 */
export function useSuggestReply() {
  return useMutation({
    mutationFn: async ({ messages, threadId }) => {
      // Expecting messages in a structured format for the AI context
      const { data, error } = await supabase.functions.invoke('suggest-reply', {
        body: { messages, threadId }
      })

      if (error) throw error
      
      // Expected response format: { suggestions: ["Pill 1", "Pill 2", "Pill 3"] }
      return data.suggestions || []
    }
  })
}
