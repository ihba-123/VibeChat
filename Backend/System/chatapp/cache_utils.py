"""Cache access that tolerates the cache being unavailable.

Presence and block lookups are optimisations, not sources of truth: if Redis is
briefly unreachable the request should fall back to the database rather than
return a 500. Every helper here swallows connection-level failures and logs them
once per call site.
"""

import logging

from django.core.cache import cache

logger = logging.getLogger(__name__)

_MISSING = object()


def _warn(operation, exc):
    logger.warning("Cache %s failed (%s); continuing without cache", operation, type(exc).__name__)


def safe_get(key, default=None):
    try:
        return cache.get(key, default)
    except Exception as exc:
        _warn("get", exc)
        return default


def safe_get_many(keys):
    try:
        return cache.get_many(list(keys))
    except Exception as exc:
        _warn("get_many", exc)
        return {}


def safe_set(key, value, timeout=None):
    try:
        cache.set(key, value, timeout)
        return True
    except Exception as exc:
        _warn("set", exc)
        return False


def safe_add(key, value, timeout=None):
    """Returns True only when the key was genuinely created."""
    try:
        return bool(cache.add(key, value, timeout))
    except Exception as exc:
        _warn("add", exc)
        return False


def safe_incr(key, delta=1):
    """Returns the new value, or None when the key is absent or the cache is down."""
    try:
        return cache.incr(key, delta)
    except ValueError:
        return None
    except Exception as exc:
        _warn("incr", exc)
        return None


def safe_decr(key, delta=1):
    try:
        return cache.decr(key, delta)
    except ValueError:
        return None
    except Exception as exc:
        _warn("decr", exc)
        return None


def safe_delete(key):
    try:
        cache.delete(key)
    except Exception as exc:
        _warn("delete", exc)


def safe_delete_many(keys):
    try:
        cache.delete_many(list(keys))
    except Exception as exc:
        _warn("delete_many", exc)
