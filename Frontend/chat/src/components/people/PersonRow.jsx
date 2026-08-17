import { memo } from 'react'

import { cn } from '../../lib/utils'
import { Avatar } from '../ui'

/** One person in any list, with the caller supplying the trailing actions. */
const PersonRow = memo(function PersonRow({
  person,
  isOnline,
  subtitle,
  actions,
  onClick,
  className,
}) {
  const online = isOnline ?? person.is_online
  const Wrapper = onClick ? 'button' : 'div'

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted',
        className,
      )}
    >
      <Wrapper
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3 text-left',
          onClick && 'rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
      >
        <Avatar
          src={person.photo}
          name={person.name}
          size="md"
          showPresence
          isOnline={online}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            {person.name || person.email}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {subtitle ?? (online ? 'Online' : person.email)}
          </span>
        </span>
      </Wrapper>

      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  )
})

export default PersonRow
