import { Ban, MessageSquare, ShieldOff, UserMinus, UserPlus } from 'lucide-react'
import { useCallback, useEffect } from 'react'

import { useOpenDirectChat } from '../../hooks/useChat'
import {
  useBlockUser,
  useProfile,
  useRemoveFriend,
  useSendFriendRequest,
  useUnblockUser,
} from '../../hooks/useSocial'
import { rememberPerson } from '../../lib/people'
import { pluralize } from '../../lib/utils'
import { useRealtime } from '../../realtime/RealtimeProvider'
import { useConfirm } from '../ConfirmDialog'
import { useToast } from '../Toaster'
import { Avatar, Button, ErrorState, PresenceDot, Skeleton } from '../ui'
import { Modal } from '../ui'

/** Someone else's profile, with every relationship action in one place. */
export default function ProfileModal({ userId, open, onClose, onOpenConversation }) {
  const { data: profile, isLoading, isError, error, refetch } = useProfile(open ? userId : null)
  const { isOnline } = useRealtime()
  const toast = useToast()

  const sendRequest = useSendFriendRequest()
  const removeFriend = useRemoveFriend()
  const blockUser = useBlockUser()
  const unblockUser = useUnblockUser()
  const openDirect = useOpenDirectChat()
  const confirm = useConfirm()

  const run = useCallback(
    async (action, successMessage, confirmOptions) => {
      if (confirmOptions && !(await confirm(confirmOptions))) return null
      try {
        const result = await action()
        if (successMessage) toast.success(successMessage)
        return result
      } catch (requestError) {
        toast.error(requestError?.message || 'That did not work.')
        return null
      }
    },
    [confirm, toast],
  )

  // A freshly fetched profile is the most authoritative identity the app ever sees.
  useEffect(() => {
    if (profile) rememberPerson(profile)
  }, [profile])

  const online = profile ? isOnline(profile.user_id) || profile.is_online : false

  return (
    <Modal open={open} onClose={onClose} title="Profile" size="sm">
      {isLoading ? (
        <div className="flex flex-col items-center gap-3 py-4">
          <Skeleton className="h-24 w-24 rounded-full" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-52" />
        </div>
      ) : isError ? (
        <ErrorState description={error?.message} onRetry={refetch} />
      ) : profile ? (
        <div className="flex flex-col items-center text-center">
          <Avatar src={profile.photo} name={profile.name} size="xl" />

          <h3 className="mt-4 text-lg font-semibold text-card-foreground">{profile.name}</h3>
          <p className="text-sm text-muted-foreground">{profile.email}</p>

          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <PresenceDot isOnline={online} />
            {online ? 'Online now' : 'Offline'}
            <span aria-hidden>·</span>
            {pluralize(profile.friends?.length ?? 0, 'friend')}
          </p>

          {profile.bio && (
            <p className="mt-4 max-w-sm whitespace-pre-wrap text-sm text-foreground/90">
              {profile.bio}
            </p>
          )}

          {profile.is_blocked ? (
            <div className="mt-6 w-full space-y-2">
              <p className="text-sm text-muted-foreground">
                You have blocked this person. Unblock to exchange messages again.
              </p>
              <Button
                variant="secondary"
                fullWidth
                loading={unblockUser.isPending}
                onClick={() =>
                  run(
                    () => unblockUser.mutateAsync(profile.user_id),
                    `${profile.name} unblocked.`,
                    {
                      title: `Unblock ${profile.name}?`,
                      description: 'They will be able to message you again.',
                      confirmLabel: 'Unblock',
                      tone: 'default',
                    },
                  )
                }
              >
                <ShieldOff className="icon-sm" />
                Unblock
              </Button>
            </div>
          ) : (
            <div className="mt-6 grid w-full gap-2">
              <Button
                fullWidth
                loading={openDirect.isPending}
                onClick={async () => {
                  const result = await run(() => openDirect.mutateAsync(profile.user_id))
                  if (result) {
                    onOpenConversation?.(result.room_id)
                    onClose?.()
                  }
                }}
              >
                <MessageSquare className="icon-sm" />
                Message
              </Button>

              {profile.is_friend ? (
                <Button
                  variant="secondary"
                  fullWidth
                  loading={removeFriend.isPending}
                  onClick={() =>
                    run(
                      () => removeFriend.mutateAsync(profile.user_id),
                      `${profile.name} removed from friends.`,
                      {
                        title: `Remove ${profile.name}?`,
                        description:
                          'They will be removed from your friends list. You will need to send a new request to connect again.',
                        confirmLabel: 'Remove',
                      },
                    )
                  }
                >
                  <UserMinus className="icon-sm" />
                  Remove friend
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  fullWidth
                  loading={sendRequest.isPending}
                  onClick={() =>
                    run(
                      () => sendRequest.mutateAsync(profile.user_id),
                      `Friend request sent to ${profile.name}.`,
                    )
                  }
                >
                  <UserPlus className="icon-sm" />
                  Add friend
                </Button>
              )}

              <Button
                variant="ghost"
                fullWidth
                className="text-danger hover:bg-danger-soft"
                loading={blockUser.isPending}
                onClick={() =>
                  run(() => blockUser.mutateAsync(profile.user_id), `${profile.name} blocked.`, {
                    title: `Block ${profile.name}?`,
                    description:
                      'They will not be able to message you, and your conversation becomes read-only. You can unblock them later from Settings.',
                    confirmLabel: 'Block',
                  })
                }
              >
                <Ban className="icon-sm" />
                Block
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  )
}
