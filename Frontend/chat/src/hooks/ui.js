/** Small UI hooks shared across screens. */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

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

/** Matches the transition-duration of the .theme-transition rule in index.css. */
const THEME_FADE_MS = 180

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
let themeFadeTimer = null

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

/**
 * Applies the theme for as long as the calling component is mounted, then clears it.
 *
 * Mounted inside the authenticated area only, so the toggle governs the app and not
 * the public pages: the landing screen pins its own palette, and sign-in should not
 * inherit a dark theme chosen by whoever used this browser last.
 */
export function useScopedTheme() {
  useTheme()
  useEffect(() => restorePublicTheme, [])
}

/** Dark/light theme, persisted, defaulting to the OS preference. */
export function useTheme() {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    () => currentTheme,
    () => 'dark',
  )

  // Reflect the stored value onto <html> on first mount, so a screen with no toggle
  // still renders in the saved theme. Re-reads storage rather than trusting the
  // value captured at module load, which would be stale if another tab changed the
  // theme after this bundle was evaluated.
  useEffect(() => {
    const stored = readStoredTheme()
    if (stored !== currentTheme) setThemeValue(stored)
    else applyTheme(stored)
  }, [])

  /**
   * Cross-fade the whole document for the duration of the switch. The class is added
   * before the theme flips and removed once the fade completes, so the cost is paid
   * only while toggling — a permanent global transition rule would tax every hover
   * and repaint in the app. Skipped when the viewer has asked for reduced motion.
   */
  const toggle = useCallback(() => {
    const root = document.documentElement
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      root.classList.add('theme-transition')
      // Flush style before the colours change. Adding the class and flipping `.dark`
      // in one tick leaves the browser free to collapse both into a single style
      // pass, in which case there is no "before" value to interpolate from and the
      // colours jump instead of fading. Reading a layout property forces the
      // intermediate state to be committed.
      void root.offsetWidth
      if (themeFadeTimer) clearTimeout(themeFadeTimer)
      themeFadeTimer = setTimeout(() => {
        root.classList.remove('theme-transition')
        themeFadeTimer = null
      }, THEME_FADE_MS)
    }
    setThemeValue(currentTheme === 'dark' ? 'light' : 'dark')
  }, [])

  const setTheme = useCallback((next) => setThemeValue(next), [])

  return { theme, setTheme, toggle, isDark: theme === 'dark' }
}
