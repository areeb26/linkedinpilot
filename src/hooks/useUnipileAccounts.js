/**
 * useUnipileAccounts.js
 *
 * TanStack Query hooks for Unipile account management.
 * Covers: listing, hosted auth, credentials, cookie, checkpoint, reconnect, and delete.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { unipile } from '@/lib/unipile'
import { supabase } from '@/lib/supabase'
import { useWorkspaceStore } from '@/store/workspaceStore'
import { toast } from 'react-hot-toast'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a Unipile account's `sources` array to a single status string.
 * Unipile accounts have a `sources` array; we derive a simplified status from
 * the first LinkedIn source we find.
 */
function deriveUnipileStatus(unipileAccount) {
  const sources = unipileAccount?.sources ?? []
  if (sources.length === 0) return 'UNKNOWN'

  const source = sources[0]
  switch (source.status) {
    case 'OK':
      return 'CONNECTED'
    case 'CREDENTIALS':
    case 'STOPPED':
      return 'RECONNECT_REQUIRED'
    case 'ERROR':
    case 'PERMISSIONS':
      return 'ERROR'
    case 'CONNECTING':
      return 'CONNECTING'
    default:
      return 'UNKNOWN'
  }
}

/**
 * Merge Supabase linkedin_accounts rows with Unipile account objects.
 * Every Supabase row appears exactly once in the output.
 * Rows whose unipile_account_id matches a Unipile account carry that account's status.
 * Rows with null unipile_account_id get unipile_status: 'UNKNOWN'.
 */
export function mergeAccounts(supabaseRows, unipileAccounts) {
  const unipileMap = new Map(
    (unipileAccounts ?? []).map((a) => [a.id, a])
  )

  return (supabaseRows ?? []).map((row) => {
    const unipileAccount = row.unipile_account_id
      ? unipileMap.get(row.unipile_account_id)
      : undefined

    const im = unipileAccount?.connection_params?.im ?? {}
    const premiumFeatures = im.premiumFeatures ?? []

    return {
      ...row,
      unipile_status: unipileAccount
        ? deriveUnipileStatus(unipileAccount)
        : 'UNKNOWN',
      // Prefer Supabase-stored handle; fall back to Unipile publicIdentifier
      linkedin_handle: row.linkedin_handle || im.publicIdentifier || null,
      premium_features: premiumFeatures,
    }
  })
}

/**
 * Write unipile_account_id to the most recently created Supabase row in the
 * workspace that doesn't yet have one.
 */
async function writeUnipileAccountId(workspaceId, unipileAccountId) {
  const { data: rows, error: fetchError } = await supabase
    .from('linkedin_accounts')
    .select('id')
    .eq('workspace_id', workspaceId)
    .is('unipile_account_id', null)
    .order('created_at', { ascending: false })
    .limit(1)

  if (fetchError) throw fetchError

  if (rows?.[0]) {
    const { error: updateError } = await supabase
      .from('linkedin_accounts')
      .update({ unipile_account_id: unipileAccountId })
      .eq('id', rows[0].id)

    if (updateError) throw updateError
  }
}

// ---------------------------------------------------------------------------
// 0. useRawUnipileAccounts — query (raw Unipile account list, no Supabase merge)
// ---------------------------------------------------------------------------

/**
 * Fetches the raw list of accounts from Unipile.
 * Used as a fallback when the Supabase linkedin_accounts row doesn't yet have
 * unipile_account_id populated (e.g. webhook hasn't fired).
 */
export function useRawUnipileAccounts() {
  return useQuery({
    queryKey: ['raw-unipile-accounts'],
    queryFn: async () => {
      const response = await unipile.account.getAll()
      return response?.items ?? []
    },
    staleTime: 30_000,
  })
}

// ---------------------------------------------------------------------------
// 1. useUnipileAccounts — query
// ---------------------------------------------------------------------------

/**
 * Fetches all Unipile accounts and merges them with the workspace's
 * Supabase linkedin_accounts rows on unipile_account_id.
 *
 * @param {string} workspaceId
 */
export function useUnipileAccounts(workspaceId) {
  return useQuery({
    queryKey: ['unipile-accounts', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return []

      // Fetch Unipile accounts and Supabase rows in parallel
      const [unipileResponse, supabaseResult] = await Promise.all([
        unipile.account.getAll(),
        supabase
          .from('linkedin_accounts')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false }),
      ])

      if (supabaseResult.error) throw supabaseResult.error

      const unipileAccounts = unipileResponse?.items ?? []
      const supabaseRows = supabaseResult.data ?? []

      return mergeAccounts(supabaseRows, unipileAccounts)
    },
    enabled: !!workspaceId,
  })
}

// ---------------------------------------------------------------------------
// 2. useConnectHostedAuth — mutation
// ---------------------------------------------------------------------------

/**
 * Creates a Unipile hosted auth link, opens it in a new tab, then polls
 * Supabase for a new linkedin_accounts row with unipile_account_id set.
 * Invalidates the unipile-accounts cache on success.
 */
export function useConnectHostedAuth() {
  const queryClient = useQueryClient()
  const { workspaceId } = useWorkspaceStore()

  return useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error('No workspace selected')

      // Get current user session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      // Call the Supabase edge function to generate the hosted auth link server-side.
      // Per Unipile docs: the API key must NOT be exposed in the frontend.
      // The edge function calls Unipile with the server-side API key and returns the URL.
      const { data: fnData, error } = await supabase.functions.invoke('unipile-hosted-auth', {
        body: {
          workspace_id: workspaceId,
          user_id: session.user.id,
        },
      })

      if (error) {
        console.error('[Unipile] Edge function error:', error)
        throw new Error(error.message ?? 'Failed to generate hosted auth link')
      }

      // supabase.functions.invoke may return data as string or object depending on version
      const responseData = typeof fnData === 'string' ? JSON.parse(fnData) : fnData

      console.log('[Unipile] Edge function response:', responseData)

      if (responseData?.error) {
        console.error('[Unipile] Unipile API error from edge function:', responseData.error)
        throw new Error(responseData.error)
      }

      const hostedUrl = responseData?.url
      if (!hostedUrl) {
        console.error('[Unipile] No URL in response:', responseData)
        throw new Error('No hosted auth URL returned. Check Supabase function logs.')
      }

      // Unipile returns https://account.unipile.com/TOKEN
      // Ensure it has a protocol just in case
      const fullUrl = hostedUrl.startsWith('http') ? hostedUrl : `https://account.unipile.com/${hostedUrl}`

      console.log('[Unipile] Opening hosted auth URL:', fullUrl)

      // Open Unipile's hosted auth page in a new tab
      // User logs in on account.unipile.com, then Unipile calls our notify_url webhook
      window.open(fullUrl, '_blank', 'noopener,noreferrer')

      // Poll Supabase every 3s for up to 120s
      // The webhook (unipile-webhook edge function) writes unipile_account_id
      // to linkedin_accounts when Unipile calls notify_url after successful auth
      const POLL_INTERVAL_MS = 3000
      const TIMEOUT_MS = 120000
      const startTime = Date.now()

      // Snapshot existing unipile_account_ids to detect new ones
      const { data: existingRows } = await supabase
        .from('linkedin_accounts')
        .select('unipile_account_id')
        .eq('workspace_id', workspaceId)
        .not('unipile_account_id', 'is', null)

      const existingIds = new Set(
        (existingRows ?? []).map((r) => r.unipile_account_id)
      )

      return new Promise((resolve, reject) => {
        const interval = setInterval(async () => {
          if (Date.now() - startTime > TIMEOUT_MS) {
            clearInterval(interval)
            reject(new Error('Hosted auth timed out. Please try again.'))
            return
          }

          const { data: newRows } = await supabase
            .from('linkedin_accounts')
            .select('unipile_account_id')
            .eq('workspace_id', workspaceId)
            .not('unipile_account_id', 'is', null)

          const newId = (newRows ?? []).find(
            (r) => !existingIds.has(r.unipile_account_id)
          )

          if (newId) {
            clearInterval(interval)
            resolve({ unipile_account_id: newId.unipile_account_id })
          }
        }, POLL_INTERVAL_MS)
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unipile-accounts', workspaceId] })
      toast.success('LinkedIn account connected!')
    },
    onError: (error) => {
      toast.error(error?.message ?? 'Hosted auth failed. Please try again.')
    },
  })
}

// ---------------------------------------------------------------------------
// 3. useConnectCredentials — mutation
// ---------------------------------------------------------------------------

/**
 * Connects a LinkedIn account using username + password.
 * Returns { checkpoint: true, account_id, checkpoint_type } when 2FA is required.
 * On success, writes unipile_account_id to Supabase and invalidates cache.
 */
export function useConnectCredentials() {
  const queryClient = useQueryClient()
  const { workspaceId } = useWorkspaceStore()

  return useMutation({
    mutationFn: async ({ username, password }) => {
      if (!workspaceId) throw new Error('No workspace selected')

      const response = await unipile.account.connectLinkedin({ username, password })

      if (response?.object === 'Checkpoint') {
        return {
          checkpoint: true,
          account_id: response.account_id,
          checkpoint_type: response.checkpoint?.type,
        }
      }

      // Success — write unipile_account_id to Supabase
      const unipileAccountId = response?.account_id
      if (unipileAccountId) {
        await writeUnipileAccountId(workspaceId, unipileAccountId)
      }

      return { checkpoint: false, account_id: unipileAccountId }
    },
    onSuccess: (data) => {
      if (!data?.checkpoint) {
        queryClient.invalidateQueries({ queryKey: ['unipile-accounts', workspaceId] })
      }
    },
    onError: (error) => {
      toast.error(error?.message ?? 'Failed to connect account. Please check your credentials.')
    },
  })
}

// ---------------------------------------------------------------------------
// 4. useConnectCookie — mutation
// ---------------------------------------------------------------------------

/**
 * Connects a LinkedIn account using a li_at cookie value.
 * Same checkpoint/success handling as useConnectCredentials.
 */
export function useConnectCookie() {
  const queryClient = useQueryClient()
  const { workspaceId } = useWorkspaceStore()

  return useMutation({
    mutationFn: async ({ access_token, user_agent }) => {
      if (!workspaceId) throw new Error('No workspace selected')

      const input = { access_token }
      if (user_agent) input.user_agent = user_agent

      const response = await unipile.account.connectLinkedinWithCookie(input)

      if (response?.object === 'Checkpoint') {
        return {
          checkpoint: true,
          account_id: response.account_id,
          checkpoint_type: response.checkpoint?.type,
        }
      }

      // Success — write unipile_account_id to Supabase
      const unipileAccountId = response?.account_id
      if (unipileAccountId) {
        await writeUnipileAccountId(workspaceId, unipileAccountId)
      }

      return { checkpoint: false, account_id: unipileAccountId }
    },
    onSuccess: (data) => {
      if (!data?.checkpoint) {
        queryClient.invalidateQueries({ queryKey: ['unipile-accounts', workspaceId] })
      }
    },
    onError: (error) => {
      toast.error(error?.message ?? 'Failed to connect account. Please check your cookie value.')
    },
  })
}

// ---------------------------------------------------------------------------
// 5. useSolveCheckpoint — mutation
// ---------------------------------------------------------------------------

/**
 * Submits a 2FA/OTP code to resolve a checkpoint.
 * On success, writes unipile_account_id to Supabase and invalidates cache.
 */
export function useSolveCheckpoint() {
  const queryClient = useQueryClient()
  const { workspaceId } = useWorkspaceStore()

  return useMutation({
    mutationFn: async ({ account_id, code }) => {
      if (!workspaceId) throw new Error('No workspace selected')

      const response = await unipile.account.solveCodeCheckpoint({
        account_id,
        provider: 'LINKEDIN',
        code,
      })

      // If still in checkpoint state, return it for the UI to handle
      if (response?.object === 'Checkpoint') {
        return {
          checkpoint: true,
          account_id: response.account_id,
          checkpoint_type: response.checkpoint?.type,
        }
      }

      // AccountCreated or AccountReconnected — write to Supabase
      const unipileAccountId = response?.account_id
      if (unipileAccountId) {
        await writeUnipileAccountId(workspaceId, unipileAccountId)
      }

      return { checkpoint: false, account_id: unipileAccountId }
    },
    onSuccess: (data) => {
      if (!data?.checkpoint) {
        queryClient.invalidateQueries({ queryKey: ['unipile-accounts', workspaceId] })
      }
    },
    onError: (error) => {
      toast.error(error?.message ?? 'Failed to verify code. Please try again.')
    },
  })
}

// ---------------------------------------------------------------------------
// 6. useResendCheckpoint — mutation
// ---------------------------------------------------------------------------

/**
 * Requests a new OTP/2FA code to be sent for an in-progress checkpoint.
 * Uses a direct fetch since the SDK does not expose a resend method.
 */
export function useResendCheckpoint() {
  return useMutation({
    mutationFn: async ({ account_id }) => {
      const dsn = import.meta.env.VITE_UNIPILE_DSN
      const apiKey = import.meta.env.VITE_UNIPILE_API_KEY

      const response = await fetch(
        `https://${dsn}/api/v1/accounts/checkpoint/resend`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': apiKey,
          },
          body: JSON.stringify({ account_id, provider: 'LINKEDIN' }),
        }
      )

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body?.message ?? `Resend failed (${response.status})`)
      }

      return response.json()
    },
    onError: (error) => {
      toast.error(error?.message ?? 'Failed to resend code. Please try again.')
    },
  })
}

// ---------------------------------------------------------------------------
// 7. useReconnectAccount — mutation
// ---------------------------------------------------------------------------

/**
 * Triggers a resync of an existing Unipile account.
 * Shows a success or error toast and invalidates the cache on success.
 */
export function useReconnectAccount() {
  const queryClient = useQueryClient()
  const { workspaceId } = useWorkspaceStore()

  return useMutation({
    mutationFn: async ({ unipile_account_id }) => {
      if (!unipile_account_id) throw new Error('No Unipile account ID provided')

      return await unipile.account.reconnect({
        account_id: unipile_account_id,
      })
    },
    onSuccess: () => {
      toast.success('Account reconnected')
      queryClient.invalidateQueries({ queryKey: ['unipile-accounts', workspaceId] })
    },
    onError: (error) => {
      toast.error(error?.message ?? 'Failed to reconnect account. Please try again.')
    },
  })
}

/**
 * Sync profile data from Unipile (name, avatar, headline) into the Supabase row.
 * Calls GET /api/v1/users/me and updates linkedin_accounts.
 */
export function useSyncProfile() {
  const queryClient = useQueryClient()
  const { workspaceId } = useWorkspaceStore()

  return useMutation({
    mutationFn: async ({ unipile_account_id, supabase_row_id }) => {
      if (!unipile_account_id) throw new Error('No Unipile account ID')

      // Fetch latest profile from Unipile
      const profile = await unipile.users.getOwnProfile(unipile_account_id)

      if (!profile) throw new Error('No profile returned from Unipile')

      // Build update payload — only use columns that exist in linkedin_accounts schema
      const updates = {}
      const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
      if (fullName) updates.full_name = fullName
      if (profile.profile_picture_url) updates.avatar_url = profile.profile_picture_url
      if (profile.headline) updates.headline = profile.headline
      if (profile.member_urn) updates.linkedin_member_id = profile.member_urn
      if (profile.public_profile_url) updates.profile_url = profile.public_profile_url
      if (profile.public_identifier) updates.linkedin_handle = profile.public_identifier
      updates.last_synced_at = new Date().toISOString()
      updates.last_activity_at = new Date().toISOString()

      // Update Supabase row
      const { error } = await supabase
        .from('linkedin_accounts')
        .update(updates)
        .eq('id', supabase_row_id)

      if (error) throw error

      return { profile, updates }
    },
    onSuccess: (data) => {
      const name = data.profile?.first_name ?? 'Profile'
      toast.success(`${name}'s profile synced`)
      queryClient.invalidateQueries({ queryKey: ['unipile-accounts', workspaceId] })
      queryClient.invalidateQueries({ queryKey: ['linkedin-accounts', workspaceId] })
    },
    onError: (error) => {
      toast.error(error?.message ?? 'Failed to sync profile. Please try again.')
    },
  })
}

/**
 * Deletes a Unipile account and then removes the corresponding Supabase row.
 * If the Unipile call fails, shows an error toast and does NOT delete the Supabase row.
 * Invalidates the cache only on full success.
 */
export function useDeleteUnipileAccount() {
  const queryClient = useQueryClient()
  const { workspaceId } = useWorkspaceStore()

  return useMutation({
    mutationFn: async ({ unipile_account_id, supabase_row_id }) => {
      if (!unipile_account_id) throw new Error('No Unipile account ID provided')

      // Step 1: Delete from Unipile — if this throws, we stop here
      await unipile.account.delete(unipile_account_id)

      // Step 2: Only on Unipile success, delete the Supabase row
      if (supabase_row_id) {
        const { error } = await supabase
          .from('linkedin_accounts')
          .delete()
          .eq('id', supabase_row_id)
          .eq('workspace_id', workspaceId)

        if (error) throw error
      }

      return { deleted: true }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unipile-accounts', workspaceId] })
    },
    onError: (error) => {
      toast.error(error?.message ?? 'Failed to delete account. Please try again.')
    },
  })
}
