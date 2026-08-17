/**
 * AuthProvider in isolation.
 *
 * Separate from app.test.jsx on purpose. The full app mounts lazy routes behind a
 * Suspense boundary, and that suspension reorders effect timing enough to mask a
 * bootstrap race — the integration test passed while the real browser sat on the
 * splash screen forever. Rendering the provider bare makes the ordering
 * deterministic: StrictMode runs the effect, cleans it up, re-runs it, and only
 * then does the refresh settle, which is exactly the real-world sequence.
 */

import { render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api/client', async () => {
  const actual = await vi.importActual('../api/client')
  const state = () => globalThis.__auth
  return {
    ...actual,
    getAccessToken: () => null,
    setAccessToken: () => {},
    onAuthLost: () => () => {},
    mightHaveSession: () => state().mightHaveSession,
    markNoSession: () => {
      state().markedNoSession = true
    },
    refreshAccessToken: () => {
      state().refreshCalls += 1
      return state().refresh()
    },
  }
})

vi.mock('../lib/queryClient', () => ({
  queryClient: { setQueryData: () => {}, clear: () => {} },
  resetCache: () => {},
  persistOptions: {},
  persister: {},
}))

import AuthProvider, { useAuth } from '../auth/AuthProvider'

/** Renders the provider's status as text so assertions are unambiguous. */
function StatusProbe() {
  const { status } = useAuth()
  return <span data-testid="status">{status}</span>
}

const mount = ({ authenticated = true, mightHaveSession = true, latencyMs = 25 } = {}) => {
  globalThis.__auth = {
    mightHaveSession,
    refreshCalls: 0,
    markedNoSession: false,
    // Settles on a macrotask, like a network call: after StrictMode's remount.
    refresh: () =>
      new Promise((resolve, reject) => {
        setTimeout(() => {
          if (authenticated) resolve({ token: 'tok', user: { user_id: 1, name: 'Alice' } })
          else reject(Object.assign(new Error('no session'), { response: { status: 401 } }))
        }, latencyMs)
      }),
  }

  return render(
    <StrictMode>
      <AuthProvider>
        <StatusProbe />
      </AuthProvider>
    </StrictMode>,
  )
}

const status = () => screen.getByTestId('status').textContent

beforeEach(() => {
  localStorage.clear()
})

describe('AuthProvider bootstrap', () => {
  it('reaches "authenticated" when the refresh settles after StrictMode remounts', async () => {
    mount({ authenticated: true })

    expect(status()).toBe('loading')

    // The regression this pins: a run-once ref combined with a cancel-on-cleanup
    // flag means the cleanup fires between the two effect runs, the second run
    // short-circuits on the ref, and the settled request is discarded — leaving
    // status at 'loading' permanently.
    await waitFor(() => expect(status()).toBe('authenticated'))
  })

  it('reaches "anonymous" when the refresh fails after StrictMode remounts', async () => {
    mount({ authenticated: false })

    await waitFor(() => expect(status()).toBe('anonymous'))
  })

  it('issues exactly one refresh despite the doubled effect', async () => {
    mount({ authenticated: true })

    await waitFor(() => expect(status()).toBe('authenticated'))
    // More than one would rotate the refresh token twice and blacklist the pair.
    expect(globalThis.__auth.refreshCalls).toBe(1)
  })

  it('skips the probe entirely when there is positively no session', async () => {
    mount({ mightHaveSession: false })

    await waitFor(() => expect(status()).toBe('anonymous'))
    expect(globalThis.__auth.refreshCalls).toBe(0)
  })

  it('probes when the marker is unknown, so a valid cookie is still honoured', async () => {
    // A browser whose marker was never written but whose cookie is fine. Treating
    // unknown as "signed out" silently logs the user out.
    mount({ authenticated: true, mightHaveSession: true })

    await waitFor(() => expect(status()).toBe('authenticated'))
    expect(globalThis.__auth.refreshCalls).toBe(1)
  })

  it('never leaves the splash screen up on a slow refresh', async () => {
    // Settles well after the assertions below; the point is that 'loading' is a
    // transient state with a guaranteed exit, not a terminal one.
    mount({ authenticated: true, latencyMs: 40 })

    expect(status()).toBe('loading')
    await waitFor(() => expect(status()).not.toBe('loading'), { timeout: 2000 })
  })
})
