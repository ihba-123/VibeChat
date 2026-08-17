import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'

import ChatHeader from '../components/chat/ChatHeader'
import ImageLightbox from '../components/chat/ImageLightbox'
import MessageComposer from '../components/chat/MessageComposer'
import MessageList from '../components/chat/MessageList'
import { useToast } from '../components/Toaster'
import { ErrorState } from '../components/ui'
import { useAuth } from '../auth/AuthProvider'
import {
  useConversation,
  useMarkRead,
  useMessages,
  useSendMessage,
  useUploadMessage,
} from '../hooks/useChat'
import {
  useBlockedUsers,
  useBlockUser,
  useMe,
  useRemoveFriend,
  useUnblockUser,
} from '../hooks/useSocial'
import { useRealtime } from '../realtime/RealtimeProvider'

export default function ChatRoom() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { onViewProfile } = useOutletContext() ?? {}
  const toast = useToast()

  const { data: me } = useMe()
  const { user } = useAuth()
  const currentUserId = me?.user_id ?? user?.user_id ?? user?.id ?? null

  const { isOnline, typingIn, sendTyping, subscribeToRoom } = useRealtime()
  const conversation = useConversation(roomId)

  const messagesQuery = useMessages(roomId)
  const { send, retry, discard } = useSendMessage(roomId)
  const upload = useUploadMessage(roomId)
  const markRead = useMarkRead(roomId)

  const { blocked } = useBlockedUsers()
  const blockUser = useBlockUser()
  const unblockUser = useUnblockUser()
  const removeFriend = useRemoveFriend()

  const [lightboxSrc, setLightboxSrc] = useState(null)

  const otherUserId = conversation?.other_user_id ?? null
  const isBlocked = useMemo(
    () => blocked.some((entry) => entry.user?.user_id === otherUserId),
    [blocked, otherUserId],
  )

  // The socket joins every room the user belonged to at connect time; a
  // conversation opened since then has to be subscribed to explicitly.
  useEffect(() => {
    if (roomId) subscribeToRoom(Number(roomId))
  }, [roomId, subscribeToRoom])

  // Mark the room read on entry, and again when the tab regains focus.
  const markVisible = useCallback(() => {
    if (document.visibilityState === 'visible') markRead()
  }, [markRead])

  useEffect(() => {
    markVisible()
    document.addEventListener('visibilitychange', markVisible)
    window.addEventListener('focus', markVisible)
    return () => {
      document.removeEventListener('visibilitychange', markVisible)
      window.removeEventListener('focus', markVisible)
    }
  }, [markVisible])

  const typingNames = typingIn(Number(roomId))

  const handleUpload = useCallback(
    (payload) => upload.mutateAsync(payload),
    [upload],
  )

  const handleTyping = useCallback(
    (isTyping) => sendTyping({ roomId: Number(roomId), isTyping }),
    [roomId, sendTyping],
  )

  const act = useCallback(
    async (action, successMessage) => {
      try {
        await action()
        if (successMessage) toast.success(successMessage)
      } catch (error) {
        toast.error(error?.message || 'That did not work.')
      }
    },
    [toast],
  )

  if (messagesQuery.isError) {
    return (
      <div className="flex h-full items-center justify-center">
        <ErrorState
          title="Could not open this conversation"
          description={messagesQuery.error?.message}
          onRetry={messagesQuery.refetch}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChatHeader
        conversation={conversation}
        isOnline={otherUserId ? isOnline(otherUserId) || conversation?.is_online : undefined}
        typingNames={typingNames}
        isBlocked={isBlocked}
        onBack={() => navigate('/app')}
        onViewProfile={() => otherUserId && onViewProfile?.(otherUserId)}
        onBlock={() =>
          act(() => blockUser.mutateAsync(otherUserId), `${conversation?.title} blocked.`)
        }
        onUnblock={() =>
          act(() => unblockUser.mutateAsync(otherUserId), `${conversation?.title} unblocked.`)
        }
        onRemoveFriend={() =>
          act(
            () => removeFriend.mutateAsync(otherUserId),
            `${conversation?.title} removed from friends.`,
          )
        }
      />

      <MessageList
        // Keyed by room so scroll position and the "following the conversation"
        // state start clean on every switch instead of carrying over.
        key={roomId}
        roomId={roomId}
        messages={messagesQuery.messages}
        currentUserId={currentUserId}
        isGroup={Boolean(conversation?.is_group)}
        participantCount={conversation?.participants?.length ?? 2}
        isLoading={messagesQuery.isLoading}
        hasOlder={messagesQuery.hasOlder}
        onLoadOlder={messagesQuery.loadOlder}
        isLoadingOlder={messagesQuery.isLoadingOlder}
        onVisible={markVisible}
        onRetry={retry}
        onDiscard={discard}
        onOpenImage={setLightboxSrc}
        typingNames={typingNames}
      />

      <MessageComposer
        roomId={roomId}
        disabled={isBlocked}
        disabledReason="You have blocked this person. Unblock them to start messaging again."
        onSendText={send}
        onUpload={handleUpload}
        onTyping={handleTyping}
      />

      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  )
}
