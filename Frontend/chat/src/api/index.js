/**
 * Typed-ish wrappers around every backend endpoint.
 *
 * Components never build URLs or read raw axios responses; they call these.
 */

import config from '../config'
import { http } from './client'
import endpoints from './endpoints'

/**
 * Pull a query parameter out of a DRF pagination link.
 * The API returns absolute `next`/`previous` URLs; the cursor or page number
 * inside them is what the next request needs.
 */
export const paramFromUrl = (url, key) => {
  if (!url) return null
  try {
    return new URL(url, config.apiBaseUrl).searchParams.get(key)
  } catch {
    return null
  }
}

// ------------------------------------------------------------------ auth

export const authApi = {
  register: ({ name, email, password, password2 }) =>
    http.post(endpoints.auth.register, { name, email, password, password2 }),

  login: ({ email, password }) => http.post(endpoints.auth.login, { email, password }),

  logout: () => http.post(endpoints.auth.logout, {}),

  /** Exchange an allauth session (Google sign-in) for a JWT pair. */
  exchangeSession: () => http.post(endpoints.auth.sessionToken, {}),

  account: () => http.get(endpoints.auth.profile),

  forgotPassword: ({ email }) => http.post(endpoints.auth.forgotPassword, { email }),

  verifyOtp: ({ email, otp }) => http.post(endpoints.auth.verifyOtp, { email, otp }),

  resetPassword: ({ email, otp, password }) =>
    http.post(endpoints.auth.resetPassword, { email, otp, password }),

  changePassword: ({ oldPassword, newPassword }) =>
    http.post(endpoints.auth.changePassword, {
      old_password: oldPassword,
      new_password: newPassword,
    }),
}

// ------------------------------------------------------------------ chat

export const chatApi = {
  conversations: ({ page = 1 } = {}) =>
    http.get(endpoints.chat.conversations, { page, page_size: config.listPageSize }),

  unreadCount: () => http.get(endpoints.chat.unreadCount),

  /** Get or create a conversation. Direct chats are idempotent. */
  openDirect: (userId) =>
    http.post(endpoints.chat.createConversation, {
      is_group: false,
      participant_ids: [userId],
    }),

  createGroup: ({ name, participantIds }) =>
    http.post(endpoints.chat.createConversation, {
      is_group: true,
      name,
      participant_ids: participantIds,
    }),

  /** Rename a group. Admin only — the server enforces it. */
  renameGroup: ({ roomId, name }) => http.patch(endpoints.chat.group(roomId), { name }),

  /** Add people to an existing group. Admin only. */
  addGroupMembers: ({ roomId, participantIds }) =>
    http.post(endpoints.chat.groupMembers(roomId), { participant_ids: participantIds }),

  /** Remove someone from a group. Admin only. */
  removeGroupMember: ({ roomId, userId }) =>
    http.delete(endpoints.chat.groupMember(roomId, userId)),

  /** One page of history. `cursor` is null for the newest page. */
  messages: ({ roomId, cursor = null, signal } = {}) =>
    http.get(
      endpoints.chat.messages(roomId),
      { cursor: cursor || undefined, page_size: config.messagePageSize },
      { signal },
    ),

  uploadMessage: ({ roomId, content, image, file, onProgress, signal }) => {
    const form = new FormData()
    if (content) form.append('content', content)
    if (image) form.append('images', image)
    if (file) form.append('attachment', file)

    return http.post(endpoints.chat.upload(roomId), form, {
      signal,
      onUploadProgress: onProgress
        ? (event) =>
            onProgress(event.total ? Math.round((event.loaded / event.total) * 100) : 0)
        : undefined,
    })
  },
}

// ---------------------------------------------------------------- people

export const peopleApi = {
  friends: ({ page = 1, q } = {}) =>
    http.get(endpoints.people.friends, { page, page_size: config.listPageSize, q: q || undefined }),

  removeFriend: (userId) => http.delete(endpoints.people.friend(userId)),

  friendRequests: ({ direction, status = 'pending', page = 1 } = {}) =>
    http.get(endpoints.people.friendRequests, {
      direction: direction || undefined,
      status,
      page,
      page_size: config.listPageSize,
    }),

  sendFriendRequest: (userId) =>
    http.post(endpoints.people.friendRequests, { to_user_id: userId }),

  respondToFriendRequest: ({ requestId, action }) =>
    http.put(endpoints.people.respondToRequest(requestId), { action }),

  /** Suggested people: not friends, no pending request, not blocked. */
  discover: ({ page = 1, q, onlineOnly = false } = {}) =>
    http.get(endpoints.people.discover, {
      page,
      page_size: config.listPageSize,
      q: q || undefined,
      online: onlineOnly ? 1 : undefined,
    }),

  directory: ({ page = 1, q } = {}) =>
    http.get(endpoints.people.allStatus, {
      page,
      page_size: config.listPageSize,
      q: q || undefined,
    }),

  search: ({ q, page = 1, signal } = {}) =>
    http.get(
      endpoints.people.search,
      { q, page, page_size: config.listPageSize },
      { signal },
    ),
}

// --------------------------------------------------------------- profile

export const profileApi = {
  me: () => http.get(endpoints.profile.me),

  byUser: (userId) => http.get(endpoints.profile.byUser(userId)),

  update: ({ name, bio, photo }) => {
    // Multipart only when there is a file; a text-only edit stays JSON.
    if (photo) {
      const form = new FormData()
      if (name !== undefined) form.append('name', name)
      if (bio !== undefined) form.append('bio', bio ?? '')
      form.append('photo', photo)
      return http.patch(endpoints.profile.update, form)
    }
    const body = {}
    if (name !== undefined) body.name = name
    if (bio !== undefined) body.bio = bio ?? ''
    return http.patch(endpoints.profile.update, body)
  },
}

// -------------------------------------------------------------- blocking

export const blockingApi = {
  list: ({ page = 1 } = {}) =>
    http.get(endpoints.blocking.list, { page, page_size: config.listPageSize }),

  block: (userId) => http.post(endpoints.blocking.block(userId), {}),

  unblock: (userId) => http.delete(endpoints.blocking.unblock(userId)),
}

export { endpoints }
