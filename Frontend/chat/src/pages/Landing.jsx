import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, ChevronDown, MessageCircleCode } from 'lucide-react'
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
 * 1. One viewport, no scroll. The page is an `app-viewport` column — navbar
 *    `shrink-0`, hero `flex-1 min-h-0` — so the hero absorbs whatever height is left
 *    instead of the content deciding the page height. `dvh` and not `vh` because
 *    mobile browsers report `100vh` as the height with the address bar *expanded*,
 *    which is taller than the visible area and scrolls by exactly the toolbar.
 *    `app-viewport` rather than a bare `h-dvh` for the `@supports` fallback: the
 *    minifier collapses stacked `height` declarations, so a browser that does not
 *    know `dvh` was left at `height: auto` — the page then grew past the viewport and
 *    scrolled, which is the one thing this layout exists to prevent. `min-h-0` on the
 *    hero is what lets the product preview shrink on short screens rather than
 *    pushing the page past the fold; without it a flex child refuses to go below its
 *    content size and 1366×768 overflows.
 *
 * 2. Dark-first, without touching the app's theme. The root carries `dark`, so the
 *    palette below is the application's own dark token set — the same values the
 *    real chat UI uses — scoped to this subtree. Nothing is written to localStorage
 *    and `useTheme` is untouched, so a visitor who prefers light still gets a light
 *    app the moment they sign in.
 *
 * 3. Phones get their own composition, not a narrowed desktop one. Everything
 *    mobile-specific is written with the `max-sm:` variant (< 640px) so the tablet
 *    and desktop layouts below are reached by exactly the classes they always were.
 *
 *    Rule 1 is a desktop rule, and below `sm` it is deliberately suspended. Side by
 *    side, the copy and the product preview are one composition; stacked into a
 *    phone they are two, and forcing both into one viewport is what made every
 *    element fight the others for height — a 24px headline over a 195px chat card,
 *    each cramped, neither the subject. So a phone gets two screens that snap, and
 *    each is free to be as open as it wants because it is no longer paying for the
 *    other.
 *
 *    Screen one is the pitch and its call to action, screen two is the product.
 *    The header is sticky across both, so Get Started is one tap away from wherever
 *    the visitor has scrolled to rather than something to scroll back for, and a cue
 *    at the foot of screen one advertises that there is a screen two at all.
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
    <div className="dark app-viewport relative flex flex-col overflow-hidden bg-background text-foreground max-sm:snap-y max-sm:snap-mandatory max-sm:overflow-y-auto">
      {/* Background. Fixed behind everything, never interactive, and deliberately
          low-contrast so the product preview stays the brightest thing on screen. */}
      {/* `fixed` on a phone: this is the page's backdrop, and the root is the
          scroll container there — left `absolute` it would scroll away with the
          first screen and leave the second one on flat background. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden max-sm:fixed"
      >
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

      {/* Sticky on a phone, because there are two screens to cross and Get Started
          should never be a scroll away. It is a direct child of the scroll container,
          which is what lets `sticky` work at all. The blur is the only reason it can
          be translucent over a moving product preview and stay legible.

          `pt-[env(safe-area-inset-top)]`: the page is served with `viewport-fit=cover`,
          so on a notched device the first pixels would otherwise sit under the
          status bar. */}
      <header className="relative z-10 shrink-0 max-sm:sticky max-sm:top-0 max-sm:z-30 max-sm:border-b max-sm:border-border/50 max-sm:bg-background/80 max-sm:pt-[env(safe-area-inset-top)] max-sm:backdrop-blur-xl">
        <nav
          aria-label="Main"
          className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-5 max-sm:h-14 max-sm:gap-2 max-sm:px-4 sm:px-8"
        >
          {/* `min-w-0` + `truncate`: at 320px the brand, Login and Get Started only
              just fit, and the brand is the one that may give ground. */}
          <a
            href="/"
            className="flex min-w-0 items-center gap-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <MessageCircleCode className="icon-md" />
            </span>
            <span className="truncate text-[15px] font-bold tracking-tight max-sm:text-[14.5px]">
              {config.appName}
            </span>
          </a>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
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

            {/* 40px tall on a phone rather than the 32px `sm` size: a header
                control is the first thing a thumb reaches for, and 32px is below
                any reasonable touch target. The padding comes down to compensate,
                so the pair is taller *and* narrower than it was. */}
            <Button
              variant="ghost"
              size="sm"
              className="max-sm:h-10 max-sm:px-2.5 max-sm:text-[13.5px]"
              onClick={() => navigate('/login')}
            >
              Login
            </Button>
            <Button
              size="sm"
              className="max-sm:h-10 max-sm:px-3.5 max-sm:text-[13.5px]"
              onClick={() => navigate('/register')}
            >
              Get Started
            </Button>
          </div>
        </nav>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 items-center max-sm:block max-sm:flex-none">
        {/* On a phone this stops being a fixed-height column and becomes the page
              itself: `h-auto`, no vertical padding and no gap, because the two
              sections inside it are each a screen and own their own spacing. */}
          <div className="mx-auto flex h-full w-full max-w-7xl min-h-0 flex-col gap-5 px-5 pb-6 pt-7 max-sm:h-auto max-sm:min-h-0 max-sm:gap-0 max-sm:px-4 max-sm:pb-0 max-sm:pt-0 sm:gap-6 sm:px-8 sm:pt-9 lg:flex-row lg:items-center lg:gap-10 lg:pb-10 lg:pt-0">
          {/* Copy. Centred on the single-column composition, left-aligned once the
              product visual sits beside it. */}
          {/* Screen one on a phone, the left-hand column everywhere else. `min-h`
              and not `h`, so a long translation grows the section rather than being
              clipped by it; `justify-center` then keeps the pitch optically centred
              in whatever height that turns out to be. `scroll-mt-14` is the sticky
              header's height — without it the snap position parks the headline
              underneath the header. */}
          <div
            id="pitch"
            className="min-w-0 shrink-0 text-center max-sm:order-1 max-sm:flex max-sm:min-h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] max-sm:snap-start max-sm:scroll-mt-14 max-sm:flex-col max-sm:justify-center max-sm:pb-6 lg:w-[45%] lg:shrink lg:text-left"
          >
            <motion.h1
              {...enter(0.05)}
              className="text-balance font-bold leading-[1.08] tracking-tight text-[clamp(1.6rem,6.4vw,4.25rem)] max-sm:text-[clamp(1.5rem,7.6vw,2.375rem)] max-sm:leading-[1.12] lg:text-[clamp(2.4rem,3.9vw,4.25rem)]"
            >
              {/* The break is no longer `hidden sm:block`. Left to wrap on its own a
                  phone broke the line wherever it ran out of room — most often
                  mid-clause, with the blue span orphaned across two lines. Two
                  deliberate lines read as typesetting; `text-balance` still evens
                  them out, and the clamp is sized so "Stay in the moment." fits one
                  line at 320px. */}
              Chat. Connect.
              <br />{' '}
              <span className="text-primary">Stay in the moment.</span>
            </motion.h1>

            <motion.p
              {...enter(0.12)}
              className="mx-auto mt-2.5 max-w-md text-pretty text-[clamp(0.875rem,3.4vw,1.2rem)] leading-relaxed text-muted-foreground max-sm:mt-2 max-sm:max-w-[36ch] max-sm:text-[14.5px] max-sm:leading-[1.55] sm:mt-4 lg:mx-0 lg:mt-5 lg:text-[clamp(1rem,1.1vw,1.2rem)]"
            >
              Simple, fast and private messaging built for conversations that matter.
            </motion.p>

            <motion.div
              {...enter(0.19)}
              className="mt-4 flex flex-col items-stretch gap-2.5 max-sm:mt-3.5 max-sm:items-center max-sm:gap-2 sm:mt-6 sm:flex-row sm:items-center sm:justify-center lg:justify-start"
            >
              {/* The two are the same size everywhere except on a phone, where the
                  hierarchy has to be readable at a glance: the primary grows to a
                  48px thumb target and picks up a coloured lift, and the secondary
                  drops its outline for a flat tint one step off the background. Two
                  equally-weighted full-width buttons stacked on a phone read as a
                  choice; this reads as an action with an alternative.

                  They are also sized rather than stretched. `items-stretch` ran them
                  edge to edge, which on a 430px screen is a 398px button — wide
                  enough to read as a banner rather than something to press, and it
                  changed width on every device. `min()` pins them to one deliberate
                  width and still yields on the narrowest phones. */}
              <Button
                size="lg"
                className="group max-sm:h-12 max-sm:w-[min(17rem,100%)] max-sm:text-[15px] max-sm:font-semibold max-sm:shadow-lg max-sm:shadow-primary/25 sm:px-7"
                onClick={() => navigate('/register')}
              >
                Start Chatting
                <ArrowRight className="icon-sm transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="max-sm:h-11 max-sm:w-[min(17rem,100%)] max-sm:border-transparent max-sm:bg-muted/50 max-sm:text-[14.5px] max-sm:text-muted-foreground sm:px-7"
                onClick={() => setDialog('features')}
              >
                Explore {config.appName}
              </Button>
            </motion.div>

            <motion.p
              {...enter(0.26)}
              className="mt-3 text-[11.5px] text-muted-foreground/80 max-sm:mt-2.5 max-sm:text-[11px] sm:mt-5 sm:text-[12.5px]"
            >
              Real-time messaging <span aria-hidden="true">•</span> File sharing{' '}
              <span aria-hidden="true">•</span> Instant notifications
            </motion.p>

            {/* Phone only. A screen that fills the viewport and ends cleanly reads as
                the whole page, so the second one has to be advertised. A real anchor
                rather than a scripted scroll: it works before hydration and lands on
                the section's own snap position. */}
            <motion.a
              {...enter(0.33)}
              href="#product"
              className="mx-auto mt-8 hidden items-center gap-1.5 rounded-full border border-border/70 bg-card/40 py-2 pl-4 pr-3 text-[12px] font-medium text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:inline-flex"
            >
              See it in action
              <ChevronDown className="icon-sm" aria-hidden="true" />
            </motion.a>
          </div>

          {/* Screen two on a phone, the right-hand column everywhere else. A phone
              gets a caption above it because, arriving here by scroll, the card has
              to say what it is — on desktop the headline is still on screen beside
              it and does that job. */}
          <motion.div
            {...(reduceMotion
              ? {}
              : {
                  initial: { opacity: 0, y: 28 },
                  animate: { opacity: 1, y: 0 },
                  transition: { duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] },
                })}
            id="product"
            className="relative flex min-h-0 flex-1 flex-col max-sm:order-2 max-sm:min-h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] max-sm:snap-start max-sm:scroll-mt-14 max-sm:flex-none max-sm:justify-center max-sm:pb-[max(1.5rem,env(safe-area-inset-bottom))] max-sm:pt-2 lg:w-[55%] lg:flex-none"
          >
            <div className="mb-3.5 hidden text-center max-sm:block">
              <p className="text-[17px] font-bold tracking-tight text-foreground">
                Built for real conversations
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Live messages, presence and typing — exactly as in the app.
              </p>
            </div>

            {/* Glow shelf under the card, which is what stops it reading as a
                screenshot dropped onto the background. */}
            <div
              aria-hidden="true"
              className="absolute -inset-6 rounded-[2rem] bg-primary/10 blur-2xl max-sm:-inset-3"
            />

            {/* Phone: a height chosen for the card rather than whatever the copy
                left over. That leftover is what the old `max-h-[42vh]` cap was
                rationing, and on a 320×568 screen it rationed the card down to 195px
                — short enough that the message column clipped a bubble in half. With
                its own screen the card is sized against the viewport like the desktop
                one, floored so it stays legible and capped so it does not stretch
                into a slab on a tall phone. */}
            <div className="relative max-h-[42vh] min-h-[12rem] flex-1 max-sm:h-[min(58vh,32rem)] max-sm:max-h-none max-sm:min-h-[14rem] max-sm:flex-none lg:max-h-none lg:h-[clamp(19rem,58vh,30rem)] lg:flex-none">
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
