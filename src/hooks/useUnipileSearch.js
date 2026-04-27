/**
 * useUnipileSearch — hooks for Unipile LinkedIn search
 *
 * All calls go through the backend proxy (/api/linkedin/search) so the
 * Unipile API key and DSN are never visible in the browser network tab.
 */
import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { normaliseError, getToastMessage } from '@/lib/normaliseError'
import { toast } from 'react-hot-toast'

const BACKEND_URL = () => import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000'

async function proxyFetch(path, options = {}) {
  const url = `${BACKEND_URL()}${path}`
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json', ...(options.headers ?? {}) }
  const res = await fetch(url, { ...options, headers })
  if (!res.ok) {
    let body = {}
    try { body = await res.json() } catch { /* ignore */ }
    const err = new Error(body?.error ?? body?.message ?? `Proxy error ${res.status}`)
    err.response = { status: res.status, data: body }
    throw err
  }
  return res.json()
}

// ---------------------------------------------------------------------------
// useSearchParameters — fetch filter options for a given parameter type
// ---------------------------------------------------------------------------

/**
 * @param {string} accountId   — Unipile account_id
 * @param {string} paramType   — e.g. 'INDUSTRY', 'LOCATION', 'SKILL'
 * @param {string} [keywords]  — optional keyword filter
 */
export function useSearchParameters(accountId, paramType, keywords = '') {
  return useQuery({
    queryKey: ['unipile-search-params', accountId, paramType, keywords],
    queryFn: async () => {
      const params = new URLSearchParams({ account_id: accountId, type: paramType })
      if (keywords) params.set('keywords', keywords)
      const data = await proxyFetch(`/api/linkedin/search/parameters?${params}`)
      return data?.items ?? []
    },
    enabled: !!accountId && !!paramType,
    staleTime: 10 * 60 * 1000,
  })
}

// ---------------------------------------------------------------------------
// useSearch — stateful search with cursor-based infinite loading
// ---------------------------------------------------------------------------

export function useSearch() {
  const [results, setResults] = useState([])
  const [cursor, setCursor] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastParams, setLastParams] = useState(null)

  const search = useCallback(async (params) => {
    const { accountId, api_type, category, keywords, filters = {}, limit = 25 } = params

    setIsLoading(true)
    setError(null)
    setResults([])
    setCursor(null)
    setLastParams(params)

    try {
      const data = await proxyFetch('/api/linkedin/search', {
        method: 'POST',
        body: JSON.stringify({
          account_id: accountId,
          limit,
          body: { api: api_type, category, ...(keywords ? { keywords } : {}), ...filters },
        }),
      })

      setResults(data?.items ?? [])
      setCursor(data?.cursor ?? null)
    } catch (err) {
      const norm = normaliseError(err)
      const isTierError =
        norm.httpStatus === 403 ||
        norm.message?.toLowerCase().includes('sales navigator') ||
        norm.message?.toLowerCase().includes('recruiter') ||
        norm.message?.toLowerCase().includes('tier') ||
        norm.message?.toLowerCase().includes('subscription')

      if (isTierError) {
        const tierError = {
          code: 'TIER_NOT_AVAILABLE',
          message: 'This LinkedIn tier (Sales Navigator / Recruiter) is not available for this account.',
          retryable: false,
          httpStatus: norm.httpStatus,
        }
        setError(tierError)
        toast.error(tierError.message)
      } else {
        setError(norm)
        toast.error(getToastMessage(norm))
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (!cursor || !lastParams || isLoading) return

    const { accountId, api_type, category, keywords, filters = {}, limit = 25 } = lastParams
    setIsLoading(true)

    try {
      const data = await proxyFetch('/api/linkedin/search', {
        method: 'POST',
        body: JSON.stringify({
          account_id: accountId,
          limit,
          body: { api: api_type, category, ...(keywords ? { keywords } : {}), ...filters, cursor },
        }),
      })

      setResults((prev) => [...prev, ...(data?.items ?? [])])
      setCursor(data?.cursor ?? null)
    } catch (err) {
      const norm = normaliseError(err)
      setError(norm)
      toast.error(getToastMessage(norm))
    } finally {
      setIsLoading(false)
    }
  }, [cursor, lastParams, isLoading])

  return { results, cursor, isLoading, error, search, loadMore }
}
