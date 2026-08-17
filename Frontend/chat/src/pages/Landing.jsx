import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, MessageCircleCode } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import ChatPreview from '../components/landing/ChatPreview'
import { Button, Modal } from '../components/ui'
import config from '../config'

/**
 * The public landing screen.
 *
 * Two structural rules drive everything here.
 *
 * 1. One viewport, no scroll. The page is a `h-dvh` column — navbar `shrink-0`, hero
 *    `flex-1 min-h-0` — so the hero absorbs whatever height is left instead of the
 *    content deciding the page height. `dvh` and not `vh` because mobile browsers
 *    report `100vh` as the height with the address bar *expanded*, which is taller
 *    than the visible area and scrolls by exactly the toolbar. `min-h-0` on the hero
 *    is what lets the product preview shrink on short screens rather than pushing
 *    the page past the fold; without it a flex child refuses to go below its content
 *    size and 1366×768 overflows.
 *
 * 2. Dark-first, without touching the app's theme. The root carries `dark`, so the
 *    palette below is the application's own dark token set — the same values the
 *    real chat UI uses — scoped to this subtree. Nothing is written to localStorage
 *    and `useTheme` is untouched, so a visitor who prefers light still gets a light
 *    app the moment they sign in.
 *
 * `Features` and `About` open dialogs rather than routing. There is no /features or
 * /about route, and inventing one would be a dead link; there is also nothing below
 * the fold to scroll them to. The existing accessible Modal already handles focus
 * and Escape, so it is reused rather than reimplemented.
 */

const FEATURES = [
  ['Real-time messaging', 'Messages arrive over a live socket — no refreshing, no polling.'],
  ['File and photo sharing', 'Send documents and images straight into the conversation.'],
  ['Presence and typing', 'See who is online and when someone is replying.'],
  ['Encrypted at rest', 'Message content is encrypted in the database, not just in transit.'],
]

export default function Landing() {
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const [dialog, setDialog] = useState(null)

  // One entrance, staggered by index. Disabled outright under reduced motion rather
  // than shortened — the animation carries no information.
  const enter = (delay) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] },
        }

  return (
    <div className="dark relative flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      {/* Background. Fixed behind everything, never interactive, and deliberately
          low-contrast so the product preview stays the brightest thing on screen. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="landing-grid absolute inset-0 opacity-40" />
        <div
          className="absolute left-1/2 top-0 h-[45rem] w-[70rem] -translate-x-1/2 -translate-y-1/3 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(closest-side, var(--app-wash-1), transparent)' }}
        />
        <div
          className="absolute -right-40 bottom-0 h-[32rem] w-[32rem] rounded-full blur-3xl"
          style={{ background: 'radial-gradient(closest-side, var(--app-wash-2), transparent)' }}
        />
        {/* Darkened edges, so the centre reads as lit. */}
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_35%,transparent,var(--background))]" />
      </div>

      <header className="relative z-10 shrink-0">
        <nav
          aria-label="Main"
          className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-5 sm:px-8"
        >
          <a
            href="/"
            className="flex items-center gap-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <MessageCircleCode className="icon-md" />
            </span>
            <span className="text-[15px] font-bold tracking-tight">{config.appName}</span>
          </a>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setDialog('features')}
              className="hidden rounded-lg px-3 py-2 text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:block"
            >
              Features
            </button>
            <button
              type="button"
              onClick={() => setDialog('about')}
              className="hidden rounded-lg px-3 py-2 text-[14px] font-medium text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:block"
            >
              About
            </button>

            <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
              Login
            </Button>
            <Button size="sm" onClick={() => navigate('/register')}>
              Get Started
            </Button>
          </div>
        </nav>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 items-center">
        <div className="mx-auto flex h-full w-full max-w-7xl min-h-0 flex-col gap-5 px-5 pb-6 pt-7 sm:gap-6 sm:px-8 sm:pt-9 lg:flex-row lg:items-center lg:gap-10 lg:pb-10 lg:pt-0">
          {/* Copy. Centred on the single-column composition, left-aligned once the
              product visual sits beside it. */}
          <div className="min-w-0 shrink-0 text-center lg:w-[45%] lg:shrink lg:text-left">
            <motion.h1
              {...enter(0.05)}
              className="text-balance font-bold leading-[1.08] tracking-tight text-[clamp(1.6rem,6.4vw,4.25rem)] lg:text-[clamp(2.4rem,3.9vw,4.25rem)]"
            >
              Chat. Connect.
              <br className="hidden sm:block" />{' '}
              <span className="text-primary">Stay in the moment.</span>
            </motion.h1>

            <motion.p
              {...enter(0.12)}
              className="mx-auto mt-2.5 max-w-md text-pretty text-[clamp(0.875rem,3.4vw,1.2rem)] leading-relaxed text-muted-foreground sm:mt-4 lg:mx-0 lg:mt-5 lg:text-[clamp(1rem,1.1vw,1.2rem)]"
            >
              Simple, fast and private messaging built for conversations that matter.
            </motion.p>

            <motion.div
              {...enter(0.19)}
              className="mt-4 flex flex-col items-stretch gap-2.5 sm:mt-6 sm:flex-row sm:items-center sm:justify-center lg:justify-start"
            >
              <Button
                size="lg"
                className="group sm:px-7"
                onClick={() => navigate('/register')}
              >
                Start Chatting
                <ArrowRight className="icon-sm transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="sm:px-7"
                onClick={() => setDialog('features')}
              >
                Explore {config.appName}
              </Button>
            </motion.div>

            <motion.p
              {...enter(0.26)}
              className="mt-3 text-[11.5px] text-muted-foreground/80 sm:mt-5 sm:text-[12.5px]"
            >
              Real-time messaging <span aria-hidden="true">•</span> File sharing{' '}
              <span aria-hidden="true">•</span> Instant notifications
            </motion.p>
          </div>

          {/* Product visual. Hidden below sm, where a legible chat card and the copy
              cannot both fit one viewport — the copy and CTA win. */}
          <motion.div
            {...(reduceMotion
              ? {}
              : {
                  initial: { opacity: 0, y: 28 },
                  animate: { opacity: 1, y: 0 },
                  transition: { duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] },
                })}
            className="relative flex min-h-0 flex-1 flex-col lg:w-[55%] lg:flex-none"
          >
            {/* Glow shelf under the card, which is what stops it reading as a
                screenshot dropped onto the background. */}
            <div
              aria-hidden="true"
              className="absolute -inset-6 rounded-[2rem] bg-primary/10 blur-2xl"
            />

            {/* Mobile: fills the remaining column, floored so it never collapses to
                an unreadable sliver. Desktop: sized against the viewport instead, so
                the composition keeps its 45/55 balance. */}
            <div className="relative max-h-[42vh] min-h-[12rem] flex-1 lg:max-h-none lg:h-[clamp(19rem,58vh,30rem)] lg:flex-none">
              <ChatPreview />
            </div>

            <span className="pointer-events-none absolute -left-3 top-8 hidden items-center gap-1.5 rounded-full border border-border bg-card/90 px-2.5 py-1 text-[11px] font-medium shadow-lg backdrop-blur-sm xl:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              3 new messages
            </span>
            <span className="pointer-events-none absolute -bottom-3 right-6 hidden items-center gap-1.5 rounded-full border border-border bg-card/90 px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-lg backdrop-blur-sm xl:inline-flex">
              Message delivered
            </span>
          </motion.div>
        </div>
      </main>

      <Modal
        open={dialog === 'features'}
        onClose={() => setDialog(null)}
        title={`What ${config.appName} does`}
        description="Everything below is in the product today."
      >
        <ul className="space-y-4">
          {FEATURES.map(([title, body]) => (
            <li key={title}>
              <p className="text-sm font-semibold text-card-foreground">{title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal
        open={dialog === 'about'}
        onClose={() => setDialog(null)}
        title={`About ${config.appName}`}
      >
        <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            {config.appName} is a real-time messaging app: a Django Channels backend over
            WebSockets, and a React client that keeps conversations in sync as they happen.
          </p>
          <p>
            Messages are encrypted at rest, sessions use short-lived access tokens with an
            HttpOnly refresh cookie, and the whole interface is built to stay responsive
            from a phone to a wide desktop.
          </p>
        </div>
      </Modal>
    </div>
  )
}
