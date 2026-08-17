import { ArrowDown, MessagesSquare } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { cn, formatDateDivider, isSameDay, withinBurst } from '../../lib/utils'
import { Button, EmptyState, Skeleton, Spinner } from '../ui'
import MessageBubble from './MessageBubble'

/** Distance from the bottom that still counts as "following the conversation". */
const NEAR_BOTTOM_PX = 120

function DateDivider({ value }) {
  return (
    <div className="my-4 flex items-center gap-3" role="separator">
      <span className="h-px flex-1 bg-border" />
      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
        {formatDateDivider(value)}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

function LoadingHistory() {
  return (
    <div className="space-y-4 p-4">
      {[0, 1, 2, 3, 4].map((index) => (
        <div key={index} className={cn('flex gap-2', index % 2 ? 'justify-end' : 'justify-start')}>
          {index % 2 === 0 && <Skeleton className="h-9 w-9 rounded-full" />}
          <Skeleton className={cn('h-14 rounded-2xl', index % 3 === 0 ? 'w-64' : 'w-44')} />
        </div>
      ))}
    </div>
  )
}

/**
 * The scrollable message history.
 *
 * Scroll behaviour is the fiddly part and it is handled explicitly:
 *  - New messages only auto-scroll when the user is already near the bottom, so
 *    reading back through history is never yanked away.
 *  - Loading older messages prepends content, which would jump the viewport; the
 *    scroll offset is restored from the height delta before the browser paints.
 */
export default function MessageList({
  roomId,
  messages,
  currentUserId,
  isGroup,
  participantCount,
  isLoading,
  hasOlder,
  onLoadOlder,
  isLoadingOlder,
  onVisible,
  onRetry,
  onDiscard,
  onOpenImage,
  typingNames = [],
}) {
  const containerRef = useRef(null)
  const bottomRef = useRef(null)
  const topSentinelRef = useRef(null)
  const [showJumpButton, setShowJumpButton] = useState(false)

  // Preserved across the render that prepends older messages.
  const restoreRef = useRef(null)
  const lastMessageId = useRef(null)
  const isNearBottom = useRef(true)

  /** Precompute avatar/name/divider flags once per message list change. */
  const rows = useMemo(() => {
    return messages.map((message, index) => {
      const previous = messages[index - 1]
      const next = messages[index + 1]
      const sameSenderAsPrevious =
        previous &&
        previous.sender_id === message.sender_id &&
        withinBurst(previous.timestamp, message.timestamp)
      const sameSenderAsNext =
        next &&
        next.sender_id === message.sender_id &&
        withinBurst(message.timestamp, next.timestamp)

      return {
        message,
        showDateDivider: !previous || !isSameDay(previous.timestamp, message.timestamp),
        // Avatar sits on the last bubble of a burst, name on the first.
        showAvatar: !sameSenderAsNext,
        showName: !sameSenderAsPrevious,
      }
    })
  }, [messages])

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior, block: 'end' })
  }, [])

  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight
    isNearBottom.current = distance < NEAR_BOTTOM_PX
    setShowJumpButton(distance > 400)
  }, [])

  // Older messages: capture the height before the prepend so it can be undone.
  const requestOlder = useCallback(() => {
    const container = containerRef.current
    if (!container || !hasOlder || isLoadingOlder) return
    restoreRef.current = {
      previousHeight: container.scrollHeight,
      previousTop: container.scrollTop,
    }
    onLoadOlder?.()
  }, [hasOlder, isLoadingOlder, onLoadOlder])

  useEffect(() => {
    const sentinel = topSentinelRef.current
    if (!sentinel || !hasOlder) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) requestOlder()
      },
      { root: containerRef.current, rootMargin: '150px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasOlder, requestOlder])

  // Runs before paint, so the user never sees the jump.
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    if (restoreRef.current) {
      const { previousHeight, previousTop } = restoreRef.current
      const delta = container.scrollHeight - previousHeight
      if (delta > 0) container.scrollTop = previousTop + delta
      restoreRef.current = null
      return
    }

    const newest = messages[messages.length - 1]
    if (!newest) return

    const isNewMessage = newest.id !== lastMessageId.current
    const firstRender = lastMessageId.current === null
    lastMessageId.current = newest.id

    if (firstRender) {
      // Land at the bottom without an animation on entering a conversation.
      container.scrollTop = container.scrollHeight
      return
    }
    if (isNewMessage && isNearBottom.current) {
      scrollToBottom(newest.status === 'sending' ? 'auto' : 'smooth')
    }
  }, [messages, scrollToBottom])

  // Reset the follow state when switching rooms. The parent also keys this
  // component by room, but keeping the guard here means the component is correct
  // on its own terms rather than relying on how it happens to be mounted.
  useEffect(() => {
    lastMessageId.current = null
    isNearBottom.current = true
    setShowJumpButton(false)
  }, [roomId])

  // Report visibility so the room can be marked read.
  useEffect(() => {
    if (!messages.length) return
    if (document.visibilityState !== 'visible') return
    onVisible?.()
  }, [messages.length, onVisible])

  if (isLoading) return <LoadingHistory />

  if (!messages.length) {
    return (
      <EmptyState
        icon={MessagesSquare}
        title="No messages yet"
        description="Say hello — your first message will show up here."
        className="h-full"
      />
    )
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto overscroll-contain"
        aria-live="polite"
        aria-relevant="additions"
      >
        {/*
          Full width, not a centred max-width column. Capping this at max-w-3xl and
          centring it pulled both sides of the conversation into the middle of a wide
          pane, so incoming and outgoing bubbles ended up clustered together with dead
          space either side. Letting the rows span the pane is what makes
          justify-start / justify-end actually read as two opposite sides.

          Messages also fill from the top downwards, so the first message in a new
          conversation appears at the top rather than floating above the composer.
        */}
        <div className="flex w-full flex-col px-4 py-4 sm:px-8">
        <div ref={topSentinelRef} aria-hidden />

        {hasOlder && (
          <div className="flex justify-center pb-3">
            {isLoadingOlder ? (
              <Spinner label="Loading earlier messages" />
            ) : (
              <Button variant="ghost" size="sm" onClick={requestOlder}>
                Load earlier messages
              </Button>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          {rows.map(({ message, showDateDivider, showAvatar, showName }) => (
            <div key={message.clientId ?? message.id}>
              {showDateDivider && <DateDivider value={message.timestamp} />}
              <MessageBubble
                message={message}
                isMine={message.sender_id === currentUserId}
                showAvatar={showAvatar}
                showName={showName}
                isGroup={isGroup}
                participantCount={participantCount}
                onRetry={onRetry}
                onDiscard={onDiscard}
                onOpenImage={onOpenImage}
              />
            </div>
          ))}
        </div>

        {typingNames.length > 0 && (
          <div className="mt-2 flex items-center gap-2 pl-11 text-xs text-muted-foreground">
            <span className="flex gap-1" aria-hidden>
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60"
                  style={{ animationDelay: `${dot * 120}ms` }}
                />
              ))}
            </span>
            <span>
              {typingNames.length === 1
                ? `${typingNames[0]} is typing…`
                : `${typingNames.length} people are typing…`}
            </span>
          </div>
        )}

        <div ref={bottomRef} className="h-1" aria-hidden />
        </div>
      </div>

      {showJumpButton && (
        <button
          type="button"
          onClick={() => scrollToBottom()}
          aria-label="Jump to latest messages"
          className="absolute bottom-4 right-4 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card shadow-lg transition-transform hover:scale-105"
        >
          <ArrowDown className="h-6 w-6 text-foreground" />
        </button>
      )}
    </div>
  )
}
