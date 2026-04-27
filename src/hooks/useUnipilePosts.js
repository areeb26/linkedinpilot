/**
 * useUnipilePosts — hooks for Unipile LinkedIn posts and engagement
 *
 * Covers: list posts (own + company), get post comments,
 * create post, comment on post, react to post.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { unipile } from '@/lib/unipile'
import { normaliseError, getToastMessage } from '@/lib/normaliseError'
import { toast } from 'react-hot-toast'

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * List the authenticated user's own LinkedIn posts.
 * First fetches own profile to get the public_identifier, then lists posts.
 * Query key: ['unipile-my-posts', accountId]
 */
export function useMyPosts(accountId) {
  return useQuery({
    queryKey: ['unipile-my-posts', accountId],
    queryFn: async () => {
      // Step 1: get own profile to resolve public_identifier
      const profile = await unipile.users.getOwnProfile(accountId)
      const identifier = profile?.public_identifier
      if (!identifier) return []

      // Step 2: list posts using the public identifier
      const data = await unipile.users.getAllPosts({ account_id: accountId, identifier })
      return data?.items ?? []
    },
    enabled: !!accountId,
    staleTime: 2 * 60 * 1000,
  })
}

/**
 * List posts for a company.
 * Query key: ['unipile-company-posts', accountId, identifier]
 */
export function useCompanyPosts(accountId, identifier) {
  return useQuery({
    queryKey: ['unipile-company-posts', accountId, identifier],
    queryFn: async () => {
      const data = await unipile.users.getAllPosts({ account_id: accountId, identifier })
      return data?.items ?? []
    },
    enabled: !!accountId && !!identifier,
    staleTime: 2 * 60 * 1000,
  })
}

/**
 * List comments on a specific post.
 * Uses social_id when available (required by Unipile for comment operations).
 * Query key: ['unipile-post-comments', accountId, postId]
 */
export function usePostComments(accountId, postId) {
  return useQuery({
    queryKey: ['unipile-post-comments', accountId, postId],
    queryFn: async () => {
      const data = await unipile.users.getAllPostComments({
        account_id: accountId,
        post_id: postId,
      })
      return data?.items ?? []
    },
    enabled: !!accountId && !!postId,
    staleTime: 60_000,
  })
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Create a new LinkedIn post.
 * Invalidates the posts cache on success and prepends the new post.
 *
 * mutationFn receives: { accountId, text }
 */
export function useCreatePost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ accountId, text }) => {
      return await unipile.users.createPost({ account_id: accountId, text })
    },
    onSuccess: (_data, { accountId }) => {
      toast.success('Post published')
      queryClient.invalidateQueries({ queryKey: ['unipile-my-posts', accountId] })
    },
    onError: (err) => {
      const norm = normaliseError(err)
      toast.error(getToastMessage(norm))
    },
  })
}

/**
 * Comment on a LinkedIn post.
 * mutationFn receives: { accountId, postId, text }
 */
export function useCommentOnPost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ accountId, postId, text }) => {
      return await unipile.users.sendPostComment({
        account_id: accountId,
        post_id: postId,
        text,
      })
    },
    onSuccess: (_data, { accountId, postId }) => {
      toast.success('Comment posted')
      queryClient.invalidateQueries({ queryKey: ['unipile-post-comments', accountId, postId] })
    },
    onError: (err) => {
      const norm = normaliseError(err)
      toast.error(getToastMessage(norm))
    },
  })
}

/**
 * React to a LinkedIn post.
 * mutationFn receives: { accountId, postId, reactionType? }
 * reactionType defaults to 'LIKE'. Other values: 'PRAISE', 'APPRECIATION', 'EMPATHY', 'INTEREST', 'ENTERTAINMENT'
 */
export function useReactToPost() {
  return useMutation({
    mutationFn: async ({ accountId, postId, reactionType = 'LIKE' }) => {
      return await unipile.users.sendPostReaction({
        account_id: accountId,
        post_id: postId,
        reaction_type: reactionType,
      })
    },
    onSuccess: () => {
      toast.success('Reaction added')
    },
    onError: (err) => {
      const norm = normaliseError(err)
      toast.error(getToastMessage(norm))
    },
  })
}
