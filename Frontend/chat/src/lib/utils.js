/** Small shared helpers. No dependencies, so they stay cheap to import. */

/** Join class names, dropping falsy values. */
export const cn = (...values) => values.filter(Boolean).join(' ')

/** Up to two initials for an avatar fallback. */
export const initials = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

/**
 * Deterministic accent colour per user, so an avatar without a photo still reads
 * as that particular person across the app.
 */
export const accentFor = (seed = '') => {
  let hash = 0
  const text = String(seed)
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) % 360
  }
  return `oklch(0.62 0.14 ${hash})`
}

// ------------------------------------------------------------------- time

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const startOfDay = (date) => {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export const parseDate = (value) => (value instanceof Date ? value : new Date(value))

/** `14:05` in the viewer's locale. */
export const formatTime = (value) =>
  parseDate(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

/** Compact relative label for conversation rows: `now`, `12:04`, `Tue`, `14 Mar`. */
export const formatListTimestamp = (value) => {
  if (!value) return ''
  const date = parseDate(value)
  const now = new Date()
  const diff = now - date

  if (diff < MINUTE) return 'now'
  if (startOfDay(now).getTime() === startOfDay(date).getTime()) return formatTime(date)
  if (diff < 7 * DAY) return date.toLocaleDateString(undefined, { weekday: 'short' })
  if (date.getFullYear() === now.getFullYear())
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: '2-digit' })
}

/** Header for a group of messages: `Today`, `Yesterday`, or a full date. */
export const formatDateDivider = (value) => {
  const date = startOfDay(parseDate(value))
  const today = startOfDay(new Date())
  const days = Math.round((today - date) / DAY)

  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return date.toLocaleDateString(undefined, { weekday: 'long' })
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    ...(date.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
  })
}

export const isSameDay = (a, b) =>
  startOfDay(parseDate(a)).getTime() === startOfDay(parseDate(b)).getTime()

/** True when two messages are close enough in time to share one avatar block. */
export const withinBurst = (a, b, windowMs = 5 * MINUTE) =>
  Math.abs(parseDate(a) - parseDate(b)) < windowMs

// ------------------------------------------------------------------ files

const UNITS = ['B', 'KB', 'MB', 'GB']

export const formatBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1)
  const value = bytes / 1024 ** exponent
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${UNITS[exponent]}`
}

export const isImageFile = (file) => Boolean(file?.type?.startsWith('image/'))

// ------------------------------------------------------------------- misc

/** Stable id for optimistic rows, so the server echo can replace the right one. */
export const makeClientId = () =>
  globalThis.crypto?.randomUUID?.() ?? `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`

export const isTempId = (id) => typeof id === 'string' && id.startsWith('tmp-')

/** Insert or replace by id, keeping the array sorted by timestamp. */
export const upsertById = (list, item, { sortKey = 'timestamp' } = {}) => {
  const index = list.findIndex((entry) => entry.id === item.id)
  const next = index === -1 ? [...list, item] : list.map((e, i) => (i === index ? item : e))
  return next.sort((a, b) => parseDate(a[sortKey]) - parseDate(b[sortKey]))
}

export const truncate = (text, max = 90) => {
  const value = String(text ?? '')
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

export const pluralize = (count, singular, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`
