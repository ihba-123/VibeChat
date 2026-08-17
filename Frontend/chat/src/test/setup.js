import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  localStorage.clear()
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

// jsdom has no matchMedia at all, and both the theme hook and the responsive
// layout call it. Reported as a wide viewport so the desktop layout is exercised.
vi.stubGlobal('matchMedia', (query) => ({
  matches: query.includes('min-width'),
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
}))

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
