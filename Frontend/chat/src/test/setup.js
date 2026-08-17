import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup, configure } from '@testing-library/react'

// The default 1s is tight once the suite mounts the whole app dozens of times; a
// loaded machine then fails on timing rather than on behaviour.
configure({ asyncUtilTimeout: 3000 })

afterEach(() => {
  cleanup()
  localStorage.clear()
  setViewport(1280)
  // The theme is applied to <html>, which RTL's cleanup does not touch — so a test
  // that exercises theming would otherwise leak into every test after it.
  document.documentElement.classList.remove('dark')
  document.documentElement.style.colorScheme = ''
})

// jsdom implements neither of these, and both are used by the chat UI.
class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)

/**
 * jsdom has no matchMedia, and both the theme hook and the responsive layout call
 * it. Rather than hardcoding "always desktop" — which left every mobile code path
 * untested — this evaluates `min-width` queries against a settable viewport width.
 */
let viewportWidth = 1280

export const setViewport = (width) => {
  viewportWidth = width
}

vi.stubGlobal('matchMedia', (query) => {
  const minWidth = /min-width:\s*(\d+)px/.exec(query)
  const matches = minWidth
    ? viewportWidth >= Number(minWidth[1])
    : // Colour-scheme and other feature queries: report the default.
      false
  return {
    matches,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }
})

// Element.prototype.scrollIntoView is missing in jsdom.
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || function scrollIntoView() {}

/** Minimal WebSocket stand-in so RealtimeProvider can construct a socket. */
class MockWebSocket {
  static OPEN = 1
  static CONNECTING = 0
  static instances = []

  constructor(url) {
    this.url = url
    this.readyState = MockWebSocket.CONNECTING
    MockWebSocket.instances.push(this)
  }

  send() {}
  close() {
    this.readyState = 3
    this.onclose?.({ code: 1000 })
  }

  /** Test helper: complete the handshake and deliver a frame. */
  open() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.()
  }

  emit(payload) {
    this.onmessage?.({ data: JSON.stringify(payload) })
  }
}
MockWebSocket.CLOSED = 3
vi.stubGlobal('WebSocket', MockWebSocket)
