import config from '../config'

/**
 * The startup splash: an animated "V" and nothing else.
 *
 * The mark is a single stroked path rather than a glyph, so it is not at the mercy
 * of whether the webfont has arrived — which, on the very screen that shows while
 * the app is still loading, is exactly when it has not. Geometry lives in a fixed
 * `viewBox`, so the proportions hold at every size and only the box scales.
 *
 * Three layers, painted back to front:
 *   1. a soft radial glow that expands and fades,
 *   2. the resting stroke, dim, so the shape is always legible,
 *   3. the traced stroke, a short dash of light travelling the path.
 *
 * Colour comes from `text-primary`, and every layer paints with `currentColor`, so
 * the mark follows the brand token instead of carrying a hex of its own.
 *
 * `surface` decides the ground, and the default is deliberate:
 *
 *  - `'public'` pins the landing page's dark ground. The theme preference belongs
 *    to the signed-in app, so outside it there is nothing to follow — and falling
 *    through to the base tokens rendered this screen white, which is what made a
 *    refresh flash white before a dark page.
 *  - `'app'` follows whatever theme the signed-in app has applied, so restoring a
 *    session does not put a dark splash in front of a light app.
 *
 * `label` is still announced, just never drawn. Removing the visible caption is a
 * visual decision; leaving a screen-reader user with an unlabelled, silent screen
 * would be a different thing entirely, so it stays as a live status.
 */
export default function FullScreenLoader({ label = 'Loading', surface = 'public' }) {
  return (
    <div
      className={`flex min-h-dvh items-center justify-center bg-background text-foreground ${
        surface === 'public' ? 'dark' : ''
      }`}
    >
      <div className="relative flex items-center justify-center text-primary">
        {/* Glow. Sized against the mark and centred on it, so it stays put as the
            mark scales; `pointer-events-none` since it is pure decoration. */}
        <span
          aria-hidden="true"
          className="vibe-mark-glow pointer-events-none absolute h-[180%] w-[180%] rounded-full blur-2xl"
          style={{
            background: 'radial-gradient(closest-side, currentColor, transparent)',
          }}
        />

        <span className="vibe-mark-breathe relative block w-[clamp(4.5rem,14vw,7rem)]">
          <svg
            viewBox="0 0 100 100"
            fill="none"
            className="block h-auto w-full overflow-visible"
            role="img"
            aria-label={config.appName}
          >
            {/* Resting stroke: the mark never disappears between traces. */}
            <path
              d="M24 26 L50 74 L76 26"
              stroke="currentColor"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.16"
            />

            {/* Travelling light. `pathLength="1"` normalises the stroke so the dash
                pattern in CSS sums to exactly one length and the loop is seamless. */}
            <path
              className="vibe-mark-trace"
              d="M24 26 L50 74 L76 26"
              pathLength="1"
              stroke="currentColor"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>

      <p className="sr-only" role="status">
        {config.appName} — {label}
      </p>
    </div>
  )
}
