/**
 * URL construction.
 *
 * Cheap tests for something that broke every realtime connection: the WebSocket
 * path was run through the prefix helper, which strips trailing slashes, so the
 * client dialled `/ws/stream` against a route declared as `ws/stream/`.
 */

import { describe, expect, it } from 'vitest'

import config from '../config'

describe('config URLs', () => {
  it('builds the API URL without a doubled or trailing slash', () => {
    expect(config.apiUrl).toBe(`${config.apiBaseUrl}/api`)
    expect(config.apiUrl).not.toMatch(/\/\/[^/]*$/)
    expect(config.apiUrl.endsWith('/')).toBe(false)
  })

  it('keeps the trailing slash on the WebSocket path', () => {
    // Django route patterns require it and a WebSocket has no APPEND_SLASH redirect.
    expect(config.wsUrl).toMatch(/\/ws\/stream\/$/)
  })

  it('derives a ws:// origin from an http:// API origin', () => {
    expect(config.wsUrl).toMatch(/^wss?:\/\//)
    if (config.apiBaseUrl.startsWith('https://')) {
      expect(config.wsUrl.startsWith('wss://')).toBe(true)
    } else {
      expect(config.wsUrl.startsWith('ws://')).toBe(true)
    }
  })

  it('keeps the trailing slash on the Google login path', () => {
    expect(config.googleLoginUrl).toMatch(/\/accounts\/google\/login\/$/)
  })

  it('exposes positive numeric defaults', () => {
    for (const key of [
      'messagePageSize',
      'listPageSize',
      'staleTime',
      'gcTime',
      'wsHeartbeatMs',
      'maxUploadMb',
      'maxMessageLength',
    ]) {
      expect(config[key], key).toBeGreaterThan(0)
    }
  })
})
