import { ArrowDown, MessagesSquare } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { cn, formatDateDivider, isSameDay, withinBurst } from '../../lib/utils'
import { Button, EmptyState, Skeleton, Spinner } from '../ui'
import MessageBubble from './MessageBubble'

/**
 * Distance from the bottom that still counts as "following the conversation".
 *
 * A floor, not the whole rule — see `followThreshold`. 120px was under the height
 * of a single image bubble, so nudging the wheel once was enough to stop being
 * counted as "at the bottom", and every message after that had to be scrolled to
 * by hand.
 */
const NEAR_BOTTOM_PX = 160

/** Quarter of the visible history, so the band scales with the pane. */
const followThreshold = (container) =>
  Math.max(NEAR_BOTTOM_PX, container.clientHeight * 0.25)

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

function LoadingHistory({ topInset }) {
  return (
    <div className={cn('space-y-4 p-4', topInset)}>
      {[0, 1, 2, 3, 4].map((index) => {
        const outgoing = index % 2 === 1
        return (
          <div key={index} className={cn('flex gap-2', outgoing ? 'justify-end' : 'justify-start')}>
            {/* Both sides carry an avatar now, so the placeholder mirrors that. */}
            {!outgoing && <Skeleton className="h-9 w-9 shrink-0 rounded-full" />}
            <Skeleton className={cn('h-14 rounded-2xl', index % 3 === 0 ? 'w-64' : 'w-44')} />
            {outgoing && <Skeleton className="h-9 w-9 shrink-0 rounded-full" />}
          </div>
        )
      })}
    </div>
  )
}

/**
 * The scrollable message history.
 *
 * Scroll behaviour is the fiddly part and it is handled explicitly:
 *  - Anything you send scrolls you to the bottom, always. You wrote it; you want
 *    to see it land.
 *  - Incoming messages only auto-scroll when you are already near the bottom, so
 *    reading back through history is never yanked away.
 *  - A ResizeObserver re-pins the view whenever the content grows while you are
 *    following along. Scrolling once on arrival is not enough: an image or a
 *    file card has no height until it loads, so the message that triggered the
 *    scroll is taller a moment later and the newest content ends up below the
 *    fold — which is what left people scrolling down by hand for every photo.
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
  // Padding that keeps the first message clear of the floating chat header.
  // Passed in rather than hardcoded so the header owns its own dimensions.
  topInset = '',
}) {
  const containerRef = useRef(null)
  const contentRef = useRef(null)
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

  /**
   * Scroll the history to the very bottom.
   *
   * Sets the container's own `scrollTop` rather than calling `scrollIntoView` on a
   * sentinel: that walks up the tree and can scroll ancestors too, and it aims at
   * a position computed when the call was made — which is the wrong position by
   * the time a just-arrived image has finished loading.
   *
   * `isNearBottom` is updated here rather than waiting for the scroll event, so a
   * second message arriving in the same tick is not judged against a stale
   * position.
   */
  const scrollToBottom = useCallback((behavior = 'auto') => {
    const container = containerRef.current
    if (!container) return
    isNearBottom.current = true
    setShowJumpButton(false)
    if (behavior === 'smooth') {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
    } else {
      container.scrollTop = container.scrollHeight
    }
  }, [])

  const handleScroll = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight
    isNearBottom.current = distance < followThreshold(container)
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
      scrollToBottom('auto')
      return
    }
    if (!isNewMessage) return

    // Your own message always wins over the follow state: having sent something
    // from halfway up the history and been left staring at old messages is the
    // one case where not scrolling is never what was wanted.
    const isMine = newest.sender_id === currentUserId
    if (isMine || isNearBottom.current) {
      // Instant, not smooth. A glide is a moving target — it aims at the height
      // measured when it started, so a second message (or an image finishing) part
      // way through leaves the view short of the bottom.
      scrollToBottom('auto')
    }
  }, [messages, currentUserId, scrollToBottom])

  /**
   * Keep the view pinned while the content grows underneath it.
   *
   * Images, file cards, link previews and the typing indicator all change height
   * after they are inserted, and a window or pane resize changes the viewport under
   * a fixed scroll offset. Re-pinning on every size change covers all of them, and
   * costs nothing while the user is reading history: `isNearBottom` is false then,
   * so the observer does not touch the scroll position.
   */
  useEffect(() => {
    const container = containerRef.current
    const content = contentRef.current
    if (!container || !content || typeof ResizeObserver === 'undefined') return undefined

    const observer = new ResizeObserver(() => {
      // A pending history restore owns the scroll position for this frame.
      if (restoreRef.current || !isNearBottom.current) return
      container.scrollTop = container.scrollHeight
    })
    observer.observe(content)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

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

  if (isLoading) return <LoadingHistory topInset={topInset} />

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
        className="h-full overflow-y-auto overflow-x-hidden overscroll-contain"
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
        <div
          ref={contentRef}
          className={cn('flex w-full min-w-0 flex-col px-3 pb-4 sm:px-6 lg:px-8', topInset || 'pt-4')}
        >
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

        </div>
      </div>

      {showJumpButton && (
        <button
          type="button"
          onClick={() => scrollToBottom('smooth')}
          aria-label="Jump to latest messages"
          className='glass-crystal absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full border transition-transform duration-200 ease-out hover:scale-105 active:scale-95'
        >
          <ArrowDown className="icon-lg text-foreground" />
        </button>
      )}
    </div>
  )
}
