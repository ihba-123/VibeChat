from datetime import timedelta

from django.conf import settings


def _jwt_setting(key, default=None):
    return settings.SIMPLE_JWT.get(key, default)


def refresh_cookie_name():
    return _jwt_setting('COOKIE_NAME', 'refresh_token')


def set_refresh_cookie(response, refresh_token):
    """Store the refresh token in an HttpOnly cookie."""
    lifetime = _jwt_setting('REFRESH_TOKEN_LIFETIME', timedelta(days=7))
    samesite = _jwt_setting('COOKIE_SAMESITE', 'Lax')
    # SameSite=None is only honoured on a Secure cookie, so a cross-site setup
    # that is not served over HTTPS would silently lose the cookie.
    secure = bool(_jwt_setting('COOKIE_SECURE', not settings.DEBUG))
    if str(samesite).lower() == 'none':
        secure = True

    response.set_cookie(
        key=refresh_cookie_name(),
        value=str(refresh_token),
        httponly=True,
        secure=secure,
        samesite=samesite,
        path=_jwt_setting('COOKIE_PATH', '/'),
        domain=_jwt_setting('COOKIE_DOMAIN'),
        max_age=int(lifetime.total_seconds()),
    )
    return response


def clear_refresh_cookie(response):
    response.delete_cookie(
        refresh_cookie_name(),
        path=_jwt_setting('COOKIE_PATH', '/'),
        domain=_jwt_setting('COOKIE_DOMAIN'),
        samesite=_jwt_setting('COOKIE_SAMESITE', 'Lax'),
    )
    return response
