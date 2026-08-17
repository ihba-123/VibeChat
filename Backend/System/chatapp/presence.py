"""Presence tracking backed by the shared cache.

Online state cannot be derived from a single WebSocket lifecycle: a user may have
several tabs open, and the old consumer flipped ``Profile.is_online`` to False as
soon as *any* connection dropped, so closing one tab marked an active user
offline. Here each connection increments a per-user counter and the database is
only touched on the 0 -> 1 and 1 -> 0 transitions, which keeps write volume flat
as the user count grows.

Reads degrade to "unknown" if the cache is unavailable, and callers fall back to
the persisted ``Profile.is_online`` column.
"""

import logging

from .cache_utils import (
    safe_add,
    safe_decr,
    safe_delete,
    safe_get,
    safe_get_many,
    safe_incr,
    safe_set,
)

logger = logging.getLogger(__name__)

# Long enough to survive a worker restart, short enough that a counter leaked by a
# hard kill eventually expires instead of pinning a user "online" forever.
CONNECTION_TTL_SECONDS = 60 * 60 * 12


def _key(user_id) -> str:
    return f"presence:conn:{user_id}"


def register_connection(user_id) -> bool:
    """Count a new connection. True when the user just came online."""
    key = _key(user_id)
    # add() only succeeds when the key is absent, which makes "first connection" a
    # single atomic step rather than a get/set race between workers.
    if safe_add(key, 1, CONNECTION_TTL_SECONDS):
        return True
    if safe_incr(key) is None:
        # Key expired between add() and incr(), or the cache is down: treat this as
        # a fresh connection so the user still shows up as online.
        safe_set(key, 1, CONNECTION_TTL_SECONDS)
        return True
    return False


def unregister_connection(user_id) -> bool:
    """Drop a connection. True when the user has no connections left."""
    key = _key(user_id)
    remaining = safe_decr(key)
    if remaining is None or remaining <= 0:
        safe_delete(key)
        return True
    return False


def connection_count(user_id) -> int:
    return int(safe_get(_key(user_id)) or 0)


def is_online(user_id) -> bool:
    return connection_count(user_id) > 0


def online_ids(user_ids):
    """Subset of ``user_ids`` currently connected, in one round trip."""
    unique = {uid for uid in user_ids if uid}
    if not unique:
        return set()
    found = safe_get_many(_key(uid) for uid in unique)
    return {uid for uid in unique if found.get(_key(uid))}


def reset(user_id) -> None:
    safe_delete(_key(user_id))
