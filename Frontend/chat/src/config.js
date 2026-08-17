/**
 * Runtime configuration.
 *
 * Everything environment-specific is read from Vite env vars and funnelled
 * through this module, so no host, port or path is written into a component.
 * Copy `.env.example` to `.env` to override any of it.
 */

const env = import.meta.env

/** Strip trailing slashes so joins never produce `//`. */
const trimEnd = (value) => String(value || '').replace(/\/+$/, '')

/**
 * A URL *prefix*: single leading slash, no trailing slash, so appending an
 * endpoint path cannot produce `//`.
 */
const asPrefix = (value, fallback) =>
  `/${String(value ?? fallback).replace(/^\/+|\/+$/g, '')}`

/**
 * A complete Django route: single leading slash **and** a trailing slash.
 *
 * The trailing slash is not cosmetic. Django route patterns require it, and unlike
 * HTTP there is no APPEND_SLASH redirect for a WebSocket — a handshake to
 * `/ws/stream` simply raises "No route found" and the socket dies. This used to go
 * through the prefix helper, which stripped the slash off and broke every
 * connection attempt.
 */
const asRoutePath = (value, fallback) =>
  `/${String(value ?? fallback).replace(/^\/+|\/+$/g, '')}/`

const apiBaseUrl = trimEnd(env.VITE_API_BASE_URL || 'http://localhost:8000')
const apiPrefix = asPrefix(env.VITE_API_PREFIX, 'api')

/** Derive the WebSocket origin from the API origin unless explicitly overridden. */
const wsOrigin = trimEnd(
  env.VITE_WS_BASE_URL || apiBaseUrl.replace(/^http(s?):\/\//i, (_, s) => `ws${s}://`),
)

const number = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const config = {
  apiBaseUrl,
  apiPrefix,
  /** `http://host:8000/api` */
  apiUrl: `${apiBaseUrl}${apiPrefix}`,
  /** Multiplexed realtime stream: one socket carries every conversation. */
  wsUrl: `${wsOrigin}${asRoutePath(env.VITE_WS_PATH, 'ws/stream/')}`,
  /** Where allauth sends the browser to start Google sign-in. */
  googleLoginUrl: `${apiBaseUrl}${asRoutePath(env.VITE_GOOGLE_LOGIN_PATH, 'accounts/google/login/')}`,
  googleEnabled: String(env.VITE_GOOGLE_ENABLED ?? 'true') !== 'false',

  appName: env.VITE_APP_NAME || 'VibeChat',

  // Paging
  messagePageSize: number(env.VITE_MESSAGE_PAGE_SIZE, 30),
  listPageSize: number(env.VITE_LIST_PAGE_SIZE, 30),

  // Caching (ms). staleTime governs how long a cached list is trusted without a
  // refetch; the realtime stream pushes changes, so these can be generous.
  staleTime: number(env.VITE_STALE_TIME_MS, 30_000),
  gcTime: number(env.VITE_GC_TIME_MS, 30 * 60_000),
  persistMaxAgeMs: number(env.VITE_PERSIST_MAX_AGE_MS, 24 * 60 * 60_000),
  cacheKey: env.VITE_CACHE_KEY || 'vibechat.cache.v1',

  // Realtime tuning
  wsReconnectBaseMs: number(env.VITE_WS_RECONNECT_BASE_MS, 500),
  wsReconnectMaxMs: number(env.VITE_WS_RECONNECT_MAX_MS, 15_000),
  wsHeartbeatMs: number(env.VITE_WS_HEARTBEAT_MS, 25_000),

  // Composer behaviour
  typingIdleMs: number(env.VITE_TYPING_IDLE_MS, 2_500),
  typingThrottleMs: number(env.VITE_TYPING_THROTTLE_MS, 1_500),
  searchDebounceMs: number(env.VITE_SEARCH_DEBOUNCE_MS, 300),

  maxUploadMb: number(env.VITE_MAX_UPLOAD_MB, 25),
  maxMessageLength: number(env.VITE_MAX_MESSAGE_LENGTH, 5000),
}

export default config
