import { MessageSquarePlus, Search, X } from 'lucide-react'
import { memo, useMemo, useState } from 'react'

import { useDebouncedValue, useIntersection } from '../../hooks/ui'
import { cn, formatListTimestamp, truncate } from '../../lib/utils'
import { Avatar, Badge, Button, EmptyState, ErrorState, Skeleton, Spinner } from '../ui'

const ConversationRow = memo(function ConversationRow({ conversation, isActive, isOnline, onSelect }) {
  const { last_message: lastMessage, unread_count: unread } = conversation
  const hasUnread = unread > 0

  const preview = lastMessage
    ? `${lastMessage.is_mine ? 'You: ' : conversation.is_group ? `${lastMessage.sender_name}: ` : ''}${lastMessage.preview || ''}`
    : 'No messages yet'

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      aria-current={isActive ? 'true' : undefined}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
        // ring-inset so the active outline is drawn within the row's own box and
        // does not nudge neighbouring rows.
        isActive
          ? 'bg-primary/10 ring-1 ring-inset ring-primary/25'
          : 'hover:bg-muted active:bg-muted/80',
      )}
    >
      <Avatar
        src={conversation.photo}
        name={conversation.title}
        size="md"
        showPresence={!conversation.is_group}
        isOnline={isOnline}
      />

      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          {/* min-w-0 on the flex child is what actually lets `truncate` clip; without
              it the name pushes the timestamp out of the row instead of ellipsising. */}
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-sm leading-5',
              hasUnread ? 'font-bold text-foreground' : 'font-semibold text-foreground/90',
            )}
          >
            {conversation.title}
          </span>
          <span
            className={cn(
              'shrink-0 text-[11px] leading-5 tabular-nums',
              hasUnread ? 'font-semibold text-primary' : 'text-muted-foreground',
            )}
          >
            {formatListTimestamp(conversation.last_activity)}
          </span>
        </span>

        <span className="mt-0.5 flex items-center justify-between gap-2">
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-xs leading-5',
              hasUnread ? 'font-medium text-foreground/80' : 'text-muted-foreground',
            )}
          >
            {truncate(preview, 60)}
          </span>
          {hasUnread && (
            <Badge variant="primary" className="shrink-0">
              {unread > 99 ? '99+' : unread}
            </Badge>
          )}
        </span>
      </span>
    </button>
  )
})

function LoadingRows() {
  return (
    <div className="space-y-1 p-2">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <div key={index} className="flex items-center gap-3 px-3 py-2.5">
          <Skeleton className="h-11 w-11 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ConversationList({
  conversations,
  activeRoomId,
  onSelect,
  isLoading,
  isError,
  error,
  onRetry,
  hasNextPage,
  fetchNextPage,
  isFetchingNextPage,
  isOnline,
  onStartChat,
}) {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)

  // Filtering happens against the cached page: the sidebar is already local, so
  // this stays instant and does not spend a request per keystroke.
  const filtered = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase()
    if (!term) return conversations
    return conversations.filter((conversation) => {
      if (conversation.title?.toLowerCase().includes(term)) return true
      return conversation.participants?.some((person) =>
        person.name?.toLowerCase().includes(term),
      )
    })
  }, [conversations, debouncedSearch])

  const sentinelRef = useIntersection(
    () => {
      if (hasNextPage && !isFetchingNextPage) fetchNextPage()
    },
    { enabled: Boolean(hasNextPage) },
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 p-3">
        <div className="relative flex-1">
          <Search
            className="icon-md pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="w-full rounded-lg border border-input bg-field py-2.5 pl-10 pr-10 text-sm placeholder:text-subtle-foreground transition-colors hover:bg-field-hover hover:border-border-strong focus:border-transparent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="icon-md" />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {isLoading ? (
          <LoadingRows />
        ) : isError ? (
          <ErrorState description={error?.message} onRetry={onRetry} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={MessageSquarePlus}
            title={debouncedSearch ? 'No matches' : 'No conversations yet'}
            description={
              debouncedSearch
                ? 'Try a different name.'
                : 'Find people to chat with and your conversations will appear here.'
            }
            action={
              !debouncedSearch && onStartChat ? (
                <Button size="sm" onClick={onStartChat}>
                  Start a conversation
                </Button>
              ) : null
            }
          />
        ) : (
          <div className="space-y-0.5">
            {filtered.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                isActive={conversation.id === Number(activeRoomId)}
                isOnline={
                  conversation.is_group
                    ? undefined
                    : isOnline(conversation.other_user_id) || conversation.is_online
                }
                onSelect={onSelect}
              />
            ))}

            {hasNextPage && (
              <div ref={sentinelRef} className="flex justify-center py-3">
                {isFetchingNextPage ? <Spinner /> : null}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
