/**
 * Bridges the WebSocket to the query cache.
 *
 * Everything pushed by the server is written straight into the cache, so screens
 * re-render from data they already hold instead of refetching. Only events that
 * reference something not currently cached fall back to an invalidation.
 */

import { useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { getAccessToken, refreshAccessToken } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { useToast } from '../components/Toaster'
import config from '../config'
import {
  applyPresence,
  applyReadReceipt,
  bumpConversation,
  upsertMessage,
} from '../lib/cacheUpdates'
import keys from '../lib/queryKeys'
import { truncate } from '../lib/utils'
import ChatSocket from './socket'

const RealtimeContext = createContext(null)

export function RealtimeProvider({ children }) {
  const { isAuthenticated, user } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()

  const [status, setStatus] = useState('idle')
  const [onlineIds, setOnlineIds] = useState(() => new Set())
  const [typingByRoom, setTypingByRoom] = useState({})

  const socketRef = useRef(null)
  // The room currently on screen, so its incoming messages do not bump the unread
  // badge only for the read receipt to clear it a moment later.
  const activeRoomRef = useRef(null)
  const typingTimers = useRef(new Map())
  const userIdRef = useRef(null)

  userIdRef.current = user?.user_id ?? user?.id ?? null

  const setActiveRoom = useCallback((roomId) => {
    activeRoomRef.current = roomId == null ? null : Number(roomId)
  }, [])

  // ------------------------------------------------------------- typing state

  const clearTyping = useCallback((roomId, personId) => {
    const timerKey = `${roomId}:${personId}`
    const timer = typingTimers.current.get(timerKey)
    if (timer) {
      clearTimeout(timer)
      typingTimers.current.delete(timerKey)
    }
    setTypingByRoom((current) => {
      const room = current[roomId]
      if (!room?.[personId]) return current
      const { [personId]: _removed, ...rest } = room
      return { ...current, [roomId]: rest }
    })
  }, [])

  const noteTyping = useCallback(
    (roomId, personId, name, isTyping) => {
      const timerKey = `${roomId}:${personId}`
      const existing = typingTimers.current.get(timerKey)
      if (existing) clearTimeout(existing)

      if (!isTyping) {
        typingTimers.current.delete(timerKey)
        clearTyping(roomId, personId)
        return
      }

      setTypingByRoom((current) => ({
        ...current,
        [roomId]: { ...(current[roomId] ?? {}), [personId]: name },
      }))

      // Self-expiring: a client that disconnects mid-typing never sends the
      // stop event, and a stuck "typing…" indicator looks broken.
      typingTimers.current.set(
        timerKey,
        setTimeout(() => clearTyping(roomId, personId), config.typingIdleMs + 1500),
      )
    },
    [clearTyping],
  )

  // ----------------------------------------------------------- event handling

  const handleEvent = useCallback(
    (event) => {
      const myId = userIdRef.current

      switch (event.type) {
        case 'ready': {
          setOnlineIds((current) => {
            const next = new Set(current)
            return next
          })
          // A reconnect may have missed events; reconcile the lists that drive
          // navigation. Message bodies are re-fetched lazily per room.
          queryClient.invalidateQueries({ queryKey: keys.conversations.all })
          break
        }

        case 'message.new': {
          const { room_id: roomId, message, client_id: clientId } = event
          const isMine = message.sender_id === myId
          const isActive = activeRoomRef.current === roomId

          upsertMessage(queryClient, roomId, message, clientId)

          const preview = message.attachment
            ? '📎 Attachment'
            : message.images
              ? '🖼️ Photo'
              : message.content

          const cached = bumpConversation(queryClient, {
            roomId,
            patch: {
              last_message: {
                id: message.id,
                preview,
                timestamp: message.timestamp,
                sender_id: message.sender_id,
                sender_name: message.sender?.name,
                is_mine: isMine,
              },
              last_activity: message.timestamp,
            },
            incrementUnread: isMine || isActive ? 0 : 1,
          })

          if (!cached) {
            // First message in a conversation this client has not loaded yet.
            queryClient.invalidateQueries({ queryKey: keys.conversations.all })
          }
          if (!isMine && !isActive) {
            queryClient.invalidateQueries({ queryKey: keys.conversations.unread() })
          }

          // Sending clears the sender's own typing indicator on every other client.
          clearTyping(roomId, message.sender_id)
          break
        }

        case 'message.read': {
          applyReadReceipt(queryClient, event.room_id, event.user_id, event.message_ids)
          if (event.user_id === myId) {
            queryClient.invalidateQueries({ queryKey: keys.conversations.unread() })
          }
          break
        }

        case 'typing': {
          noteTyping(event.room_id, event.user_id, event.name, event.is_typing)
          break
        }

        case 'presence': {
          setOnlineIds((current) => {
            const next = new Set(current)
            if (event.is_online) next.add(event.user_id)
            else next.delete(event.user_id)
            return next
          })
          applyPresence(queryClient, event.user_id, event.is_online)
          break
        }

        case 'conversation.new': {
          queryClient.invalidateQueries({ queryKey: keys.conversations.all })
          break
        }

        case 'friend.request': {
          queryClient.invalidateQueries({ queryKey: keys.friendRequests.all })
          queryClient.invalidateQueries({ queryKey: keys.people.all })
          toast.info(`${event.from_user?.name || 'Someone'} sent you a friend request.`, {
            title: 'New friend request',
          })
          break
        }

        case 'friend.update': {
          queryClient.invalidateQueries({ queryKey: keys.friendRequests.all })
          queryClient.invalidateQueries({ queryKey: keys.friends.all })
          queryClient.invalidateQueries({ queryKey: keys.people.all })
          queryClient.invalidateQueries({ queryKey: keys.conversations.all })
          if (event.status === 'accepted') {
            toast.success(`${event.by_user?.name || 'Someone'} accepted your friend request.`)
          }
          break
        }

        case 'block': {
          queryClient.invalidateQueries({ queryKey: keys.blocked.all })
          queryClient.invalidateQueries({ queryKey: keys.conversations.all })
          queryClient.invalidateQueries({ queryKey: keys.people.all })
          if (event.blocked_id === myId && event.blocked) {
            toast.warning('You can no longer message this person.')
          }
          break
        }

        case 'error': {
          // Rate limiting is expected under fast typing; surfacing it as an error
          // toast every time would be noise.
          if (event.code !== 'rate_limited') {
            toast.error(truncate(event.detail || 'Realtime error', 140))
          }
          break
        }

        case 'subscribed':
          break

        default:
          break
      }
    },
    [clearTyping, noteTyping, queryClient, toast],
  )

  // -------------------------------------------------------------- connection

  useEffect(() => {
    if (!isAuthenticated) {
      socketRef.current?.close()
      socketRef.current = null
      setStatus('idle')
      setOnlineIds(new Set())
      setTypingByRoom({})
      return undefined
    }

    const socket = new ChatSocket({
      getToken: getAccessToken,
      onEvent: handleEvent,
      onStatusChange: (next) => {
        setStatus(next)
        if (next === 'unauthorized') {
          // The access token expired while the socket was open. Refresh, then
          // reconnect with the new one; if that fails the HTTP layer signals
          // auth-lost and the app returns to the login screen.
          refreshAccessToken()
            .then(() => socketRef.current?.reconnectNow())
            .catch(() => {})
        }
      },
    })

    socketRef.current = socket
    socket.connect()

    return () => {
      socket.close()
      socketRef.current = null
    }
    // handleEvent is stable via useCallback; reconnecting on every render would
    // otherwise thrash the socket.
  }, [isAuthenticated, handleEvent])

  // A tab restored from the background may hold a socket the OS quietly killed.
  useEffect(() => {
    const revive = () => {
      if (document.visibilityState === 'visible' && socketRef.current?.status !== 'open') {
        socketRef.current?.reconnectNow()
      }
    }
    document.addEventListener('visibilitychange', revive)
    window.addEventListener('online', revive)
    return () => {
      document.removeEventListener('visibilitychange', revive)
      window.removeEventListener('online', revive)
    }
  }, [])

  useEffect(
    () => () => {
      typingTimers.current.forEach((timer) => clearTimeout(timer))
      typingTimers.current.clear()
    },
    [],
  )

  // ------------------------------------------------------------------- api

  const send = useCallback((payload, options) => socketRef.current?.send(payload, options) ?? false, [])

  const sendMessage = useCallback(
    ({ roomId, content, clientId }) =>
      send({ type: 'message.send', room_id: roomId, content, client_id: clientId }),
    [send],
  )

  const markRead = useCallback(
    ({ roomId, messageIds }) =>
      send({
        type: 'message.read',
        room_id: roomId,
        ...(messageIds?.length ? { message_ids: messageIds } : {}),
      }),
    [send],
  )

  const sendTyping = useCallback(
    ({ roomId, isTyping }) =>
      // Not queued: a typing notice delivered after a reconnect is already stale.
      send({ type: 'typing', room_id: roomId, is_typing: isTyping }, { queue: false }),
    [send],
  )

  const subscribeToRoom = useCallback(
    (roomId) => send({ type: 'room.subscribe', room_id: roomId }),
    [send],
  )

  const value = useMemo(
    () => ({
      status,
      isConnected: status === 'open',
      onlineIds,
      isOnline: (userId) => onlineIds.has(userId),
      typingByRoom,
      typingIn: (roomId) => Object.values(typingByRoom[roomId] ?? {}),
      sendMessage,
      markRead,
      sendTyping,
      subscribeToRoom,
      setActiveRoom,
    }),
    [status, onlineIds, typingByRoom, sendMessage, markRead, sendTyping, subscribeToRoom, setActiveRoom],
  )

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

export function useRealtime() {
  const context = useContext(RealtimeContext)
  if (!context) throw new Error('useRealtime must be used inside <RealtimeProvider>')
  return context
}

export default RealtimeProvider
