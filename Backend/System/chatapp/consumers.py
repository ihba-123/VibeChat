"""WebSocket consumers.

``StreamConsumer`` is the one the app uses: a single multiplexed connection per
user that joins every room the user belongs to. That is the difference between one
socket per signed-in user and one socket per open conversation, and it is also
what lets the conversation list, unread badges and presence dots stay live while
the user is looking at a different chat.

``ChatConsumer`` keeps the original single-room URL working; both share every
handler below, so the wire format is identical.
"""

import logging
import time
from collections import deque

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.db.models import Count, F

from . import presence, realtime
from .models import ChatRoom, Message, Profile
from .serializer import ChatUserSerializer
from .services import blocking

logger = logging.getLogger(__name__)

# Close codes the client distinguishes between.
CLOSE_UNAUTHENTICATED = 4401
CLOSE_FORBIDDEN = 4403
CLOSE_NOT_FOUND = 4404
CLOSE_BLOCKED = 4405

MAX_CONTENT_LENGTH = 5000

# Per-connection send budget. Stops a single runaway or malicious client from
# saturating the channel layer for everyone else in the room.
RATE_LIMIT_MESSAGES = 25
RATE_LIMIT_WINDOW_SECONDS = 10


class BaseChatConsumer(AsyncJsonWebsocketConsumer):
    # ------------------------------------------------------------- lifecycle

    async def connect(self):
        self.user = self.scope.get("user")
        self.joined_groups = set()
        self.room_ids = set()
        self.blocked_ids = set()
        self.presence_registered = False
        self._send_history = deque()

        if not self.user or not self.user.is_authenticated:
            # Nothing has been registered yet, so disconnect() has nothing to undo.
            await self.close(code=CLOSE_UNAUTHENTICATED)
            return

        room_ids = await self.resolve_rooms()
        if room_ids is None:
            # resolve_rooms() already closed with a specific code.
            return

        self.room_ids = set(room_ids)
        self.blocked_ids = await self._load_blocked_ids()

        subprotocol = None
        requested = self.scope.get("subprotocols") or []
        if requested:
            # Must echo one of the offered protocols or the browser drops the
            # connection right after the handshake.
            subprotocol = requested[0]
        await self.accept(subprotocol=subprotocol)

        await self._join(realtime.user_group(self.user.pk))
        for room_id in self.room_ids:
            await self._join(realtime.room_group(room_id))

        await self._activate_presence()

        await self.send_json(
            {
                "type": "ready",
                "user_id": self.user.pk,
                "rooms": sorted(self.room_ids),
                "blocked_ids": sorted(self.blocked_ids),
            }
        )

    async def disconnect(self, close_code):
        # Guarded throughout: connect() may have rejected before any of this was
        # set up, and the old implementation crashed here on AnonymousUser while
        # also marking a still-connected user offline.
        for group in list(getattr(self, "joined_groups", ())):
            await self.channel_layer.group_discard(group, self.channel_name)
        self.joined_groups = set()

        if getattr(self, "presence_registered", False):
            self.presence_registered = False
            went_offline = await database_sync_to_async(presence.unregister_connection)(self.user.pk)
            if went_offline:
                await self._set_db_online(False)
                audience = await self._presence_audience()
                await realtime.apublish_many(
                    [realtime.user_group(uid) for uid in audience],
                    realtime.presence_event(self.user.pk, False),
                )

    async def _join(self, group: str):
        await self.channel_layer.group_add(group, self.channel_name)
        self.joined_groups.add(group)

    async def _activate_presence(self):
        came_online = await database_sync_to_async(presence.register_connection)(self.user.pk)
        self.presence_registered = True
        if came_online:
            await self._set_db_online(True)
        audience = await self._presence_audience()
        await realtime.apublish_many(
            [realtime.user_group(uid) for uid in audience],
            realtime.presence_event(self.user.pk, True),
        )

    async def resolve_rooms(self):
        """Room ids this connection should join, or None after closing."""
        raise NotImplementedError

    # --------------------------------------------------------------- inbound

    async def receive_json(self, content, **kwargs):
        if not isinstance(content, dict):
            await self._error("Expected a JSON object.", "bad_request")
            return

        handlers = {
            "message.send": self.on_message_send,
            "message.read": self.on_message_read,
            "typing": self.on_typing,
            "room.subscribe": self.on_room_subscribe,
            "ping": self.on_ping,
        }
        handler = handlers.get(content.get("type"))
        if handler is None:
            await self._error(f"Unknown message type: {content.get('type')!r}", "unknown_type")
            return

        try:
            await handler(content)
        except Exception:
            logger.exception("WebSocket handler failed for %s", content.get("type"))
            await self._error("Could not process that request.", "server_error")

    async def on_ping(self, content):
        # Application-level heartbeat: lets the client notice a half-open socket
        # that TCP still believes is alive.
        await self.send_json({"type": "pong", "ts": content.get("ts")})

    async def on_message_send(self, content):
        room_id = await self._authorized_room(content.get("room_id"))
        if room_id is None:
            return

        if not self._within_rate_limit():
            await self._error("You are sending messages too quickly.", "rate_limited")
            return

        text = content.get("content")
        text = text.strip() if isinstance(text, str) else ""
        if not text:
            # Files go through the HTTP upload endpoint; the socket carries text.
            await self._error("Message text is required.", "empty_message")
            return
        if len(text) > MAX_CONTENT_LENGTH:
            await self._error(
                f"Message is too long ({MAX_CONTENT_LENGTH} characters max).", "too_long"
            )
            return

        if await self._is_blocked_in(room_id):
            await self._error(
                "You cannot send messages in this conversation.", "blocked"
            )
            return

        payload = await self._save_message(room_id, text)
        await realtime.apublish(
            realtime.room_group(room_id),
            realtime.message_event(room_id, payload, client_id=content.get("client_id")),
        )

    async def on_message_read(self, content):
        room_id = await self._authorized_room(content.get("room_id"))
        if room_id is None:
            return

        raw_ids = content.get("message_ids")
        if raw_ids is None and content.get("message_id") is not None:
            raw_ids = [content["message_id"]]

        message_ids = None
        if raw_ids is not None:
            if not isinstance(raw_ids, list):
                await self._error("message_ids must be a list.", "bad_request")
                return
            message_ids = []
            for value in raw_ids[:500]:
                try:
                    message_ids.append(int(value))
                except (TypeError, ValueError):
                    await self._error("message_ids must be integers.", "bad_request")
                    return

        marked = await self._mark_read(room_id, message_ids)
        if marked:
            await realtime.apublish(
                realtime.room_group(room_id),
                realtime.read_event(room_id, self.user.pk, marked),
            )

    async def on_typing(self, content):
        room_id = await self._authorized_room(content.get("room_id"))
        if room_id is None:
            return
        if await self._is_blocked_in(room_id):
            return
        await realtime.apublish(
            realtime.room_group(room_id),
            realtime.typing_event(
                room_id, self.user.pk, self.user.name, bool(content.get("is_typing"))
            ),
        )

    async def on_room_subscribe(self, content):
        """Join a room opened after the connection was established."""
        try:
            room_id = int(content.get("room_id"))
        except (TypeError, ValueError):
            await self._error("A valid room_id is required.", "bad_request")
            return

        if room_id in self.room_ids:
            await self.send_json({"type": "subscribed", "room_id": room_id})
            return

        if not await self._is_participant(room_id):
            await self._error("You are not a member of that conversation.", "forbidden")
            return

        self.room_ids.add(room_id)
        await self._join(realtime.room_group(room_id))
        await self.send_json({"type": "subscribed", "room_id": room_id})

    # -------------------------------------------------------------- outbound
    # Channel-layer events. Names are the dotted event types with dots replaced
    # by underscores, which is how Channels dispatches them.

    async def chat_message(self, event):
        sender_id = (event.get("message") or {}).get("sender_id")
        if sender_id in self.blocked_ids:
            return
        await self.send_json(
            {
                "type": "message.new",
                "room_id": event["room_id"],
                "message": event["message"],
                # Echoed back so the sender can swap its optimistic bubble for the
                # stored row instead of showing the message twice.
                "client_id": event.get("client_id"),
            }
        )

    async def chat_read(self, event):
        await self.send_json(
            {
                "type": "message.read",
                "room_id": event["room_id"],
                "user_id": event["user_id"],
                "message_ids": event["message_ids"],
            }
        )

    async def chat_typing(self, event):
        if event["user_id"] == self.user.pk or event["user_id"] in self.blocked_ids:
            return
        await self.send_json(
            {
                "type": "typing",
                "room_id": event["room_id"],
                "user_id": event["user_id"],
                "name": event["name"],
                "is_typing": event["is_typing"],
            }
        )

    async def presence_update(self, event):
        await self.send_json(
            {
                "type": "presence",
                "user_id": event["user_id"],
                "is_online": event["is_online"],
            }
        )

    async def conversation_new(self, event):
        room_id = event["room_id"]
        if room_id not in self.room_ids and await self._is_participant(room_id):
            self.room_ids.add(room_id)
            await self._join(realtime.room_group(room_id))
        await self.send_json({"type": "conversation.new", "room_id": room_id})

    async def conversation_update(self, event):
        await self.send_json(
            {
                "type": "conversation.update",
                "room_id": event["room_id"],
                "name": event.get("name"),
            }
        )

    async def conversation_removed(self, event):
        # Leave the room group as well as telling the client: without this the
        # connection keeps receiving messages for a conversation the user is no
        # longer a member of, until they happen to reconnect.
        room_id = event["room_id"]
        group = realtime.room_group(room_id)
        self.room_ids.discard(room_id)
        if group in self.joined_groups:
            await self.channel_layer.group_discard(group, self.channel_name)
            self.joined_groups.discard(group)
        await self.send_json({"type": "conversation.removed", "room_id": room_id})

    async def friend_request(self, event):
        await self.send_json(
            {
                "type": "friend.request",
                "request_id": event["request_id"],
                "from_user": event["from_user"],
            }
        )

    async def friend_update(self, event):
        await self.send_json(
            {
                "type": "friend.update",
                "request_id": event["request_id"],
                "status": event["status"],
                "by_user": event["by_user"],
            }
        )

    async def block_event(self, event):
        # Refresh the cached set so message filtering takes effect immediately on
        # this live connection rather than after a reconnect.
        self.blocked_ids = await self._load_blocked_ids(refresh=True)
        await self.send_json(
            {
                "type": "block",
                "blocker_id": event["blocker_id"],
                "blocked_id": event["blocked_id"],
                "room_id": event.get("room_id"),
                "blocked": event["blocked"],
            }
        )

    # ----------------------------------------------------------------- utils

    def _within_rate_limit(self) -> bool:
        now = time.monotonic()
        history = self._send_history
        cutoff = now - RATE_LIMIT_WINDOW_SECONDS
        while history and history[0] < cutoff:
            history.popleft()
        if len(history) >= RATE_LIMIT_MESSAGES:
            return False
        history.append(now)
        return True

    async def _authorized_room(self, raw_room_id):
        """Validate and authorise a room id from client input, or None."""
        try:
            room_id = int(raw_room_id)
        except (TypeError, ValueError):
            await self._error("A valid room_id is required.", "bad_request")
            return None

        if room_id in self.room_ids:
            return room_id

        # Not in the verified set — could be a room joined elsewhere since connect.
        if await self._is_participant(room_id):
            self.room_ids.add(room_id)
            await self._join(realtime.room_group(room_id))
            return room_id

        await self._error("You are not a member of that conversation.", "forbidden")
        return None

    async def _is_blocked_in(self, room_id) -> bool:
        if not self.blocked_ids:
            return False
        others = await self._room_participant_ids(room_id)
        return bool(others & self.blocked_ids)

    async def _error(self, detail: str, code: str = "error"):
        await self.send_json({"type": "error", "detail": detail, "code": code})

    # -------------------------------------------------------- database access

    @database_sync_to_async
    def _load_blocked_ids(self, refresh: bool = False):
        return blocking.blocked_ids_for(self.user, refresh=refresh)

    @database_sync_to_async
    def _my_room_ids(self):
        return list(self.user.chat_rooms.values_list("id", flat=True))

    @database_sync_to_async
    def _is_participant(self, room_id):
        return ChatRoom.objects.filter(id=room_id, participants=self.user).exists()

    @database_sync_to_async
    def _room_exists(self, room_id):
        return ChatRoom.objects.filter(id=room_id).exists()

    @database_sync_to_async
    def _room_participant_ids(self, room_id):
        return set(
            ChatRoom.objects.filter(id=room_id)
            .values_list("participants__id", flat=True)
        ) - {self.user.pk, None}

    @database_sync_to_async
    def _presence_audience(self):
        """Who should be told when this user comes or goes.

        Friends plus everyone sharing a conversation, so both the people list and
        the conversation sidebar update without polling.
        """
        profile = Profile.for_user(self.user)
        ids = set(profile.friends.values_list("id", flat=True))
        ids.update(
            ChatRoom.objects.filter(participants=self.user)
            .values_list("participants__id", flat=True)
        )
        ids.discard(self.user.pk)
        ids.discard(None)
        return ids

    @database_sync_to_async
    def _set_db_online(self, status: bool):
        # Written through the queryset so no other field on the row is touched.
        Profile.objects.filter(user=self.user).update(is_online=status)

    @database_sync_to_async
    def _save_message(self, room_id, text):
        message = Message.objects.create(
            chat_room_id=room_id, sender=self.user, content=text
        )
        # The sender has necessarily seen their own message.
        message.read_by.add(self.user)
        message.sender = self.user
        return ChatUserSerializer(message).data

    @database_sync_to_async
    def _mark_read(self, room_id, message_ids=None):
        """Mark messages read for this user; returns the ids actually changed."""
        queryset = Message.objects.filter(chat_room_id=room_id).unread_for(self.user)
        if message_ids is not None:
            queryset = queryset.filter(id__in=message_ids)

        # Materialise the ids *before* writing. The old code called .update() and
        # then iterated the same queryset, which by then matched nothing, so
        # read_by was never populated.
        pending = list(queryset.values_list("id", flat=True)[:500])
        if not pending:
            return []

        through = Message.read_by.through
        through.objects.bulk_create(
            [through(message_id=mid, user_id=self.user.pk) for mid in pending],
            ignore_conflicts=True,
        )

        # is_read is a single flag shared by every recipient, so it may only be set
        # once everyone other than the sender has read the message.
        fully_read = (
            Message.objects.filter(id__in=pending, is_read=False)
            .annotate(
                readers=Count("read_by", distinct=True),
                members=Count("chat_room__participants", distinct=True),
            )
            .filter(readers__gte=F("members"))
            .values_list("id", flat=True)
        )
        fully_read_ids = list(fully_read)
        if fully_read_ids:
            Message.objects.filter(id__in=fully_read_ids).update(is_read=True)

        return pending


class StreamConsumer(BaseChatConsumer):
    """One connection per signed-in user, covering every conversation."""

    async def resolve_rooms(self):
        return await self._my_room_ids()


class ChatConsumer(BaseChatConsumer):
    """Single-room connection, kept for the original ``ws/chat/<room_id>/`` URL."""

    async def resolve_rooms(self):
        try:
            room_id = int(self.scope["url_route"]["kwargs"]["room_id"])
        except (KeyError, TypeError, ValueError):
            await self.close(code=CLOSE_NOT_FOUND)
            return None

        # Authorisation is checked before any lookup that can raise. The previous
        # version called get_object_or_404 first, so an unknown room id raised
        # Http404 inside the consumer instead of closing cleanly.
        if not await self._is_participant(room_id):
            await self.close(
                code=CLOSE_NOT_FOUND if not await self._room_exists(room_id) else CLOSE_FORBIDDEN
            )
            return None

        blocked = await self._load_blocked_ids()
        participants = await self._room_participant_ids(room_id)
        if participants & blocked:
            await self.close(code=CLOSE_BLOCKED)
            return None

        return [room_id]
