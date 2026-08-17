/**
 * Session state for the whole app.
 *
 * The access token is never written to storage. On startup this provider calls
 * /refresh-token/ once: the HttpOnly refresh cookie either yields a new access
 * token (the user is still signed in) or it does not (show the login screen).
 * That keeps a long-lived credential out of reach of any injected script while
 * still surviving a page reload.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import { authApi } from '../api'
import {
  markNoSession,
  mightHaveSession,
  onAuthLost,
  refreshAccessToken,
  setAccessToken,
} from '../api/client'
import { queryClient, resetCache } from '../lib/queryClient'
import keys from '../lib/queryKeys'

const AuthContext = createContext(null)

/** Upper bound on the splash screen, so a hung network cannot strand the app. */
const BOOTSTRAP_TIMEOUT_MS = 12_000

/** 'loading' until the bootstrap refresh settles, then 'authenticated'|'anonymous'. */
export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading')
  const [user, setUser] = useState(null)
  const bootstrapped = useRef(false)

  const applySession = useCallback((token, nextUser) => {
    setAccessToken(token)
    if (nextUser) setUser(nextUser)
    setStatus('authenticated')
  }, [])

  const clearSession = useCallback(() => {
    setAccessToken(null)
    markNoSession()
    setUser(null)
    setStatus('anonymous')
    resetCache()
  }, [])

  useEffect(() => {
    // StrictMode mounts effects twice in development, so the bootstrap request is
    // guarded to run once.
    //
    // Deliberately no cancellation flag here. A previous version paired this
    // run-once ref with a cleanup that set `cancelled = true`: StrictMode ran the
    // effect, ran the cleanup, then re-ran the effect — which returned early on the
    // ref — so when the in-flight request resolved, `cancelled` was already true
    // and *neither* branch below fired. Status stayed 'loading' and the app sat on
    // the splash screen forever. The two mechanisms cannot coexist, and since this
    // runs once for the lifetime of the app there is nothing to cancel.
    if (bootstrapped.current) return undefined
    bootstrapped.current = true

    // Skip the probe only when we positively know there is no session; an unknown
    // marker still has to ask, or a valid cookie gets silently ignored.
    if (!mightHaveSession()) {
      setStatus('anonymous')
      return undefined
    }

    // Hard backstop: whatever happens to the request, the splash screen ends.
    const timeout = setTimeout(() => {
      setStatus((current) => (current === 'loading' ? 'anonymous' : current))
    }, BOOTSTRAP_TIMEOUT_MS)

    refreshAccessToken()
      .then(({ token, user: refreshedUser }) => applySession(token, refreshedUser))
      .catch(() => {
        // The cookie is gone or expired — an ordinary signed-out visit, not an error.
        setStatus('anonymous')
      })
      .finally(() => clearTimeout(timeout))

    return () => clearTimeout(timeout)
  }, [applySession])

  useEffect(() => onAuthLost(() => clearSession()), [clearSession])

  const login = useCallback(
    async (credentials) => {
      const data = await authApi.login(credentials)
      applySession(data.access, data.user)
      return data
    },
    [applySession],
  )

  const register = useCallback(
    async (details) => {
      const data = await authApi.register(details)
      applySession(data.access, data.user)
      return data
    },
    [applySession],
  )

  /** Completes Google sign-in by trading the allauth session for tokens. */
  const completeSocialLogin = useCallback(async () => {
    const data = await authApi.exchangeSession()
    applySession(data.access, data.user)
    return data
  }, [applySession])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch (error) {
      // Even if the call fails the local session must go; the cookie is cleared
      // server-side on the next successful request or by its own expiry.
      console.warn('Logout request failed', error)
    } finally {
      clearSession()
    }
  }, [clearSession])

  /** Keeps the header in sync after a profile edit without a refetch. */
  const patchUser = useCallback((partial) => {
    setUser((current) => (current ? { ...current, ...partial } : current))
    queryClient.setQueryData(keys.me, (current) => (current ? { ...current, ...partial } : current))
  }, [])

  const value = useMemo(
    () => ({
      status,
      user,
      isAuthenticated: status === 'authenticated',
      isLoading: status === 'loading',
      login,
      register,
      logout,
      completeSocialLogin,
      patchUser,
    }),
    [status, user, login, register, logout, completeSocialLogin, patchUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}

export default AuthProvider
