/**
 * Query key factory.
 *
 * Every cache entry is addressed through here. Hierarchical keys mean a broad
 * invalidation (`keys.conversations.all`) also clears the narrow entries beneath
 * it, and no two call sites can disagree about how a key is spelled.
 */

export const keys = {
  me: ['me'],
  account: ['account'],

  conversations: {
    all: ['conversations'],
    list: () => ['conversations', 'list'],
    unread: () => ['conversations', 'unread'],
  },

  messages: {
    all: ['messages'],
    room: (roomId) => ['messages', 'room', Number(roomId)],
  },

  friends: {
    all: ['friends'],
    list: (search) => ['friends', 'list', search || ''],
  },

  friendRequests: {
    all: ['friend-requests'],
    list: (direction, status) => ['friend-requests', 'list', direction || 'all', status || 'pending'],
  },

  people: {
    all: ['people'],
    discover: (search, onlineOnly) => ['people', 'discover', search || '', !!onlineOnly],
    directory: (search) => ['people', 'directory', search || ''],
    search: (search) => ['people', 'search', search || ''],
  },

  profiles: {
    all: ['profiles'],
    byUser: (userId) => ['profiles', Number(userId)],
  },

  blocked: {
    all: ['blocked'],
    list: () => ['blocked', 'list'],
  },
}

export default keys
