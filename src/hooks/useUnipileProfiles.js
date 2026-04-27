/**
 * useUnipileProfiles — hooks for Unipile LinkedIn profile retrieval
 *
 * Covers: user profile, own profile, company profile, relations list.
 */
import { useQuery } from '@tanstack/react-query'
import { unipile } from '@/lib/unipile'
import { normaliseError } from '@/lib/normaliseError'

const PROFILE_STALE_TIME = 5 * 60 * 1000 // 5 minutes

// ---------------------------------------------------------------------------
// User profile
// ---------------------------------------------------------------------------

/**
 * Retrieve a LinkedIn user profile by public identifier or provider ID.
 * Returns { error: { code: 'PROFILE_NOT_FOUND', ... } } on 404 instead of throwing.
 *
 * Query key: ['unipile-profile', accountId, identifier]
 */
export function useProfile(accountId, identifier) {
  return useQuery({
    queryKey: ['unipile-profile', accountId, identifier],
    queryFn: async () => {
      try {
        return await unipile.users.getProfile({ account_id: accountId, identifier })
      } catch (err) {
        const norm = normaliseError(err)
        if (norm.httpStatus === 404 || norm.code === 'NOT_FOUND') {
          return {
            error: {
              code: 'PROFILE_NOT_FOUND',
              message: 'Profile not found.',
              retryable: false,
            },
          }
        }
        throw err
      }
    },
    enabled: !!accountId && !!identifier,
    staleTime: PROFILE_STALE_TIME,
  })
}

// ---------------------------------------------------------------------------
// Own profile
// ---------------------------------------------------------------------------

/**
 * Retrieve the authenticated user's own LinkedIn profile.
 * Query key: ['unipile-own-profile', accountId]
 */
export function useOwnProfile(accountId) {
  return useQuery({
    queryKey: ['unipile-own-profile', accountId],
    queryFn: async () => {
      return await unipile.users.getOwnProfile(accountId)
    },
    enabled: !!accountId,
    staleTime: PROFILE_STALE_TIME,
  })
}

// ---------------------------------------------------------------------------
// Company profile
// ---------------------------------------------------------------------------

/**
 * Retrieve a LinkedIn company profile.
 * Query key: ['unipile-company-profile', accountId, identifier]
 */
export function useCompanyProfile(accountId, identifier) {
  return useQuery({
    queryKey: ['unipile-company-profile', accountId, identifier],
    queryFn: async () => {
      return await unipile.users.getCompanyProfile({ account_id: accountId, identifier })
    },
    enabled: !!accountId && !!identifier,
    staleTime: PROFILE_STALE_TIME,
  })
}

// ---------------------------------------------------------------------------
// Relations (connections list)
// ---------------------------------------------------------------------------

/**
 * Fetch all LinkedIn connections for an account, paginating through all pages.
 * Returns { items: [...all connections], total: number }
 *
 * Query key: ['unipile-relations', accountId]
 */
export function useRelations(accountId) {
  return useQuery({
    queryKey: ['unipile-relations', accountId],
    queryFn: async () => {
      const allItems = []
      let cursor = undefined

      // Paginate through all pages
      while (true) {
        const params = { account_id: accountId }
        if (cursor) params.cursor = cursor

        const data = await unipile.users.getAllRelations(params)
        const items = data?.items ?? []
        allItems.push(...items)

        // Check for next page cursor
        const nextCursor = data?.cursor ?? data?.paging?.cursor
        if (!nextCursor || items.length === 0) break
        cursor = nextCursor
      }

      return { items: allItems, total: allItems.length }
    },
    enabled: !!accountId,
    staleTime: 5 * 60 * 1000,
  })
}
