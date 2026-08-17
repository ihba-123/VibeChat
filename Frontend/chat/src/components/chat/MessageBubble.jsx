import { AlertCircle, Check, CheckCheck, Clock, Download, FileText } from 'lucide-react'
import { memo } from 'react'

import { cn, formatTime } from '../../lib/utils'
import { Avatar } from '../ui'

/** Delivery state for a message the current user sent. */
function DeliveryStatus({ message, participantCount }) {
  if (message.status === 'sending') {
    return <Clock className="h-4 w-4 opacity-70" aria-label="Sending" />
  }
  if (message.status === 'failed') {
    return <AlertCircle className="h-4 w-4 text-red-300" aria-label="Not delivered" />
  }
  // read_by_count includes the sender, so anything above 1 means somebody else has
  // seen it. In a group, everyone having read it is the double tick.
  const readers = message.read_by_count ?? 1
  if (readers >= Math.max(2, participantCount)) {
    return <CheckCheck className="h-4 w-4" aria-label="Read" />
  }
  if (readers >= 2) {
    return <CheckCheck className="h-4 w-4 opacity-70" aria-label="Read by some" />
  }
  return <Check className="h-4 w-4 opacity-70" aria-label="Sent" />
}

function AttachmentCard({ url, name, isMine }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        'flex items-center gap-3 rounded-lg border p-2.5 transition-colors',
        isMine
          ? 'border-primary-foreground/25 bg-primary-foreground/10 hover:bg-primary-foreground/20'
          : 'border-border bg-background hover:bg-muted',
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
          isMine ? 'bg-primary-foreground/20' : 'bg-muted',
        )}
      >
        <FileText className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{name || 'Attachment'}</span>
        <span className={cn('text-xs', isMine ? 'opacity-75' : 'text-muted-foreground')}>
          Tap to open
        </span>
      </span>
      <Download className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
    </a>
  )
}

/**
 * A single message.
 *
 * Memoised because the list re-renders on every incoming message, presence change
 * and typing event; without it a long conversation re-renders every bubble each
 * time.
 */
const MessageBubble = memo(function MessageBubble({
  message,
  isMine,
  showAvatar,
  showName,
  isGroup,
  participantCount = 2,
  onRetry,
  onDiscard,
  onOpenImage,
}) {
  const failed = message.status === 'failed'
  const hasText = Boolean(message.content)

  return (
    <div className={cn('flex w-full gap-2', isMine ? 'justify-end' : 'justify-start')}>
      {!isMine && (
        <span className="w-9 shrink-0 self-end">
          {showAvatar && (
            <Avatar src={message.sender?.photo} name={message.sender?.name} size="sm" />
          )}
        </span>
      )}

      {/*
        85% on a narrow screen (unchanged on mobile), but never wider than 42rem.
        Now that the row spans the full pane, an uncapped 85% bubble would reach from
        one edge almost to the other on a wide monitor and the two sides would stop
        reading as separate. Short messages are unaffected — they size to content and
        stay hugged to their own edge by the row's justification.
      */}
      <div
        className={cn(
          'flex min-w-0 max-w-[min(85%,42rem)] flex-col gap-1',
          isMine && 'items-end',
        )}
      >
        {showName && isGroup && !isMine && (
          <span className="px-1.5 text-xs font-semibold text-muted-foreground">
            {message.sender?.name}
          </span>
        )}

        <div
          className={cn(
            'group relative min-w-0 rounded-2xl px-3.5 py-2.5 text-sm shadow-sm transition-opacity',
            isMine
              ? 'bg-primary text-primary-foreground'
              : 'border border-border bg-card text-card-foreground',
            // Tail on the last bubble of a burst.
            isMine ? (showAvatar ? 'rounded-br-md' : '') : showAvatar ? 'rounded-bl-md' : '',
            message.status === 'sending' && 'opacity-75',
            failed && 'ring-1 ring-red-500',
          )}
        >
          {message.images && (
            <button
              type="button"
              onClick={() => onOpenImage?.(message.images)}
              className="mb-1.5 block overflow-hidden rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <img
                src={message.images}
                alt={hasText ? message.content : 'Shared image'}
                loading="lazy"
                decoding="async"
                className="max-h-80 w-full max-w-sm object-cover"
              />
            </button>
          )}

          {message.attachment && (
            <div className={cn(hasText && 'mb-1.5')}>
              <AttachmentCard
                url={message.attachment}
                name={message.attachment_name}
                isMine={isMine}
              />
            </div>
          )}

          {hasText && <p className="whitespace-pre-wrap break-words">{message.content}</p>}

          <div
            className={cn(
              'mt-1 flex items-center justify-end gap-1.5 text-[11px] leading-none',
              isMine ? 'text-primary-foreground/80' : 'text-muted-foreground',
            )}
          >
            <time dateTime={message.timestamp} className="whitespace-nowrap tabular-nums">
              {formatTime(message.timestamp)}
            </time>
            {isMine && (
              <DeliveryStatus message={message} participantCount={participantCount} />
            )}
          </div>
        </div>

        {failed && (
          <div className="flex flex-wrap items-center gap-2 px-1.5 text-xs">
            <span className="text-red-500">{message.error || 'Not delivered.'}</span>
            <button
              type="button"
              onClick={() => onRetry?.(message)}
              className="font-semibold text-primary hover:underline"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => onDiscard?.(message)}
              className="font-semibold text-muted-foreground hover:underline"
            >
              Discard
            </button>
          </div>
        )}
      </div>
    </div>
  )
})

export default MessageBubble
