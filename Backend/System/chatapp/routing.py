# chat/routing.py
from django.urls import re_path

from . import consumers

# The trailing slash is optional in every pattern. Django's APPEND_SLASH redirect
# only applies to HTTP, so a WebSocket handshake to a path that differs by one
# slash does not get corrected — URLRouter raises "No route found for path" and the
# connection dies with no useful signal to the client. Accepting both spellings
# removes a whole class of hard-to-diagnose failure.
websocket_urlpatterns = [
    # Multiplexed per-user stream: one connection carries every conversation the
    # user belongs to, plus presence, typing and notifications.
    re_path(r'^ws/stream/?$', consumers.StreamConsumer.as_asgi()),
    # Original single-room endpoint, still supported.
    re_path(r'^ws/chat/(?P<room_id>\d+)/?$', consumers.ChatConsumer.as_asgi()),
]
