/** Conversation and message data hooks. */

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'

import { chatApi, paramFromUrl } from '../api'
import { useAuth } from '../auth/AuthProvider'
import config from '../config'
import {
  addPendingMessage,
  bumpConversation,
  clearConversationUnread,
  flattenMessages,
  flattenPages,
  markMessageFailed,
  removeMessage,
} from '../lib/cacheUpdates'
import keys from '../lib/queryKeys'
import { makeClientId } from '../lib/utils'
import { useRealtime } from '../realtime/RealtimeProvider'

/** How long an unconfirmed message waits before it is shown as failed. */
const SEND_TIMEOUT_MS = 15_000

export function useConversations() {
  const query = useInfiniteQuery({
    queryKey: keys.conversations.list(),
    queryFn: ({ pageParam }) => chatApi.conversations({ page: pageParam ?? 1 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const next = paramFromUrl(lastPage?.next, 'page')
      return next ? Number(next) : undefined
    },
    // The sidebar is the first thing the user sees on every visit; serving it from
    // cache and revalidating behind the scenes is what removes the startup spinner.
    staleTime: config.staleTime,
  })

  return {
    ...query,
    conversations: flattenPages(query.data),
    totalUnread: query.data?.pages?.[0]?.total_unread ?? 0,
  }
}

export function useUnreadCount() {
  return useQuery({
    queryKey: keys.conversations.unread(),
    queryFn: chatApi.unreadCount,
    select: (data) => data?.total_unread ?? 0,
    staleTime: 15_000,
  })
}

export function useConversation(roomId) {
  const { conversations } = useConversations()
  return conversations.find((room) => room.id === Number(roomId)) ?? null
}

export function useMessages(roomId) {
  const enabled = Boolean(roomId)

  const query = useInfiniteQuery({
    queryKey: keys.messages.room(roomId ?? 0),
    queryFn: ({ pageParam, signal }) =>
      chatApi.messages({ roomId, cursor: pageParam, signal }),
    initialPageParam: null,
    // `next` walks backwards in time, so each additional page is older history.
    getNextPageParam: (lastPage) => paramFromUrl(lastPage?.next, 'cursor') ?? undefined,
    enabled,
    // History is immutable apart from new arrivals, which come over the socket, so
    // there is no reason to refetch a page the client already has.
    staleTime: Infinity,
  })

  return {
    ...query,
    messages: flattenMessages(query.data),
    hasOlder: Boolean(query.hasNextPage),
    loadOlder: query.fetchNextPage,
    isLoadingOlder: query.isFetchingNextPage,
  }
}

/**
 * Sending a text message.
 *
 * The bubble appears immediately with `status: 'sending'`; the server's echo
 * (matched on `client_id`) replaces it with the stored row. If no echo arrives the
 * bubble is marked failed and can be retried, rather than vanishing.
 */
export function useSendMessage(roomId) {
  const queryClient = useQueryClient()
  const { sendMessage } = useRealtime()
  const { user } = useAuth()
  const timers = useRef(new Map())

  useEffect(
    () => () => {
      timers.current.forEach((timer) => clearTimeout(timer))
      timers.current.clear()
    },
    [],
  )

  const send = useCallback(
    (content) => {
      const text = content?.trim()
      if (!text || !roomId) return null

      const clientId = makeClientId()
      const now = new Date().toISOString()

      addPendingMessage(queryClient, roomId, {
        id: clientId,
        clientId,
        chat_room: Number(roomId),
        content: text,
        attachment: null,
        images: null,
        timestamp: now,
        sender_id: user?.user_id ?? user?.id ?? null,
        sender: {
          user_id: user?.user_id ?? user?.id ?? null,
          name: user?.name,
          photo: user?.photo ?? null,
        },
        status: 'sending',
        read_by_count: 1,
      })

      bumpConversation(queryClient, {
        roomId: Number(roomId),
        patch: {
          last_message: {
            id: clientId,
            preview: text,
            timestamp: now,
            sender_id: user?.user_id ?? user?.id ?? null,
            is_mine: true,
          },
          last_activity: now,
        },
      })

      sendMessage({ roomId: Number(roomId), content: text, clientId })

      timers.current.set(
        clientId,
        setTimeout(() => {
          timers.current.delete(clientId)
          const pending = flattenMessages(
            queryClient.getQueryData(keys.messages.room(roomId)),
          ).find((entry) => entry.clientId === clientId && entry.status === 'sending')
          if (pending) {
            markMessageFailed(queryClient, roomId, clientId, 'Not delivered. Tap to retry.')
          }
        }, SEND_TIMEOUT_MS),
      )

      return clientId
    },
    [queryClient, roomId, sendMessage, user],
  )

  const retry = useCallback(
    (message) => {
      removeMessage(queryClient, roomId, (entry) => entry.clientId === message.clientId)
      return send(message.content)
    },
    [queryClient, roomId, send],
  )

  const discard = useCallback(
    (message) => removeMessage(queryClient, roomId, (entry) => entry.clientId === message.clientId),
    [queryClient, roomId],
  )

  return { send, retry, discard }
}

/** Uploading an image or file. Goes over HTTP so upload progress is available. */
export function useUploadMessage(roomId) {
  const queryClient = useQueryClient()

  return useMutation({
    // `signal` comes from the composer's AbortController so the remove button can
    // cancel an upload that is already in flight.
    mutationFn: ({ content, image, file, onProgress, signal }) =>
      chatApi.uploadMessage({ roomId, content, image, file, onProgress, signal }),
    onSuccess: () => {
      // The server broadcasts the stored message, and the socket handler writes it
      // into the cache — so there is nothing to do here but keep the sidebar's
      // ordering honest if this client is not subscribed for some reason.
      queryClient.invalidateQueries({ queryKey: keys.conversations.all, refetchType: 'none' })
    },
  })
}

/** Marks a room read and keeps the sidebar badge in step. */
export function useMarkRead(roomId) {
  const queryClient = useQueryClient()
  const { markRead } = useRealtime()
  const lastMarked = useRef(null)

  return useCallback(
    (messageIds) => {
      if (!roomId) return
      const signature = messageIds?.length ? messageIds.join(',') : 'all'
      // The message list calls this on every scroll and focus event; skipping an
      // identical repeat keeps it from chattering at the server.
      if (lastMarked.current === `${roomId}:${signature}`) return
      lastMarked.current = `${roomId}:${signature}`

      markRead({ roomId: Number(roomId), messageIds })
      clearConversationUnread(queryClient, Number(roomId))
      queryClient.invalidateQueries({ queryKey: keys.conversations.unread() })
    },
    [markRead, queryClient, roomId],
  )
}

/** Opens (or creates) a direct conversation and returns its room id. */
export function useOpenDirectChat() {
  const queryClient = useQueryClient()
  const { subscribeToRoom } = useRealtime()

  return useMutation({
    mutationFn: (userId) => chatApi.openDirect(userId),
    onSuccess: (data) => {
      // Join the room group straight away so messages arrive without a reconnect.
      subscribeToRoom(data.room_id)
      queryClient.invalidateQueries({ queryKey: keys.conversations.all })
    },
  })
}

export function useCreateGroup() {
  const queryClient = useQueryClient()
  const { subscribeToRoom } = useRealtime()

  return useMutation({
    mutationFn: ({ name, participantIds }) => chatApi.createGroup({ name, participantIds }),
    onSuccess: (data) => {
      subscribeToRoom(data.room_id)
      queryClient.invalidateQueries({ queryKey: keys.conversations.all })
    },
  })
}
