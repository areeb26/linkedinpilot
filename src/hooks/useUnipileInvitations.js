/**
 * useUnipileInvitations — hooks for Unipile LinkedIn invitations
 *
 * Covers: sent invitations, received invitations, send, cancel, accept/decline.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { unipile } from '@/lib/unipile'
import { supabase } from '@/lib/supabase'
import { normaliseError, getToastMessage } from '@/lib/normaliseError'
import { toast } from 'react-hot-toast'

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * List all pending sent invitations for an account.
 * Query key: ['unipile-invitations-sent', accountId]
 */
export function useSentInvitations(accountId) {
  return useQuery({
    queryKey: ['unipile-invitations-sent', accountId],
    queryFn: async () => {
      const data = await unipile.users.getAllInvitationsSent({ account_id: accountId })
      return data?.items ?? []
    },
    enabled: !!accountId,
    staleTime: 2 * 60 * 1000,
  })
}

/**
 * List all received (pending) invitations for an account.
 * Query key: ['unipile-invitations-received', accountId]
 */
export function useReceivedInvitations(accountId) {
  return useQuery({
    queryKey: ['unipile-invitations-received', accountId],
    queryFn: async () => {
      // Route through backend proxy — keeps API key server-side
      const data = await unipile.users.getAllInvitationsReceived({ account_id: accountId })
      return data?.items ?? []
    },
    enabled: !!accountId,
    staleTime: 2 * 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Send a LinkedIn connection invitation.
 * On success, updates the lead's connection_status to "invited" in Supabase.
 *
 * mutationFn receives: { accountId, providerId, message?, leadId? }
 */
export function useSendInvitation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ accountId, providerId, message, leadId }) => {
      const result = await unipile.users.sendInvitation({
        account_id: accountId,
        provider_id: providerId,
        ...(message ? { message } : {}),
      })

      // Update lead connection_status in Supabase if leadId provided
      if (leadId) {
        await supabase
          .from('leads')
          .update({ connection_status: 'invited' })
          .eq('id', leadId)
      }

      return result
    },
    onSuccess: (_data, { accountId }) => {
      toast.success('Connection request sent')
      queryClient.invalidateQueries({ queryKey: ['unipile-invitations-sent', accountId] })
    },
    onError: (err) => {
      const norm = normaliseError(err)
      toast.error(getToastMessage(norm))
    },
  })
}

/**
 * Cancel a sent invitation.
 * Shows error toast and retains the invitation in the list on failure.
 *
 * mutationFn receives: { accountId, invitationId }
 */
export function useCancelInvitation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ accountId, invitationId }) => {
      return await unipile.users.cancelInvitationSent({
        account_id: accountId,
        invitation_id: invitationId,
      })
    },
    onSuccess: (_data, { accountId }) => {
      toast.success('Invitation cancelled')
      queryClient.invalidateQueries({ queryKey: ['unipile-invitations-sent', accountId] })
    },
    onError: (err) => {
      const norm = normaliseError(err)
      toast.error(getToastMessage(norm))
      // Do NOT invalidate — retain the invitation in the list
    },
  })
}

/**
 * Accept or decline a received invitation.
 * Removes the invitation from the list on success; retains it on failure.
 *
 * mutationFn receives: { accountId, invitationId, action: 'accept' | 'decline', linkedin_token }
 * Note: linkedin_token is required by Unipile — it comes from the invitation object
 * returned by useReceivedInvitations (field: invitation.linkedin_token or invitation.token)
 */
export function useHandleInvitation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ accountId, invitationId, action, linkedin_token }) => {
      // Route through backend proxy — keeps API key server-side
      return await unipile.users.handleInvitation({
        account_id: accountId,
        invitation_id: invitationId,
        action,
        ...(linkedin_token ? { linkedin_token } : {}),
      })
    },
    onSuccess: (_data, { accountId, action }) => {
      toast.success(action === 'accept' ? 'Invitation accepted' : 'Invitation declined')
      queryClient.invalidateQueries({ queryKey: ['unipile-invitations-received', accountId] })
    },
    onError: (err) => {
      const norm = normaliseError(err)
      toast.error(getToastMessage(norm))
    },
  })
}
