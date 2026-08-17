/**
 * The latest known name and avatar for each person the app has seen.
 *
 * Why this exists: every message row carries a `sender` object, and that object is
 * a snapshot of the sender at the moment the page was fetched. Message pages are
 * cached in memory *and* persisted to localStorage, so they are deliberately not
 * refetched — which means an old conversation keeps rendering the avatar that was
 * current when those messages were first loaded. Meanwhile the sidebar, the chat
 * header and the profile sheet all refetch, so the same person appears with two
 * different pictures on one screen.
 *
 * The server has never stored a per-message avatar — it serialises the live Profile
 * row on every read — so this is purely a client-side staleness problem, and the
 * fix belongs here rather than in the API. Identity is kept out of the message
 * cache: rows stay immutable, and the picture is resolved at render time.
 *
 * Only refetched sources write here (the signed-in profile, conversation
 * participants, an opened profile). Message rows deliberately never do — feeding
 * cached snapshots back in is exactly the staleness this removes, and an older page
 * loading after a newer one would overwrite good data with stale data.
 */

import { useSyncExternalStore } from 'react'

/** userId -> { name, photo } */
const directory = new Map()
const listeners = new Set()

// Bumped on every real change. Subscribers compare this instead of the Map, which
// is mutated in place and so is never a useful identity to diff against.
let version = 0

const emit = () => {
  version += 1
  listeners.forEach((listener) => listener())
}

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/**
 * Records a person, if the payload actually says something new.
 *
 * Returns whether anything changed, so bulk writes can notify once.
 */
const put = (person) => {
  const id = person?.user_id
  if (id === undefined || id === null) return false

  const key = String(id)
  const next = {
    name: person.name ?? undefined,
    // `null` is meaningful — it is how the server says "no avatar" after someone
    // removes theirs — so only `undefined` counts as "not included in this payload".
    photo: person.photo,
  }

  const current = directory.get(key)
  if (current && current.name === next.name && current.photo === next.photo) return false

  directory.set(key, { ...current, ...next })
  return true
}

export const rememberPerson = (person) => {
  if (put(person)) emit()
}

export const rememberPeople = (people) => {
  if (!people?.length) return
  let changed = false
  for (const person of people) {
    // Not `changed || put(...)` — that short-circuits and stops recording the rest.
    if (put(person)) changed = true
  }
  if (changed) emit()
}

/** Test seam: the store is module-level and would otherwise leak between tests. */
export const clearPeople = () => {
  if (directory.size === 0) return
  directory.clear()
  emit()
}

/**
 * The freshest known identity for someone, falling back to whatever the caller has.
 *
 * `fallback` is typically a `message.sender` snapshot: it is used until a refetched
 * source reports something newer, so a person the directory has never seen still
 * renders correctly.
 */
export function usePerson(fallback) {
  const id = fallback?.user_id
  useSyncExternalStore(subscribe, () => version, () => version)

  if (id === undefined || id === null) return fallback

  const known = directory.get(String(id))
  if (!known) return fallback

  return {
    ...fallback,
    name: known.name ?? fallback?.name,
    photo: known.photo !== undefined ? known.photo : fallback?.photo,
  }
}
