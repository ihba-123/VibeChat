import { motion } from 'framer-motion'
import { MessageCircleCode } from 'lucide-react'
import { Link } from 'react-router-dom'

import config from '../../config'
import ChatPreview from '../landing/ChatPreview'

/**
 * Shared frame for the sign-in, sign-up and password-reset screens.
 *
 * Split composition: a branded poster on the left, the form on the right.
 *
 * The whole screen is pinned dark — the root carries `dark`, which scopes the app's
 * own dark token set to this subtree. That is the same ground the landing page
 * paints, so moving from `/` into sign-in is continuous rather than a jump from a
 * dark marketing page to a pale form. It also means the public screens no longer
 * depend on a theme preference at all: the toggle governs the signed-in app only.
 *
 * The poster is dropped below `lg` rather than stacked. Stacking would push the
 * form below the fold on a phone, putting decoration in front of the only thing the
 * screen exists to do; the brand mark moves inline above the card instead.
 *
 * The poster carries the product visual and nothing else — no headline, no marketing
 * copy. The words on this screen belong to the form; a second competing headline
 * beside it only splits attention on a page with one job.
 *
 * `scene` picks which conversation the preview shows, so sign-in and sign-up are not
 * the same still image twice over.
 *
 * No theme switch here — the app already applies the saved (or OS) theme on every
 * route, so offering the control on the way in was chrome the screen did not need.
 */
export default function AuthLayout({ title, subtitle, children, footer, scene = 'inbox' }) {
  const brand = (
    <Link
      to="/"
      className="group flex items-center gap-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
        <MessageCircleCode className="icon-lg" />
      </span>
      <span className="text-lg font-bold text-foreground group-hover:text-primary">
        {config.appName}
      </span>
    </Link>
  )

  return (
    <div className="dark relative flex min-h-dvh overflow-hidden bg-background text-foreground">
      {/* ---------------------------------------------------------- poster */}
      <aside className="relative hidden w-1/2 shrink-0 flex-col overflow-hidden p-10 lg:flex xl:w-[55%]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="landing-grid absolute inset-0 opacity-40" />
          <div
            className="absolute -left-24 top-0 h-[38rem] w-[38rem] rounded-full blur-3xl"
            style={{ background: 'radial-gradient(closest-side, var(--app-wash-1), transparent)' }}
          />
          <div
            className="absolute -bottom-32 right-0 h-[28rem] w-[28rem] rounded-full blur-3xl"
            style={{ background: 'radial-gradient(closest-side, var(--app-wash-2), transparent)' }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_40%_40%,transparent,var(--background))]" />
        </div>

        <div className="relative z-10">{brand}</div>

        {/* Image only. Tilted off-axis and run past the panel edge so it reads as a
            product sitting behind the page rather than a screenshot centred in a box;
            `overflow-hidden` on the panel is what crops it into the composition. */}
        <div className="relative z-10 flex min-h-0 flex-1 items-center">
          <div className="h-[clamp(17rem,52vh,27rem)] w-[112%] min-h-0 -rotate-3">
            <ChatPreview scene={scene} />
          </div>
        </div>
      </aside>

      {/* The seam between poster and form: one hairline, tilted to echo the preview.
          Over-extended vertically because rotating a full-height line otherwise
          leaves a wedge of gap at each end. Lives on the shared parent, since it
          belongs to neither side. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-y-1/4 left-1/2 hidden w-px rotate-6 bg-gradient-to-b from-transparent via-border to-transparent lg:block xl:left-[55%]"
      />

      {/* ------------------------------------------------------------ form */}
      <div className="relative flex min-h-dvh w-full flex-col lg:w-1/2 xl:w-[45%]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden"
        >
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-40 -right-24 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
        </div>

        {/* Brand only where the poster is not already carrying it. */}
        <header className="relative z-10 flex items-center px-5 py-5 lg:hidden">{brand}</header>

        <main className="relative z-10 flex flex-1 items-center justify-center px-5 pb-12 lg:px-8 lg:py-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-full max-w-md"
          >
            <div className="glass-strong rounded-2xl border p-6 shadow-xl sm:p-8">
              <h1 className="text-2xl font-bold text-card-foreground">{title}</h1>
              {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
              <div className="mt-6">{children}</div>
            </div>
            {footer && (
              <div className="mt-5 text-center text-sm text-muted-foreground">{footer}</div>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  )
}
