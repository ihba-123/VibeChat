import { MessagesSquare } from 'lucide-react'

import config from '../config'
import { useMe } from '../hooks/useSocial'

/** Shown on wide screens when no conversation is selected. */
export default function ChatWelcome() {
  const { data: me } = useMe()
  const firstName = me?.name?.split(' ')[0]

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <MessagesSquare className="icon-xl text-primary" aria-hidden />
      </span>
      <h2 className="mt-5 text-xl font-bold text-foreground">
        {firstName ? `Welcome back, ${firstName}` : `Welcome to ${config.appName}`}
      </h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Pick a conversation on the left, or head to People to find someone new to talk to.
      </p>
    </div>
  )
}
