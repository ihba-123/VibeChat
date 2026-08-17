import { ShieldOff } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'

import ChatHeader from '../components/chat/ChatHeader'
import { useConfirm } from '../components/ConfirmDialog'
import ImageLightbox from '../components/chat/ImageLightbox'
import MessageComposer from '../components/chat/MessageComposer'
import MessageList from '../components/chat/MessageList'
import { useToast } from '../components/Toaster'
import { Button, ErrorState } from '../components/ui'
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
  const confirm = useConfirm()

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

  /**
   * Runs an action, optionally behind a confirmation prompt.
   *
   * The prompt is a parameter of the same helper rather than a separate wrapper so
   * that a new destructive action added here cannot accidentally skip it — the
   * only way to run something is through `act`, and the guard sits in one place.
   */
  const discardMessage = useCallback(
    async (message) => {
      const ok = await confirm({
        title: 'Discard this message?',
        description: 'It was never delivered, and the text will be lost.',
        confirmLabel: 'Discard',
      })
      if (ok) discard(message)
    },
    [confirm, discard],
  )

  const act = useCallback(
    async (action, successMessage, confirmOptions) => {
      if (confirmOptions && !(await confirm(confirmOptions))) return
      try {
        await action()
        if (successMessage) toast.success(successMessage)
      } catch (error) {
        toast.error(error?.message || 'That did not work.')
      }
    },
    [confirm, toast],
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
          act(() => blockUser.mutateAsync(otherUserId), `${conversation?.title} blocked.`, {
            title: `Block ${conversation?.title || 'this person'}?`,
            description:
              'They will not be able to message you, and this conversation becomes read-only. You can unblock them later from Settings.',
            confirmLabel: 'Block',
          })
        }
        onUnblock={() =>
          act(() => unblockUser.mutateAsync(otherUserId), `${conversation?.title} unblocked.`, {
            title: `Unblock ${conversation?.title || 'this person'}?`,
            description: 'They will be able to message you again.',
            confirmLabel: 'Unblock',
            tone: 'default',
          })
        }
        onRemoveFriend={() =>
          act(
            () => removeFriend.mutateAsync(otherUserId),
            `${conversation?.title} removed from friends.`,
            {
              title: `Remove ${conversation?.title || 'this person'}?`,
              description:
                'They will be removed from your friends list. You will need to send a new request to connect again.',
              confirmLabel: 'Remove',
            },
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
        onDiscard={discardMessage}
        onOpenImage={setLightboxSrc}
        typingNames={typingNames}
      />

      <MessageComposer
        roomId={roomId}
        disabled={isBlocked}
        disabledReason={
          conversation?.title
            ? `You blocked ${conversation.title}. Unblock to message again.`
            : 'You blocked this person. Unblock to message again.'
        }
        disabledAction={
          <Button
            size="sm"
            className="shrink-0"
            loading={unblockUser.isPending}
            onClick={() =>
              act(
                () => unblockUser.mutateAsync(otherUserId),
                `${conversation?.title || 'This person'} unblocked.`,
              )
            }
          >
            <ShieldOff className="icon-sm" />
            Unblock
          </Button>
        }
        onSendText={send}
        onUpload={handleUpload}
        onTyping={handleTyping}
      />

      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </div>
  )
}
