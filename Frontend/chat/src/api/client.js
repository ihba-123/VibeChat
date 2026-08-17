/**
 * The single HTTP client.
 *
 * Two things make this more than a bare axios instance:
 *
 * 1. The access token lives in memory only. The refresh token is an HttpOnly
 *    cookie the browser sends automatically, so nothing long-lived is exposed to
 *    JavaScript, and a reload re-establishes the session by calling /refresh-token/.
 * 2. A 401 triggers exactly one refresh, no matter how many requests fail at once.
 *    Without that single-flight guard, a screen that fires six queries on mount
 *    would attempt six refreshes and, with rotation enabled, invalidate its own
 *    session.
 */

import axios from 'axios'

import config from '../config'
import endpoints from './endpoints'

let accessToken = null
const authLostListeners = new Set()

/**
 * Non-sensitive marker recording what we know about this browser's session.
 *
 * The refresh token is an HttpOnly cookie JavaScript cannot read, so the app
 * cannot otherwise tell "signed in" from "never signed in" without asking the
 * server — which answers 401 for every anonymous visitor and logs a warning each
 * time.
 *
 * Three states, and the default matters: `'1'` after a successful sign-in, `'0'`
 * once we have positively established there is no session, and **absent** meaning
 * unknown. Unknown must probe. Treating absent as "no session" silently signs out
 * anyone holding a valid cookie whose marker was never written — a browser that
 * signed in before this marker existed, or one whose localStorage was cleared
 * while the cookie survived.
 */
const SESSION_HINT_KEY = 'vibechat.session'

const readHint = () => {
  try {
    return window.localStorage.getItem(SESSION_HINT_KEY)
  } catch {
    // Storage blocked (private mode): unknown, so probe.
    return null
  }
}

const writeHint = (value) => {
  try {
    if (value === null) window.localStorage.removeItem(SESSION_HINT_KEY)
    else window.localStorage.setItem(SESSION_HINT_KEY, value)
  } catch {
    /* storage unavailable — the marker is only an optimisation */
  }
}

/** False only when we positively know there is no session. */
export const mightHaveSession = () => readHint() !== '0'

/** Record that there is definitively no session, so later loads skip the probe. */
export const markNoSession = () => writeHint('0')

export const getAccessToken = () => accessToken
export const setAccessToken = (token) => {
  accessToken = token || null
  if (token) writeHint('1')
}

/** Notified when the session cannot be recovered and the user must sign in again. */
export const onAuthLost = (listener) => {
  authLostListeners.add(listener)
  return () => authLostListeners.delete(listener)
}

const emitAuthLost = () => {
  accessToken = null
  markNoSession()
  authLostListeners.forEach((listener) => {
    try {
      listener()
    } catch (error) {
      console.error('auth-lost listener failed', error)
    }
  })
}

export const apiClient = axios.create({
  baseURL: config.apiUrl,
  // Required for the refresh-token cookie to travel with the request.
  withCredentials: true,
  timeout: 30_000,
  headers: { Accept: 'application/json' },
  // Django's CSRF names, used by the session-authenticated social exchange.
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
})

/** A refresh client without the interceptors, so a failed refresh cannot recurse. */
const refreshClient = axios.create({
  baseURL: config.apiUrl,
  withCredentials: true,
  // Shorter than the general timeout: this request gates the first paint, and a
  // refresh that has not answered in ten seconds is not going to.
  timeout: 10_000,
  headers: { Accept: 'application/json' },
})

export class ApiError extends Error {
  constructor(message, { status, code, errors, cause } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.errors = errors
    this.cause = cause
  }

  /** Field-level message, for inline form errors. */
  fieldError(field) {
    const value = this.errors?.[field]
    if (!value) return undefined
    return Array.isArray(value) ? value[0] : String(value)
  }
}

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.'

/** Flatten any backend or transport failure into one predictable shape. */
export const toApiError = (error) => {
  if (error instanceof ApiError) return error

  if (axios.isCancel?.(error) || error?.code === 'ERR_CANCELED') {
    return new ApiError('Request cancelled', { code: 'cancelled', cause: error })
  }

  if (!error?.response) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    return new ApiError(
      offline ? 'You appear to be offline.' : 'Cannot reach the server.',
      { code: offline ? 'offline' : 'network_error', cause: error },
    )
  }

  const { status, data } = error.response
  let detail = data?.detail

  if (!detail && data && typeof data === 'object') {
    // Serializer errors that arrived without the standard envelope.
    const [firstValue] = Object.values(data)
    if (Array.isArray(firstValue)) detail = firstValue[0]
    else if (typeof firstValue === 'string') detail = firstValue
  }
  if (!detail && typeof data === 'string' && data.length < 300) detail = data

  return new ApiError(detail || FALLBACK_MESSAGE, {
    status,
    code: data?.code,
    errors: data?.errors,
    cause: error,
  })
}

apiClient.interceptors.request.use((request) => {
  if (accessToken) {
    request.headers.Authorization = `Bearer ${accessToken}`
  }
  return request
})

let refreshPromise = null

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const postRefresh = () =>
  refreshClient.post(endpoints.auth.refresh).then((response) => {
    const token = response.data?.access
    if (!token) throw new ApiError('Refresh response had no access token.')
    setAccessToken(token)
    return { token, user: response.data?.user ?? null }
  })

/**
 * Fetch a new access token, coalescing concurrent callers onto one request.
 *
 * The single-flight guard is essential rather than an optimisation: refresh
 * rotation blacklists the token it consumed, so six queries each firing their own
 * refresh would invalidate one another and sign the user out.
 *
 * The one retry covers the same hazard across tabs — if another tab rotated a
 * moment ago, this tab's in-flight request carried the now-blacklisted cookie, and
 * by the time it fails the fresh cookie has already been stored.
 */
export const refreshAccessToken = () => {
  if (!refreshPromise) {
    refreshPromise = postRefresh()
      .catch(async (error) => {
        // Only retry when a session was expected; a genuinely anonymous visitor
        // must not pay for a second round trip.
        if (error?.response?.status !== 401 || readHint() !== '1') throw error
        await delay(500)
        return postRefresh()
      })
      .catch((error) => {
        // A 401 is proof there is no usable cookie, so record it and stop probing
        // on future loads.
        if (error?.response?.status === 401) markNoSession()
        throw error
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

/** Endpoints where a 401 is the answer, not a signal to refresh. */
const isAuthEndpoint = (url = '') =>
  [endpoints.auth.login, endpoints.auth.register, endpoints.auth.refresh].some((path) =>
    url.includes(path),
  )

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config

    if (error.response?.status !== 401 || !request || request._retried || isAuthEndpoint(request.url)) {
      return Promise.reject(toApiError(error))
    }

    request._retried = true
    try {
      await refreshAccessToken()
    } catch (refreshError) {
      emitAuthLost()
      return Promise.reject(toApiError(refreshError))
    }

    try {
      return await apiClient(request)
    } catch (retryError) {
      return Promise.reject(toApiError(retryError))
    }
  },
)

/** Thin wrappers so call sites never touch axios response objects. */
export const http = {
  get: (url, params, options) =>
    apiClient.get(url, { params, ...options }).then((r) => r.data),
  post: (url, body, options) => apiClient.post(url, body, options).then((r) => r.data),
  patch: (url, body, options) => apiClient.patch(url, body, options).then((r) => r.data),
  put: (url, body, options) => apiClient.put(url, body, options).then((r) => r.data),
  delete: (url, options) => apiClient.delete(url, options).then((r) => r.data),
}

export default apiClient
