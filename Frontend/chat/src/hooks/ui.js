/** Small UI hooks shared across screens. */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

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

/** Dark/light theme, persisted, defaulting to the OS preference. */
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'dark'
    const stored = window.localStorage.getItem('theme')
    if (stored === 'dark' || stored === 'light') return stored
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.style.colorScheme = theme
    try {
      window.localStorage.setItem('theme', theme)
    } catch {
      /* storage unavailable */
    }
  }, [theme])

  const toggle = useCallback(() => setTheme((current) => (current === 'dark' ? 'light' : 'dark')), [])

  return { theme, setTheme, toggle, isDark: theme === 'dark' }
}
