import logging

from django.conf import settings
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.settings import api_settings as jwt_settings
from rest_framework_simplejwt.tokens import RefreshToken

from authentication.models import User

logger = logging.getLogger(__name__)


def refresh_access_token_service(refresh_token):
    """Exchange a refresh token for a fresh access token (rotating if configured).

    Returns ``(data, status_code)``.
    """
    if not refresh_token:
        # Definitive: the browser sent no refresh cookie.
        return {'error': 'No session.', 'code': 'no_session'}, 401

    try:
        token = RefreshToken(refresh_token)
    except TokenError:
        # Expired, malformed, or already blacklisted — the last of which also covers
        # a tab that lost a rotation race. Not definitive, so it is reported
        # separately from 'no cookie present'.
        return {'error': 'Session expired. Please sign in again.', 'code': 'session_expired'}, 401

    user_id = token.payload.get(jwt_settings.USER_ID_CLAIM)
    if not user_id:
        return {'error': 'Invalid token payload.', 'code': 'session_expired'}, 401

    try:
        user = User.objects.get(**{jwt_settings.USER_ID_FIELD: user_id}, is_active=True)
    except User.DoesNotExist:
        return {'error': 'User not found.', 'code': 'no_session'}, 401

    if not settings.SIMPLE_JWT.get('ROTATE_REFRESH_TOKENS', False):
        return {'access': str(token.access_token), 'user': user}, 200

    new_refresh = RefreshToken.for_user(user)

    if settings.SIMPLE_JWT.get('BLACKLIST_AFTER_ROTATION', False):
        try:
            token.blacklist()
        except AttributeError:
            logger.warning('Token blacklist app is not installed; skipping rotation blacklist.')
        except TokenError:
            # Already blacklisted — a duplicate refresh (two tabs racing). The new
            # pair above is still valid, so this is not a failure.
            logger.info('Refresh token was already blacklisted during rotation.')

    return {
        # The access token is the whole point of this endpoint. The previous
        # version built it and then returned only the refresh token, so the client
        # could never actually renew its session.
        'access': str(new_refresh.access_token),
        'refresh': str(new_refresh),
        'user': user,
    }, 200
