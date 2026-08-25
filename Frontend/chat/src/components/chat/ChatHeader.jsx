import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, Ban, MoreVertical, Pencil, UserMinus, UserRound, Users } from 'lucide-react'
import { useRef, useState } from 'react'

import { useOnClickOutside } from '../../hooks/ui'
import { cn, pluralize } from '../../lib/utils'
import { Avatar, IconButton } from '../ui'

/*
 * The header floats over the message list rather than sitting above it, so the
 * conversation runs edge to edge and slides under the glass.
 *
 * Two layers, and the split matters: the outer <header> spans the pane to
 * position the pill but is `pointer-events-none`, so the gap around the pill
 * stays clickable down to the messages underneath. Only the pill itself takes
 * pointer events back.
 *
 * ChatRoom is responsible for the matching top inset on the list — see the
 * HEADER_INSET export.
 */

/** Top padding the message list needs to clear the floating pill. */
export const HEADER_INSET = 'pt-[4.75rem] sm:pt-[5.75rem]'

const PILL =
  'glass-crystal pointer-events-auto flex h-14 items-center gap-3 rounded-full border px-2 sm:h-16 sm:px-2.5'

function Menu({ items }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useOnClickOutside(ref, () => setOpen(false))

  return (
    <div ref={ref} className="relative">
      <IconButton label="Conversation options" onClick={() => setOpen((value) => !value)}>
        <MoreVertical className="icon-lg" />
      </IconButton>

      {open && (
        <div
          role="menu"
          className="glass-strong absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-2xl border py-1 shadow-xl"
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
                item.danger ? 'text-danger' : 'text-card-foreground',
              )}
            >
              {item.icon && <item.icon className="icon-sm" aria-hidden />}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Positioning frame shared by the loading and loaded states. */
function HeaderFrame({ children }) {
  const reduceMotion = useReducedMotion()

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 px-2 pt-2 sm:px-4 sm:pt-3">
      <motion.div
        className={PILL}
        // Settles in rather than appearing. Only transform and opacity are
        // animated, so this stays on the compositor and never lands on the main
        // thread next to the blur.
        initial={reduceMotion ? false : { opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </header>
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
  onGroupInfo,
  isBlocked,
}) {
  // A conversation opened by direct link may not be in the cached sidebar page
  // yet. Returning null here left the screen with no header and, on mobile, no way
  // back — so render the frame and fill in the details when they arrive.
  if (!conversation) {
    return (
      <HeaderFrame>
        {onBack && (
          <IconButton label="Back to conversations" className="lg:hidden" onClick={onBack}>
            <ArrowLeft className="icon-lg" />
          </IconButton>
        )}
        <div className="h-10 w-10 animate-pulse rounded-full bg-muted sm:h-11 sm:w-11" aria-hidden />
        <div className="flex-1 space-y-1.5 pr-2">
          <div className="h-3.5 w-32 animate-pulse rounded bg-muted" aria-hidden />
          <div className="h-3 w-20 animate-pulse rounded bg-muted" aria-hidden />
        </div>
      </HeaderFrame>
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

  // A group and a direct chat have nothing in common here, so the menu is built
  // from one branch or the other rather than from a list of conditionals that all
  // happen to test the same thing. Groups previously fell through with an empty
  // list, which is why they had no menu button at all.
  const menuItems = conversation.is_group
    ? [
        { label: 'Group info', icon: Users, onClick: onGroupInfo },
        // Shown to the admin only — and to the admin the entry is the useful one,
        // so it opens the same dialog with the name already editable.
        conversation.is_admin && {
          label: 'Rename group',
          icon: Pencil,
          onClick: () => onGroupInfo?.({ rename: true }),
        },
      ].filter(Boolean)
    : [
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
    <HeaderFrame>
      {onBack && (
        <IconButton label="Back to conversations" className="lg:hidden" onClick={onBack}>
          <ArrowLeft className="icon-lg" />
        </IconButton>
      )}

      <button
        type="button"
        onClick={conversation.is_group ? onGroupInfo : onViewProfile}
        disabled={!conversation.is_group && !conversation.other_user_id}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3 rounded-full py-1 pl-1 pr-2 text-left',
          // duration/easing matched to the pill so hover and the entrance share a
          // single motion vocabulary.
          'transition-[background-color,transform] duration-200 ease-out',
          'hover:bg-foreground/[0.06] active:scale-[0.995]',
          'disabled:cursor-default disabled:hover:bg-transparent disabled:active:scale-100',
        )}
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
    </HeaderFrame>
  )
}
