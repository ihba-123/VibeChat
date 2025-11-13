# authentication/middleware.py
import jwt
from urllib.parse import parse_qs

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware

from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

User = get_user_model()


@database_sync_to_async
def get_user_from_token(token: str):
    try:
        # 1. Validate signature + expiration
        UntypedToken(token)

        # 2. Decode payload (no verification again – already done above)
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        uid = payload.get("user_id")
        if uid is None:
            return AnonymousUser()
        return User.objects.get(id=uid)
    except (InvalidToken, TokenError, User.DoesNotExist, jwt.PyJWTError):
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    """
    Extracts JWT from:
        - query string:  ?token=<jwt>
        - OR cookie:      access_token=<jwt>   (uncomment the cookie block if you prefer)
    Sets scope['user'] to the real User or AnonymousUser.
    """

    def __init__(self, inner):
        super().__init__(inner)

    async def __call__(self, scope, receive, send):
        # ---------- 1. FROM QUERY STRING ----------
        query = parse_qs(scope.get("query_string", b"").decode())
        token = query.get("token", [None])[0]

        # ---------- 2. (OPTIONAL) FROM COOKIE ----------
        # headers = dict(scope["headers"])
        # if b"cookie" in headers:
        #     from http.cookies import SimpleCookie
        #     cookie = SimpleCookie()
        #     cookie.load(headers[b"cookie"].decode())
        #     token = cookie.get("access_token").value if cookie.get("access_token") else token

        # ---------- 3. SET USER ----------
        scope["user"] = await get_user_from_token(token) if token else AnonymousUser()

        return await super().__call__(scope, receive, send)