/**
 * Direct cache writes.
 *
 * Realtime events and optimistic mutations both patch the cache in place rather
 * than invalidating and refetching. That is what makes the UI feel instant: a
 * message pushed over the socket appears without a network round trip, and the
 * sidebar reorders in the same frame.
 *
 * Both the message list and the conversation list are infinite queries, so the
 * cache shape is `{ pages: [...], pageParams: [...] }`. Page 0 of the message
 * cache holds the *newest* window (cursor pagination walks backwards in time),
 * which is why new messages append there.
 */

import keys from './queryKeys'
import { parseDate } from './utils'

/** Insert or replace a message, reconciling an optimistic row by `client_id`. */
export const upsertMessage = (queryClient, roomId, message, clientId) => {
  queryClient.setQueryData(keys.messages.room(roomId), (data) => {
    if (!data?.pages?.length) return data

    // Already present in an older page (a refetch raced the socket): leave it be.
    const inOlderPage = data.pages
      .slice(1)
      .some((page) => page.results.some((entry) => entry.id === message.id))
    if (inOlderPage) return data

    const pages = [...data.pages]
    const newest = pages[0]
    let results = newest.results

    const byId = results.findIndex((entry) => entry.id === message.id)
    const byClientId = clientId
      ? results.findIndex((entry) => entry.clientId && entry.clientId === clientId)
      : -1

    if (byId !== -1) {
      results = results.map((entry, index) =>
        index === byId ? { ...entry, ...message, status: 'sent' } : entry,
      )
    } else if (byClientId !== -1) {
      // Swap the optimistic bubble for the stored row, keeping its position so
      // nothing jumps on screen.
      results = results.map((entry, index) =>
        index === byClientId ? { ...message, clientId, status: 'sent' } : entry,
      )
    } else {
      results = [...results, { ...message, status: 'sent' }]
    }

    pages[0] = { ...newest, results }
    return { ...data, pages }
  })
}

/** Add an optimistic message immediately, before the server has confirmed it. */
export const addPendingMessage = (queryClient, roomId, pending) => {
  queryClient.setQueryData(keys.messages.room(roomId), (data) => {
    if (!data?.pages?.length) {
      // Nothing cached yet — seed a single page so the bubble is visible while the
      // first history fetch is still in flight.
      return {
        pages: [{ results: [pending], next: null, previous: null }],
        pageParams: [null],
      }
    }
    const pages = [...data.pages]
    pages[0] = { ...pages[0], results: [...pages[0].results, pending] }
    return { ...data, pages }
  })
}

/** Flag an optimistic message as failed so the UI can offer a retry. */
export const markMessageFailed = (queryClient, roomId, clientId, errorMessage) => {
  queryClient.setQueryData(keys.messages.room(roomId), (data) => {
    if (!data?.pages?.length) return data
    const pages = data.pages.map((page) => ({
      ...page,
      results: page.results.map((entry) =>
        entry.clientId === clientId
          ? { ...entry, status: 'failed', error: errorMessage }
          : entry,
      ),
    }))
    return { ...data, pages }
  })
}

export const removeMessage = (queryClient, roomId, predicate) => {
  queryClient.setQueryData(keys.messages.room(roomId), (data) => {
    if (!data?.pages?.length) return data
    const pages = data.pages.map((page) => ({
      ...page,
      results: page.results.filter((entry) => !predicate(entry)),
    }))
    return { ...data, pages }
  })
}

/**
 * Record who has read which messages, for the delivery ticks.
 *
 * `readers` is tracked as a set of ids rather than a bare counter so a duplicate
 * receipt (a reconnect replays it) cannot inflate the count.
 */
export const applyReadReceipt = (queryClient, roomId, userId, messageIds) => {
  const ids = new Set(messageIds)
  queryClient.setQueryData(keys.messages.room(roomId), (data) => {
    if (!data?.pages?.length) return data
    const pages = data.pages.map((page) => ({
      ...page,
      results: page.results.map((entry) => {
        if (!ids.has(entry.id)) return entry
        const readers = new Set(entry.readers ?? [])
        if (readers.has(userId)) return entry
        readers.add(userId)
        return {
          ...entry,
          readers: [...readers],
          read_by_count: Math.max(entry.read_by_count ?? 0, readers.size + 1),
        }
      }),
    }))
    return { ...data, pages }
  })
}

/**
 * Move a conversation to the top with a fresh preview.
 * Returns false when the room is not cached, so the caller can refetch instead.
 */
export const bumpConversation = (queryClient, { roomId, patch, incrementUnread = 0 }) => {
  let found = false

  queryClient.setQueryData(keys.conversations.list(), (data) => {
    if (!data?.pages?.length) return data

    let existing = null
    const pages = data.pages.map((page) => {
      if (!page.results.some((row) => row.id === roomId)) return page
      const results = page.results.filter((row) => {
        if (row.id !== roomId) return true
        existing = row
        return false
      })
      return { ...page, results }
    })

    if (!existing) return data
    found = true

    const updated = {
      ...existing,
      ...patch,
      unread_count: Math.max(0, (existing.unread_count ?? 0) + incrementUnread),
    }
    pages[0] = { ...pages[0], results: [updated, ...pages[0].results] }
    return { ...data, pages }
  })

  return found
}

/** Patch one conversation row without changing its position. */
export const patchConversation = (queryClient, roomId, patch) => {
  queryClient.setQueryData(keys.conversations.list(), (data) => {
    if (!data?.pages?.length) return data
    const pages = data.pages.map((page) => ({
      ...page,
      results: page.results.map((row) =>
        row.id === roomId ? { ...row, ...(typeof patch === 'function' ? patch(row) : patch) } : row,
      ),
    }))
    return { ...data, pages }
  })
}

export const clearConversationUnread = (queryClient, roomId) =>
  patchConversation(queryClient, roomId, { unread_count: 0 })

/** Reflect a presence change everywhere a person is rendered. */
export const applyPresence = (queryClient, userId, isOnline) => {
  queryClient.setQueryData(keys.conversations.list(), (data) => {
    if (!data?.pages?.length) return data
    const pages = data.pages.map((page) => ({
      ...page,
      results: page.results.map((row) => {
        if (!row.participants?.some((person) => person.user_id === userId)) return row
        const participants = row.participants.map((person) =>
          person.user_id === userId ? { ...person, is_online: isOnline } : person,
        )
        return {
          ...row,
          participants,
          is_online: row.is_group ? row.is_online : isOnline,
        }
      }),
    }))
    return { ...data, pages }
  })

  // Every "list of people" query shares the same row shape, so one pass over the
  // matching keys keeps them all consistent.
  queryClient
    .getQueryCache()
    .findAll({ predicate: (query) => ['people', 'friends'].includes(query.queryKey[0]) })
    .forEach((query) => {
      queryClient.setQueryData(query.queryKey, (data) => {
        if (!data?.pages?.length) return data
        const pages = data.pages.map((page) => ({
          ...page,
          results: page.results.map((row) =>
            row.user_id === userId ? { ...row, is_online: isOnline } : row,
          ),
        }))
        return { ...data, pages }
      })
    })

  queryClient.setQueryData(keys.profiles.byUser(userId), (profile) =>
    profile ? { ...profile, is_online: isOnline } : profile,
  )
}

/** Flatten an infinite message cache into render order (oldest first). */
export const flattenMessages = (data) => {
  if (!data?.pages?.length) return []
  // Pages arrive newest-window-first; reverse so the oldest is at the top.
  const ordered = [...data.pages].reverse().flatMap((page) => page.results ?? [])
  return ordered.sort((a, b) => parseDate(a.timestamp) - parseDate(b.timestamp))
}

/** Flatten any paginated list query. */
export const flattenPages = (data) =>
  data?.pages?.flatMap((page) => page.results ?? []) ?? []
