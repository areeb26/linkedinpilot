import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 30s stale time — data is served from cache instantly on navigation,
      // then refetched in the background if older than 30s
      staleTime: 30_000,
      // Keep unused data in cache for 5 minutes
      gcTime: 5 * 60_000,
      // Retry once on failure, with a short delay
      retry: 1,
      retryDelay: 1000,
      // Refetch when window regains focus so data is always fresh
      refetchOnWindowFocus: true,
    },
  },
})
