/**
 * The React Query client and its localStorage persister.
 *
 * Two layers of caching, and they do different jobs:
 *
 *  - In-memory cache: revisiting a conversation renders instantly from cache while
 *    a background refetch confirms it, instead of flashing a spinner every time.
 *  - Persisted cache: the same data survives a reload, so the app paints the real
 *    sidebar and last-read conversation immediately on startup.
 *
 * The realtime socket writes straight into this cache, so pushed messages appear
 * without a refetch and stay consistent with what a later fetch would return.
 */

import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

import { ApiError } from '../api/client'
import config from '../config'

/** Client errors are the server's final answer — retrying them just wastes time. */
const shouldRetry = (failureCount, error) => {
  const status = error instanceof ApiError ? error.status : undefined
  if (status && status >= 400 && status < 500) return false
  if (error?.code === 'cancelled') return false
  return failureCount < 2
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: config.staleTime,
      gcTime: config.gcTime,
      retry: shouldRetry,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      // The socket is the source of truth for freshness, so aggressive refetching
      // on every window focus would be redundant traffic.
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
})

/** Queries safe to restore from disk. Anything volatile is refetched instead. */
const PERSISTED_PREFIXES = ['me', 'conversations', 'messages', 'friends']

export const persister = createSyncStoragePersister({
  storage: typeof window === 'undefined' ? undefined : window.localStorage,
  key: config.cacheKey,
  throttleTime: 1000,
  // Quietly ignore a full or unavailable quota rather than breaking the app.
  retry: ({ error }) => {
    console.warn('Could not persist query cache', error)
    return undefined
  },
})

export const persistOptions = {
  persister,
  maxAge: config.persistMaxAgeMs,
  buster: config.cacheKey,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => {
      if (query.state.status !== 'success') return false
      const [root] = query.queryKey
      return PERSISTED_PREFIXES.includes(root)
    },
  },
}

/** Drop everything on sign-out so the next user never sees cached data. */
export const resetCache = () => {
  queryClient.clear()
  try {
    window.localStorage.removeItem(config.cacheKey)
  } catch {
    /* storage unavailable — nothing to clean up */
  }
}

export default queryClient
