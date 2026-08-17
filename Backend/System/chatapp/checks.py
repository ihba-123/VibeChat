"""Startup checks for configuration that fails only under load.

These run on every `manage.py` command, so a setting that would quietly exhaust the
database at peak traffic is reported at boot instead of at 3am.
"""

from django.conf import settings
from django.core.checks import Info as CheckInfo
from django.core.checks import Warning as CheckWarning
from django.core.checks import register


@register()
def check_persistent_connections(app_configs, **kwargs):
    """Persistent connections plus the ASGI thread pool exhausts max_connections.

    Django keeps connections in thread-local storage and `close_old_connections()`
    only closes the calling thread's. Under ASGI each request may run on a different
    thread-pool thread, so with CONN_MAX_AGE > 0 every new thread opens a connection
    and holds it, and the count climbs until PostgreSQL answers
    "FATAL: sorry, too many clients already".

    Legitimate with a pooler in front, which is what DB_BEHIND_POOLER declares.
    """
    max_age = settings.DATABASES.get('default', {}).get('CONN_MAX_AGE') or 0
    if max_age and not getattr(settings, 'DB_BEHIND_POOLER', False):
        return [
            CheckWarning(
                f'DB_CONN_MAX_AGE is {max_age} while running under ASGI without a '
                'connection pooler.',
                hint=(
                    'Django holds persistent connections per thread, and the ASGI '
                    'thread pool will accumulate one per thread until PostgreSQL '
                    'refuses new clients. Set DB_CONN_MAX_AGE=0, or put pgbouncer in '
                    'front and set DB_BEHIND_POOLER=True to silence this.'
                ),
                id='chatapp.W001',
            )
        ]
    return []


@register()
def check_message_encryption_key(app_configs, **kwargs):
    """Messages cannot be stored without a Fernet key."""
    if not [k for k in getattr(settings, 'FERNET_KEYS', []) if k and k.strip()]:
        return [
            CheckWarning(
                'No message encryption key is configured.',
                hint=(
                    'Set FERNET_KEYS in the environment (comma separated, newest '
                    'first). Generate one with: python -c "from cryptography.fernet '
                    'import Fernet; print(Fernet.generate_key().decode())"'
                ),
                id='chatapp.W002',
            )
        ]
    return []


@register()
def check_google_oauth_config(app_configs, **kwargs):
    """Catch a half-configured Google sign-in.

    The frontend shows the Google button whenever VITE_GOOGLE_ENABLED is on, which it
    is by default, so a missing credential on this side produces a button that leads
    to an error page rather than a visibly disabled control.

    The other half of this — the redirect URI — cannot be validated from here, because
    allauth derives it from the request host at runtime. See the note in System/urls.py.
    """
    app = settings.SOCIALACCOUNT_PROVIDERS.get('google', {}).get('APP', {})
    client_id = (app.get('client_id') or '').strip()
    secret = (app.get('secret') or '').strip()

    if not client_id and not secret:
        # Neither set: Google sign-in is simply off, which is a valid configuration.
        return []

    issues = []
    if bool(client_id) != bool(secret):
        missing = 'GOOGLE_CLIENT_SECRET' if client_id else 'GOOGLE_CLIENT_ID'
        issues.append(
            CheckWarning(
                f'Google sign-in is half-configured: {missing} is empty.',
                hint='Set both values, or clear both to turn Google sign-in off.',
                id='chatapp.W005',
            )
        )
    else:
        backend_url = getattr(settings, 'BACKEND_URL', '').rstrip('/')
        # Info, not a warning: this is correct configuration, and a permanent
        # warning would become wallpaper and fail a "checks must be clean" gate.
        issues.append(
            CheckInfo(
                'Google sign-in is enabled.',
                hint=(
                    'Google requires the redirect URI to match exactly and treats '
                    'localhost and 127.0.0.1 as different origins. This exact value '
                    'must be registered on the OAuth client: '
                    f'{backend_url}/accounts/google/login/callback/'
                ),
                id='chatapp.I001',
            )
        )
    return issues


@register()
def check_shared_cache_and_channel_layer(app_configs, **kwargs):
    """Per-process backends are wrong with more than one worker.

    Presence counting and OTP rate limiting both rely on the cache being shared, and
    the channel layer has to be shared for a message to reach a socket held by a
    different process.
    """
    issues = []
    if getattr(settings, 'CACHE_BACKEND', 'redis') == 'locmem':
        issues.append(
            CheckWarning(
                'CACHE_BACKEND=locmem is per-process.',
                hint=(
                    'Presence counters and OTP rate limits become incorrect with more '
                    'than one worker. Use Redis outside single-process development.'
                ),
                id='chatapp.W003',
            )
        )
    if getattr(settings, 'CHANNEL_LAYER_BACKEND', 'redis') == 'inmemory':
        issues.append(
            CheckWarning(
                'CHANNEL_LAYER_BACKEND=inmemory is per-process.',
                hint=(
                    'Realtime messages will not reach sockets held by another worker. '
                    'Use Redis outside single-process development.'
                ),
                id='chatapp.W004',
            )
        )
    return issues
