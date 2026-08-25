/**
 * Every backend route in one place.
 *
 * Paths are relative to `config.apiUrl`; the axios instance supplies the origin.
 * Keeping them here means a renamed route is a one-line change rather than a
 * search across components.
 */

export const endpoints = {
  auth: {
    register: '/register/',
    login: '/login/',
    logout: '/logout/',
    refresh: '/refresh-token/',
    profile: '/profile/',
    sessionToken: '/auth/session-token/',
    forgotPassword: '/password/forgot/',
    verifyOtp: '/password/verify-otp/',
    resetPassword: '/password/reset/',
    changePassword: '/password/change/',
  },

  chat: {
    conversations: '/chatrooms/',
    createConversation: '/chatrooms/create/',
    unreadCount: '/chatrooms/unread-count/',
    group: (roomId) => `/chatrooms/${roomId}/`,
    groupMembers: (roomId) => `/chatrooms/${roomId}/members/`,
    groupMember: (roomId, userId) => `/chatrooms/${roomId}/members/${userId}/`,
    messages: (roomId) => `/message-list/${roomId}/`,
    upload: (roomId) => `/chat/${roomId}/messages/`,
  },

  people: {
    friends: '/friends/',
    friend: (userId) => `/friends/${userId}/`,
    friendRequests: '/friendrequests/',
    respondToRequest: (requestId) => `/friendrequests/update/${requestId}/`,
    discover: '/online-users/',
    allStatus: '/users/all-status/',
    search: '/user-search/',
  },

  profile: {
    me: '/chat-profile/',
    update: '/chat-profile/update/',
    byUser: (userId) => `/chat-profile/${userId}/`,
  },

  blocking: {
    list: '/blocked-users/',
    block: (userId) => `/block-user/${userId}/`,
    unblock: (userId) => `/unblock-user/${userId}/`,
  },
}

export default endpoints
