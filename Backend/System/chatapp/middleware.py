"""WebSocket authentication middleware.

Accepts the JWT from the ``token`` query parameter or from the
``Sec-WebSocket-Protocol`` header (``["access_token", "<jwt>"]``), which keeps the
credential out of server access logs.
"""

import logging
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.settings import api_settings as jwt_settings
from rest_framework_simplejwt.tokens import AccessToken

User = get_user_model()
logger = logging.getLogger(__name__)


@database_sync_to_async
def get_user_from_token(raw_token: str):
    try:
        # AccessToken, not UntypedToken: UntypedToken skips the token-type claim,
        # so a *refresh* token was accepted here as a credential. It also honours
        # the configured signing key and algorithm instead of assuming HS256.
        token = AccessToken(raw_token)
    except (TokenError, ValueError, TypeError):
        return AnonymousUser()

    user_id = token.payload.get(jwt_settings.USER_ID_CLAIM)
    if user_id is None:
        return AnonymousUser()

    try:
        return (
            User.objects.select_related("profile")
            .get(**{jwt_settings.USER_ID_FIELD: user_id, "is_active": True})
        )
    except User.DoesNotExist:
        return AnonymousUser()


def _token_from_scope(scope) -> str | None:
    query = parse_qs(scope.get("query_string", b"").decode())
    token = query.get("token", [None])[0]
    if token:
        return token

    protocols = scope.get("subprotocols") or []
    if len(protocols) >= 2 and protocols[0] == "access_token":
        return protocols[1]

    for header, value in scope.get("headers", []):
        if header == b"authorization":
            parts = value.decode().split()
            if len(parts) == 2 and parts[0].lower() == "bearer":
                return parts[1]
    return None


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        token = _token_from_scope(scope)
        scope["user"] = await get_user_from_token(token) if token else AnonymousUser()
        return await super().__call__(scope, receive, send)
