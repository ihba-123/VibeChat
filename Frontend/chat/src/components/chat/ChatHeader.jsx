import { ArrowLeft, Ban, MoreVertical, UserMinus, UserRound } from 'lucide-react'
import { useRef, useState } from 'react'

import { useOnClickOutside } from '../../hooks/ui'
import { cn, pluralize } from '../../lib/utils'
import { Avatar, IconButton } from '../ui'

function Menu({ items }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useOnClickOutside(ref, () => setOpen(false))

  return (
    <div ref={ref} className="relative">
      <IconButton label="Conversation options" onClick={() => setOpen((value) => !value)}>
        <MoreVertical className="h-6 w-6" />
      </IconButton>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-xl"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                item.onClick?.()
              }}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-muted',
                item.danger ? 'text-red-500' : 'text-card-foreground',
              )}
            >
              {item.icon && <item.icon className="h-5 w-5" aria-hidden />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ChatHeader({
  conversation,
  isOnline,
  typingNames = [],
  onBack,
  onViewProfile,
  onBlock,
  onUnblock,
  onRemoveFriend,
  isBlocked,
}) {
  // A conversation opened by direct link may not be in the cached sidebar page
  // yet. Returning null here left the screen with no header and, on mobile, no way
  // back — so render the frame and fill in the details when they arrive.
  if (!conversation) {
    return (
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card px-3 sm:px-4">
        {onBack && (
          <IconButton label="Back to conversations" className="lg:hidden" onClick={onBack}>
            <ArrowLeft className="h-6 w-6" />
          </IconButton>
        )}
        <div className="h-11 w-11 animate-pulse rounded-full bg-muted" aria-hidden />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 w-32 animate-pulse rounded bg-muted" aria-hidden />
          <div className="h-3 w-20 animate-pulse rounded bg-muted" aria-hidden />
        </div>
      </header>
    )
  }

  const subtitle = (() => {
    if (typingNames.length) {
      return typingNames.length === 1 ? `${typingNames[0]} is typing…` : 'Several people are typing…'
    }
    if (conversation.is_group) {
      return pluralize(conversation.participants?.length ?? 0, 'member')
    }
    if (isBlocked) return 'Blocked'
    return isOnline ? 'Online' : 'Offline'
  })()

  const menuItems = [
    conversation.other_user_id && {
      label: 'View profile',
      icon: UserRound,
      onClick: onViewProfile,
    },
    conversation.other_user_id && {
      label: 'Remove friend',
      icon: UserMinus,
      onClick: onRemoveFriend,
    },
    conversation.other_user_id &&
      (isBlocked
        ? { label: 'Unblock', icon: Ban, onClick: onUnblock }
        : { label: 'Block', icon: Ban, onClick: onBlock, danger: true }),
  ].filter(Boolean)

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card px-3 sm:px-4">
      {onBack && (
        <IconButton label="Back to conversations" className="lg:hidden" onClick={onBack}>
          <ArrowLeft className="h-6 w-6" />
        </IconButton>
      )}

      <button
        type="button"
        onClick={onViewProfile}
        disabled={!conversation.other_user_id}
        className="-mx-1.5 flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-muted/60 disabled:cursor-default disabled:hover:bg-transparent"
      >
        <Avatar
          src={conversation.photo}
          name={conversation.title}
          size="md"
          showPresence={!conversation.is_group}
          isOnline={isOnline}
        />
        {/* min-w-0 on the text column, and fixed line heights, so the name and
            subtitle stack cleanly instead of wrapping into the avatar. */}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold leading-5 text-card-foreground">
            {conversation.title}
          </span>
          <span
            className={cn(
              'block truncate text-xs leading-4',
              typingNames.length ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            {subtitle}
          </span>
        </span>
      </button>

      {menuItems.length > 0 && <Menu items={menuItems} />}
    </header>
  )
}
