/** Small UI hooks shared across screens. */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { flushSync } from 'react-dom'

import config from '../config'

/** Delays a fast-changing value — used to keep search from firing per keystroke. */
export function useDebouncedValue(value, delay = config.searchDebounceMs) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  )

  useEffect(() => {
    const list = window.matchMedia(query)
    const onChange = (event) => setMatches(event.matches)
    setMatches(list.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** True on viewports wide enough to show the sidebar and a conversation together. */
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)')

export function useOnClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) return
      handler(event)
    }
    document.addEventListener('mousedown', listener)
    document.addEventListener('touchstart', listener)
    return () => {
      document.removeEventListener('mousedown', listener)
      document.removeEventListener('touchstart', listener)
    }
  }, [ref, handler])
}

/** Grows a textarea with its content, up to a cap. */
export function useAutoResize(value, { maxHeight = 160 } = {}) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`
    element.style.overflowY = element.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [value, maxHeight])

  return ref
}

/** Fires when a sentinel scrolls into view — drives infinite lists. */
export function useIntersection(onIntersect, { enabled = true, rootMargin = '200px' } = {}) {
  const ref = useRef(null)
  const callback = useRef(onIntersect)
  callback.current = onIntersect

  useEffect(() => {
    const element = ref.current
    if (!element || !enabled) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) callback.current?.()
      },
      { rootMargin },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [enabled, rootMargin])

  return ref
}


/**
 * Theme is a single module-level store, not per-hook state.
 *
 * Every `useTheme()` call used to own an independent `useState`, so the rail toggle
 * and the mobile toggle held separate copies: flipping one left the other showing a
 * stale icon and computing its next toggle from the wrong value, which read as the
 * theme changing twice or bouncing back. `useSyncExternalStore` gives every caller
 * the same value and one re-render per change.
 */
const readStoredTheme = () => {
  if (typeof window === 'undefined') return 'dark'
  const stored = window.localStorage.getItem('theme')
  if (stored === 'dark' || stored === 'light') return stored
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

let currentTheme = readStoredTheme()
const themeListeners = new Set()
// A nesting counter, not a boolean: a toggle fired while another is still fading must
// not lift the previous one's transition suppression early.
let themeChangeDepth = 0

const applyTheme = (theme) => {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme
  // Hands the ground back to the stylesheet. The boot script in index.html sets an
  // inline background so the very first paint is not the browser's white canvas;
  // inline styles outrank the sheet, so leaving it there would pin that colour for
  // the rest of the session and a light theme would keep a dark <html> behind it.
  root.style.backgroundColor = ''
  try {
    window.localStorage.setItem('theme', theme)
  } catch {
    /* storage unavailable */
  }
}

const setThemeValue = (next) => {
  if (next === currentTheme) return
  currentTheme = next
  applyTheme(next)
  themeListeners.forEach((listener) => listener())
}

const subscribeToTheme = (listener) => {
  themeListeners.add(listener)
  return () => themeListeners.delete(listener)
}

/**
 * Returns the document to the public ground when leaving the signed-in app.
 *
 * Not "remove the dark class" — that would drop to the base light palette, and every
 * public screen (landing, sign-in, sign-up, 404, the splash) is dark. Removing it
 * put a light document behind pages that pin their own dark surface, which showed as
 * pale edges during navigation and a white flash on the way out of the app.
 *
 * The stored preference is deliberately untouched: this reverts what is *painted*,
 * not what the user chose, so signing back in restores their theme rather than
 * silently resetting it on every sign-out.
 */
export const restorePublicTheme = () => {
  const root = document.documentElement
  root.classList.add('dark')
  root.style.colorScheme = 'dark'
  root.style.backgroundColor = ''
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * How a theme change is painted.
 *
 * The switch itself is one class on <html>, so the expensive part was never the
 * state change — it was how the repaint was staged. Three things used to make it
 * crawl, and every one of them got worse the more of the app was on screen, which is
 * why it felt fine on the auth screens and laggy on a full conversation:
 *
 *  1. A `html.theme-transition *` rule started a CSS transition on *every element in
 *     the document*. Each one animated its own colours on its own clock, so the page
 *     did not change theme — it was filled in, panel by panel, in whatever order the
 *     browser got to them. That is the "fill spreading from individual views".
 *  2. Every frame of those transitions repainted the glass chrome, and each repaint
 *     re-ran its `backdrop-filter` blur — the most expensive thing on the page, and
 *     it was being recomputed for the whole duration of the switch, per panel.
 *  3. `useScopedTheme()` (see below) re-rendered the entire authenticated tree.
 *
 * What replaces it: one view transition. The browser snapshots the viewport, the
 * theme flips in a single style pass with no element-level animation at all, and the
 * two snapshots cross-fade on the compositor. Nothing repaints during the fade, no
 * blur is recomputed, and because it is one full-viewport image there is no order for
 * anything to be filled in — every breakpoint gets the identical crossfade.
 */
const runThemeChange = (next) => {
  if (next === currentTheme) return

  const root = document.documentElement

  // Element-level transitions are suppressed for the whole flip. Under a view
  // transition the incoming snapshot is live, so leaving them on would have every
  // button easing its own colours *inside* the crossfade — two animations over the
  // same pixels. On the fallback path it is what keeps the switch from staggering.
  themeChangeDepth += 1
  root.classList.add('theme-switching')

  const release = () => {
    themeChangeDepth -= 1
    if (themeChangeDepth === 0) root.classList.remove('theme-switching')
  }

  // React's re-render has to land inside the callback, otherwise the toggle glyph is
  // still the old one when the snapshot is taken and pops a frame after the fade.
  const commit = () => flushSync(() => setThemeValue(next))

  if (typeof document.startViewTransition !== 'function' || prefersReducedMotion()) {
    // No crossfade available, or none wanted: swap in a single frame. Instant is
    // never janky, and with transitions suppressed the whole page lands together
    // rather than some parts easing while the rest snaps.
    commit()
    requestAnimationFrame(() => requestAnimationFrame(release))
    return
  }

  const transition = document.startViewTransition(commit)
  // `.finished` rejects when a second toggle interrupts this one; either way the
  // suppression has to be lifted, and the depth counter keeps the interrupted and
  // the interrupting switch from fighting over the class.
  transition.finished.then(release, release)
}

/**
 * Puts the stored theme on <html> on mount. Shared by both hooks below, so the one
 * that does not subscribe still applies the theme.
 *
 * Re-reads storage rather than trusting the value captured at module load, which
 * would be stale if another tab changed the theme after this bundle was evaluated.
 */
function useAppliedTheme() {
  useEffect(() => {
    const stored = readStoredTheme()
    if (stored !== currentTheme) setThemeValue(stored)
    else applyTheme(stored)
  }, [])
}

/**
 * Applies the theme for as long as the calling component is mounted, then clears it.
 *
 * Mounted inside the authenticated area only, so the toggle governs the app and not
 * the public pages: the landing screen pins its own palette, and sign-in should not
 * inherit a dark theme chosen by whoever used this browser last.
 *
 * Deliberately does *not* subscribe to the theme store. It used to call `useTheme()`,
 * and it is mounted at the root of the signed-in area — so every toggle re-rendered
 * the route guard, and with it AppShell, the conversation list and every message
 * bubble on screen. None of that markup depends on the theme: the palette is CSS
 * variables under a class on <html>, and the only component that renders differently
 * is the toggle's own glyph. Reading the value here bought nothing and cost a full
 * re-render of the app on every switch, on top of the repaint.
 */
export function useScopedTheme() {
  useAppliedTheme()
  useEffect(() => restorePublicTheme, [])
}

/** Dark/light theme, persisted, defaulting to the OS preference. */
export function useTheme() {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    () => currentTheme,
    () => 'dark',
  )

  useAppliedTheme()

  const toggle = useCallback(() => {
    runThemeChange(currentTheme === 'dark' ? 'light' : 'dark')
  }, [])

  const setTheme = useCallback((next) => runThemeChange(next), [])

  return { theme, setTheme, toggle, isDark: theme === 'dark' }
}
