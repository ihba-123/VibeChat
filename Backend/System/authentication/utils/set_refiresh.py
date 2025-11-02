from django.conf import settings
from datetime import timedelta

def set_refresh_cookie(response, refresh_token):
    secure = not settings.DEBUG
    samesite = settings.SIMPLE_JWT.get('COOKIE_SAMESITE', 'Lax')
    path = settings.SIMPLE_JWT.get('COOKIE_PATH', '/')
    lifetime = settings.SIMPLE_JWT.get('REFRESH_TOKEN_LIFETIME', timedelta(days=7))
    max_age = int(lifetime.total_seconds())

    response.set_cookie(
        key="refresh_token",
        value=str(refresh_token),
        httponly=True,
        secure=secure,
        samesite=samesite,
        path=path,
        max_age=max_age
    )
    return response