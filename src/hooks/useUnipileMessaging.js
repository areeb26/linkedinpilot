/**
 * useUnipileMessaging — hooks for Unipile LinkedIn messaging
 *
 * Covers: list chats, list messages, attendees, send message (with optimistic
 * update + rollback), start DM, send InMail, send file attachment.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { unipile } from '@/lib/unipile'
import { normaliseError, getToastMessage } from '@/lib/normaliseError'
import { toast } from 'react-hot-toast'

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * List all LinkedIn chats for an account, enriched with attendee data.
 * Query key: ['unipile-chats', accountId]
 */
export function useChats(accountId) {
  return useQuery({
    queryKey: ['unipile-chats', accountId],
    queryFn: async () => {
      const data = await unipile.messaging.getAllChats({
        account_id: accountId,
        account_type: 'LINKEDIN',
        limit: 50,
      })
      const chats = data?.items ?? []

      // Enrich each chat with attendee details if not already present.
      // The /chats list endpoint often omits attendee names, so we fetch
      // them in parallel and merge them in.
      const enriched = await Promise.all(
        chats.map(async (chat) => {
          // If the chat already has attendees with names, skip the extra call
          if (chat.attendees?.length && chat.attendees[0]?.name) {
            return chat
          }
          try {
            const attendeeData = await unipile.messaging.getAllAttendeesFromChat(chat.id)
            const attendees = attendeeData?.items ?? []
            return { ...chat, attendees }
          } catch {
            return chat
          }
        })
      )

      return enriched
    },
    enabled: !!accountId,
    staleTime: 30_000,
  })
}

/**
 * List all messages in a chat.
 * Query key: ['unipile-messages', chatId]
 */
export function useMessages(chatId) {
  return useQuery({
    queryKey: ['unipile-messages', chatId],
    queryFn: async () => {
      const data = await unipile.messaging.getAllMessagesFromChat({ chat_id: chatId })
      return data?.items ?? []
    },
    enabled: !!chatId,
    staleTime: 15_000,
  })
}

/**
 * List all attendees in a chat (used to populate the right-panel lead context).
 * Query key: ['unipile-attendees', chatId]
 */
export function useChatAttendees(chatId) {
  return useQuery({
    queryKey: ['unipile-attendees', chatId],
    queryFn: async () => {
      const data = await unipile.messaging.getAllAttendeesFromChat(chatId)
      return data?.items ?? []
    },
    enabled: !!chatId,
    staleTime: 5 * 60_000, // 5 min — LinkedIn avatar URLs expire, keep fresh
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Send a message in an existing chat.
 * Applies an optimistic update immediately and reverts on failure.
 *
 * mutationFn receives: { chatId, text, accountId }
 */
export function useSendMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ chatId, text }) => {
      return await unipile.messaging.sendMessage({ chat_id: chatId, text })
    },

    onMutate: async ({ chatId, text }) => {
      // Cancel any in-flight refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['unipile-messages', chatId] })

      // Snapshot the previous value for rollback
      const previousMessages = queryClient.getQueryData(['unipile-messages', chatId])

      // Optimistically add the new message
      const optimisticMessage = {
        id: `optimistic-${Date.now()}`,
        text,
        body: text,
        is_sender: 1,  // Unipile uses number 1 for sent messages, not boolean true
        timestamp: new Date().toISOString(),
        date: new Date().toISOString(),
        is_optimistic: true,
      }

      queryClient.setQueryData(['unipile-messages', chatId], (old) => [
        ...(old ?? []),
        optimisticMessage,
      ])

      return { previousMessages, chatId }
    },

    onError: (err, _variables, context) => {
      // Revert to the snapshot
      if (context?.previousMessages !== undefined) {
        queryClient.setQueryData(
          ['unipile-messages', context.chatId],
          context.previousMessages
        )
      }
      const norm = normaliseError(err)
      toast.error(getToastMessage(norm))
    },

    onSuccess: (_data, { chatId, accountId }) => {
      queryClient.invalidateQueries({ queryKey: ['unipile-messages', chatId] })
      if (accountId) {
        queryClient.invalidateQueries({ queryKey: ['unipile-chats', accountId] })
      }
    },
  })
}

/**
 * Start a new DM conversation.
 * mutationFn receives: { accountId, attendeeId, text }
 */
export function useStartDM() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ accountId, attendeeId, text }) => {
      return await unipile.messaging.startNewChat({
        account_id: accountId,
        attendees_ids: [attendeeId],
        text,
      })
    },
    onSuccess: (_data, { accountId }) => {
      queryClient.invalidateQueries({ queryKey: ['unipile-chats', accountId] })
    },
    onError: (err) => {
      const norm = normaliseError(err)
      toast.error(getToastMessage(norm))
    },
  })
}

/**
 * Send an InMail to a LinkedIn member outside the user's network.
 * mutationFn receives: { accountId, attendeeId, text, api? }
 */
export function useSendInMail() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ accountId, attendeeId, text, api = 'classic' }) => {
      return await unipile.messaging.startNewChat({
        account_id: accountId,
        attendees_ids: [attendeeId],
        text,
        options: {
          linkedin: { api, inmail: true },
        },
      })
    },
    onSuccess: (_data, { accountId }) => {
      queryClient.invalidateQueries({ queryKey: ['unipile-chats', accountId] })
      toast.success('InMail sent')
    },
    onError: (err) => {
      const norm = normaliseError(err)
      // Detect InMail credit errors
      const isCreditsError =
        norm.code?.toLowerCase().includes('inmail') ||
        norm.code?.toLowerCase().includes('credit') ||
        norm.message?.toLowerCase().includes('inmail') ||
        norm.message?.toLowerCase().includes('credit')

      if (isCreditsError) {
        toast.error('Insufficient InMail credits for this account.')
      } else {
        toast.error(getToastMessage(norm))
      }
    },
  })
}

/**
 * Send a file attachment in a chat.
 * Validates file size ≤ 10 MB before calling the API.
 * mutationFn receives: { chatId, file: File, text? }
 */
export function useSendAttachment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ chatId, file, text = '' }) => {
      const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
      if (file.size > MAX_SIZE) {
        throw new Error('File must be 10 MB or smaller.')
      }

      // Use FormData directly — browser-safe, no Buffer needed
      const form = new FormData()
      if (text) form.append('text', text)
      form.append('attachments', file, file.name)

      const dsn = import.meta.env.VITE_UNIPILE_DSN
      const apiKey = import.meta.env.VITE_UNIPILE_API_KEY

      const res = await fetch(`https://${dsn}/api/v1/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'X-API-KEY': apiKey },
        body: form,
      })

      if (!res.ok) {
        let body = {}
        try { body = await res.json() } catch { /* ignore */ }
        const err = new Error(body?.message ?? `Upload failed (${res.status})`)
        err.response = { status: res.status, data: body }
        throw err
      }

      return res.json()
    },
    onSuccess: (_data, { chatId }) => {
      queryClient.invalidateQueries({ queryKey: ['unipile-messages', chatId] })
    },
    onError: (err) => {
      const norm = normaliseError(err)
      toast.error(err?.message ?? getToastMessage(norm))
    },
  })
}
