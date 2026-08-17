"""Cached block lookups.

Every message send has to check whether the two parties have blocked each other.
Doing that as a database query per message is the kind of cost that only shows up
under load, so the (small) set of ids a user cannot talk to is cached and
invalidated explicitly whenever a block changes. If the cache is unavailable the
lookup falls through to the database.
"""

from ..cache_utils import safe_delete_many, safe_get, safe_set
from ..models import BlockedUser

CACHE_TTL_SECONDS = 300


def _key(user_id) -> str:
    return f"blocked:ids:{user_id}"


def blocked_ids_for(user, *, refresh: bool = False) -> set:
    """Ids this user cannot exchange messages with, in either direction."""
    key = _key(user.pk)
    if not refresh:
        cached = safe_get(key)
        if cached is not None:
            return set(cached)

    ids = BlockedUser.blocked_ids_for(user)
    safe_set(key, list(ids), CACHE_TTL_SECONDS)
    return ids


def invalidate(*user_ids) -> None:
    safe_delete_many([_key(uid) for uid in user_ids if uid])
