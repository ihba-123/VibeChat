import { MessageCircleCode } from 'lucide-react'

import config from '../config'

/** Shown while the session is being restored, before any route renders. */
export default function FullScreenLoader({ label = 'Loading' }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <div className="relative">
        <span className="absolute inset-0 animate-ping rounded-2xl bg-primary/20" />
        <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <MessageCircleCode className="h-7 w-7 text-primary" aria-hidden />
        </span>
      </div>
      <div className="text-center">
        <p className="font-poppins text-lg font-bold text-foreground">{config.appName}</p>
        <p className="mt-1 text-sm text-muted-foreground" role="status">
          {label}…
        </p>
      </div>
    </div>
  )
}
