/**
 * Reconnecting WebSocket for the multiplexed stream.
 *
 * One connection carries every conversation, plus presence, typing and
 * notifications, so the client holds a single socket no matter how many chats the
 * user has open.
 *
 * Deliberate behaviours:
 *  - Exponential backoff with jitter, so a server restart does not get hit by
 *    every client reconnecting on the same schedule.
 *  - Outbound frames queue while the socket is down and flush on reconnect, so a
 *    message typed during a blip is not silently dropped.
 *  - An application-level ping, because a half-open TCP connection can look alive
 *    to the browser indefinitely.
 *  - The token is read fresh on every attempt: a reconnect after an hour must use
 *    the refreshed access token, not the one captured at construction.
 */

import config from '../config'

const CLOSE_GOING_AWAY = 1000
const AUTH_FAILURE_CODES = new Set([4401, 4403])

export class ChatSocket {
  constructor({ url = config.wsUrl, getToken, onEvent, onStatusChange } = {}) {
    this.url = url
    this.getToken = getToken
    this.onEvent = onEvent ?? (() => {})
    this.onStatusChange = onStatusChange ?? (() => {})

    this.socket = null
    this.status = 'idle'
    this.attempt = 0
    this.queue = []
    this.reconnectTimer = null
    this.heartbeatTimer = null
    this.intentionallyClosed = false
  }

  setStatus(status, detail) {
    if (this.status === status) return
    this.status = status
    this.onStatusChange(status, detail)
  }

  connect() {
    this.intentionallyClosed = false
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return
    }

    const token = this.getToken?.()
    if (!token) {
      // Nothing to authenticate with yet; the provider retries once signed in.
      this.setStatus('idle')
      return
    }

    this.setStatus(this.attempt === 0 ? 'connecting' : 'reconnecting')

    const url = `${this.url}?token=${encodeURIComponent(token)}`
    let socket
    try {
      socket = new WebSocket(url)
    } catch {
      // A malformed URL or a blocked scheme; back off and try again.
      this.scheduleReconnect()
      return
    }
    this.socket = socket

    socket.onopen = () => {
      this.attempt = 0
      this.setStatus('open')
      this.startHeartbeat()
      this.flushQueue()
    }

    socket.onmessage = (event) => {
      let payload
      try {
        payload = JSON.parse(event.data)
      } catch {
        console.warn('Ignoring non-JSON frame', event.data)
        return
      }
      if (payload?.type === 'pong') return
      this.onEvent(payload)
    }

    socket.onerror = () => {
      // onclose always follows; reconnection is handled there so it happens once.
    }

    socket.onclose = (event) => {
      this.stopHeartbeat()
      this.socket = null

      if (this.intentionallyClosed || event.code === CLOSE_GOING_AWAY) {
        this.setStatus('closed')
        return
      }

      if (AUTH_FAILURE_CODES.has(event.code)) {
        // The token was rejected. Reconnecting with the same one would loop, so
        // hand control back to the provider, which refreshes and re-opens.
        this.setStatus('unauthorized', event.code)
        return
      }

      this.scheduleReconnect()
    }
  }

  scheduleReconnect() {
    if (this.intentionallyClosed || this.reconnectTimer) return

    this.attempt += 1
    const backoff = Math.min(
      config.wsReconnectBaseMs * 2 ** (this.attempt - 1),
      config.wsReconnectMaxMs,
    )
    // Jitter spreads a thundering herd of clients across the window.
    const delay = backoff / 2 + Math.random() * (backoff / 2)

    this.setStatus('reconnecting')
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  /** Force an immediate reconnect, e.g. after the access token was refreshed. */
  reconnectNow() {
    this.clearReconnectTimer()
    this.attempt = 0
    if (this.socket) {
      this.intentionallyClosed = true
      try {
        this.socket.close(CLOSE_GOING_AWAY)
      } catch {
        /* already closing */
      }
      this.socket = null
    }
    this.connect()
  }

  startHeartbeat() {
    this.stopHeartbeat()
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'ping', ts: Date.now() }, { queue: false })
    }, config.wsHeartbeatMs)
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  flushQueue() {
    const pending = this.queue
    this.queue = []
    pending.forEach((payload) => this.send(payload))
  }

  /**
   * Send a frame. `queue: false` drops it when offline (used for pings and typing
   * notices, where a stale one is worse than none).
   */
  send(payload, { queue = true } = {}) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(payload))
        return true
      } catch (error) {
        console.warn('Socket send failed', error)
      }
    }
    if (queue) {
      // Bounded so a long outage cannot grow without limit.
      if (this.queue.length < 100) this.queue.push(payload)
      this.connect()
    }
    return false
  }

  close() {
    this.intentionallyClosed = true
    this.clearReconnectTimer()
    this.stopHeartbeat()
    this.queue = []
    if (this.socket) {
      try {
        this.socket.close(CLOSE_GOING_AWAY)
      } catch {
        /* already closing */
      }
      this.socket = null
    }
    this.setStatus('closed')
  }
}

export default ChatSocket
