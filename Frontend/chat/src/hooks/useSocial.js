/** Friends, requests, people discovery, profiles and blocking. */

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { authApi, blockingApi, paramFromUrl, peopleApi, profileApi } from '../api'
import { useAuth } from '../auth/AuthProvider'
import config from '../config'
import { flattenPages } from '../lib/cacheUpdates'
import keys from '../lib/queryKeys'

/** Shared page-number pagination for every list-of-people query. */
const pagedQuery = ({ queryKey, fetcher, enabled = true, staleTime = config.staleTime }) => ({
  queryKey,
  queryFn: ({ pageParam, signal }) => fetcher({ page: pageParam ?? 1, signal }),
  initialPageParam: 1,
  getNextPageParam: (lastPage) => {
    const next = paramFromUrl(lastPage?.next, 'page')
    return next ? Number(next) : undefined
  },
  enabled,
  staleTime,
})

const withList = (query, field = 'people') => ({
  ...query,
  [field]: flattenPages(query.data),
  total: query.data?.pages?.[0]?.count ?? 0,
})

// ------------------------------------------------------------------ friends

export function useFriends(search = '') {
  const query = useInfiniteQuery(
    pagedQuery({
      queryKey: keys.friends.list(search),
      fetcher: ({ page }) => peopleApi.friends({ page, q: search }),
    }),
  )
  return withList(query, 'friends')
}

export function useRemoveFriend() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId) => peopleApi.removeFriend(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.friends.all })
      queryClient.invalidateQueries({ queryKey: keys.people.all })
      queryClient.invalidateQueries({ queryKey: keys.profiles.all })
    },
  })
}

// ----------------------------------------------------------- friend requests

export function useFriendRequests(direction = 'incoming', status = 'pending') {
  const query = useInfiniteQuery(
    pagedQuery({
      queryKey: keys.friendRequests.list(direction, status),
      fetcher: ({ page }) => peopleApi.friendRequests({ direction, status, page }),
      staleTime: 15_000,
    }),
  )
  return withList(query, 'requests')
}

export function useSendFriendRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId) => peopleApi.sendFriendRequest(userId),
    onSuccess: () => {
      // The recipient disappears from "discover" and appears under outgoing.
      queryClient.invalidateQueries({ queryKey: keys.people.all })
      queryClient.invalidateQueries({ queryKey: keys.friendRequests.all })
      queryClient.invalidateQueries({ queryKey: keys.profiles.all })
    },
  })
}

export function useRespondToFriendRequest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ requestId, action }) => peopleApi.respondToFriendRequest({ requestId, action }),
    onSuccess: (_data, { action }) => {
      queryClient.invalidateQueries({ queryKey: keys.friendRequests.all })
      queryClient.invalidateQueries({ queryKey: keys.people.all })
      if (action === 'accept') {
        // Accepting creates the conversation server-side.
        queryClient.invalidateQueries({ queryKey: keys.friends.all })
        queryClient.invalidateQueries({ queryKey: keys.conversations.all })
      }
    },
  })
}

// ------------------------------------------------------------------- people

/** Suggested people: not friends, no pending request, not blocked. */
export function useDiscoverPeople({ search = '', onlineOnly = false } = {}) {
  const query = useInfiniteQuery(
    pagedQuery({
      queryKey: keys.people.discover(search, onlineOnly),
      fetcher: ({ page }) => peopleApi.discover({ page, q: search, onlineOnly }),
    }),
  )
  return withList(query)
}

/** Every account, with presence. */
export function useDirectory(search = '') {
  const query = useInfiniteQuery(
    pagedQuery({
      queryKey: keys.people.directory(search),
      fetcher: ({ page }) => peopleApi.directory({ page, q: search }),
    }),
  )
  return withList(query)
}

/** Name/email search. Disabled until the term is meaningful. */
export function useUserSearch(search = '') {
  const term = search.trim()
  const query = useInfiniteQuery(
    pagedQuery({
      queryKey: keys.people.search(term),
      fetcher: ({ page, signal }) => peopleApi.search({ q: term, page, signal }),
      enabled: term.length > 0,
      // Search results are cheap to refetch and go stale quickly.
      staleTime: 10_000,
    }),
  )
  return { ...withList(query, 'results'), term }
}

// ------------------------------------------------------------------ profile

export function useMe() {
  const { isAuthenticated } = useAuth()
  return useQuery({
    queryKey: keys.me,
    queryFn: profileApi.me,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  })
}

export function useProfile(userId) {
  return useQuery({
    queryKey: keys.profiles.byUser(userId ?? 0),
    queryFn: () => profileApi.byUser(userId),
    enabled: Boolean(userId),
    staleTime: 60_000,
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  const { patchUser } = useAuth()

  return useMutation({
    mutationFn: (payload) => profileApi.update(payload),
    onSuccess: (data) => {
      // The endpoint returns the full profile, so the cache can be set rather than
      // invalidated — the header updates without a second request.
      queryClient.setQueryData(keys.me, data)
      patchUser({ name: data.name, photo: data.photo })
      queryClient.invalidateQueries({ queryKey: keys.profiles.all })
      // Avatars are embedded in conversation rows and message senders.
      queryClient.invalidateQueries({ queryKey: keys.conversations.all })
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ oldPassword, newPassword }) =>
      authApi.changePassword({ oldPassword, newPassword }),
  })
}

// ----------------------------------------------------------------- blocking

export function useBlockedUsers() {
  const query = useInfiniteQuery(
    pagedQuery({
      queryKey: keys.blocked.list(),
      fetcher: ({ page }) => blockingApi.list({ page }),
    }),
  )
  return { ...query, blocked: flattenPages(query.data) }
}

export function useBlockUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId) => blockingApi.block(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.blocked.all })
      queryClient.invalidateQueries({ queryKey: keys.people.all })
      queryClient.invalidateQueries({ queryKey: keys.profiles.all })
      queryClient.invalidateQueries({ queryKey: keys.conversations.all })
    },
  })
}

export function useUnblockUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId) => blockingApi.unblock(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.blocked.all })
      queryClient.invalidateQueries({ queryKey: keys.people.all })
      queryClient.invalidateQueries({ queryKey: keys.profiles.all })
    },
  })
}
