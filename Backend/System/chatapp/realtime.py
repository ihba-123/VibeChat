"""Single definition of every realtime event.

Both the WebSocket consumer and the HTTP service layer publish through here, so
the two paths cannot drift apart — previously the attachment upload broadcast a
payload with a different shape (and still-encrypted text) from the one the socket
sent for an ordinary message.

Payloads are built by pure ``*_event`` helpers and shipped by either ``publish``
(from synchronous request handlers) or ``apublish`` (from the consumer), because
``async_to_sync`` cannot be called from inside a running event loop.
"""

import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)


def room_group(room_id) -> str:
    return f"chat_{room_id}"


def user_group(user_id) -> str:
    return f"user_{user_id}"


# Channels dispatches an event whose type is "chat.message" to the consumer
# method `chat_message`.
EVENT_MESSAGE_NEW = "chat.message"
EVENT_MESSAGE_READ = "chat.read"
EVENT_TYPING = "chat.typing"
EVENT_PRESENCE = "presence.update"
EVENT_CONVERSATION_NEW = "conversation.new"
EVENT_CONVERSATION_UPDATE = "conversation.update"
EVENT_CONVERSATION_REMOVED = "conversation.removed"
EVENT_FRIEND_REQUEST = "friend.request"
EVENT_FRIEND_UPDATE = "friend.update"
EVENT_BLOCK = "block.event"


# ---------------------------------------------------------------- transports

def publish(group: str, payload: dict) -> None:
    """Fire-and-forget group send from synchronous code.

    Swallows transport errors on purpose: a dead Redis must not turn a message
    that was already committed to the database into a 500 for the sender.
    """
    layer = get_channel_layer()
    if layer is None:  # pragma: no cover - misconfiguration
        logger.error("No channel layer configured; dropping %s", payload.get("type"))
        return
    try:
        async_to_sync(layer.group_send)(group, payload)
    except Exception:
        logger.exception("Failed to publish %s to %s", payload.get("type"), group)


async def apublish(group: str, payload: dict) -> None:
    """Same contract as ``publish``, for use inside the event loop."""
    layer = get_channel_layer()
    if layer is None:  # pragma: no cover - misconfiguration
        logger.error("No channel layer configured; dropping %s", payload.get("type"))
        return
    try:
        await layer.group_send(group, payload)
    except Exception:
        logger.exception("Failed to publish %s to %s", payload.get("type"), group)


def publish_many(groups, payload: dict) -> None:
    for group in groups:
        publish(group, payload)


async def apublish_many(groups, payload: dict) -> None:
    for group in groups:
        await apublish(group, payload)


# ------------------------------------------------------------ event payloads

def message_event(room_id, message_payload, *, client_id=None) -> dict:
    return {
        "type": EVENT_MESSAGE_NEW,
        "room_id": int(room_id),
        "message": message_payload,
        "client_id": client_id,
    }


def read_event(room_id, user_id, message_ids) -> dict:
    return {
        "type": EVENT_MESSAGE_READ,
        "room_id": int(room_id),
        "user_id": user_id,
        "message_ids": [int(mid) for mid in message_ids],
    }


def typing_event(room_id, user_id, name, is_typing: bool) -> dict:
    return {
        "type": EVENT_TYPING,
        "room_id": int(room_id),
        "user_id": user_id,
        "name": name,
        "is_typing": bool(is_typing),
    }


def presence_event(user_id, is_online: bool) -> dict:
    return {"type": EVENT_PRESENCE, "user_id": user_id, "is_online": bool(is_online)}


def conversation_event(room_id) -> dict:
    return {"type": EVENT_CONVERSATION_NEW, "room_id": int(room_id)}


def conversation_update_event(room_id, name=None) -> dict:
    """A group's name or membership changed."""
    return {"type": EVENT_CONVERSATION_UPDATE, "room_id": int(room_id), "name": name}


def conversation_removed_event(room_id) -> dict:
    """The recipient is no longer a member of this conversation."""
    return {"type": EVENT_CONVERSATION_REMOVED, "room_id": int(room_id)}


def friend_request_event(request_id, from_user) -> dict:
    return {
        "type": EVENT_FRIEND_REQUEST,
        "request_id": request_id,
        "from_user": {
            "user_id": from_user.pk,
            "name": from_user.name,
            "email": from_user.email,
        },
    }


def friend_update_event(request_id, status, by_user) -> dict:
    return {
        "type": EVENT_FRIEND_UPDATE,
        "request_id": request_id,
        "status": status,
        "by_user": {"user_id": by_user.pk, "name": by_user.name},
    }


def block_event(blocker_id, blocked_id, room_id, *, blocked: bool) -> dict:
    return {
        "type": EVENT_BLOCK,
        "blocker_id": blocker_id,
        "blocked_id": blocked_id,
        "room_id": int(room_id) if room_id else None,
        "blocked": bool(blocked),
    }


# ------------------------------------------------- synchronous convenience API

def broadcast_message(room_id, message_payload, *, client_id=None) -> None:
    publish(room_group(room_id), message_event(room_id, message_payload, client_id=client_id))


def broadcast_read(room_id, user_id, message_ids) -> None:
    publish(room_group(room_id), read_event(room_id, user_id, message_ids))


def broadcast_presence(target_user_ids, user_id, is_online: bool) -> None:
    publish_many((user_group(t) for t in target_user_ids), presence_event(user_id, is_online))


def notify_conversation_created(user_ids, room_id) -> None:
    """Tell each member to pull the new conversation and join its group."""
    publish_many((user_group(u) for u in user_ids), conversation_event(room_id))


def notify_conversation_updated(room_id, name=None) -> None:
    """Tell everyone still in the room to re-read it."""
    publish(room_group(room_id), conversation_update_event(room_id, name))


def notify_conversation_removed(user_id, room_id) -> None:
    """Tell one person their membership ended, so their client can close it.

    Addressed to the user group rather than the room: by the time this is sent
    they are no longer a participant, and every other member has already had the
    room-wide update.
    """
    publish(user_group(user_id), conversation_removed_event(room_id))


def notify_friend_request(target_user_id, request_id, from_user) -> None:
    publish(user_group(target_user_id), friend_request_event(request_id, from_user))


def notify_friend_update(target_user_id, request_id, status, by_user) -> None:
    publish(user_group(target_user_id), friend_update_event(request_id, status, by_user))


def notify_block(blocker_id, blocked_id, room_id, *, blocked: bool) -> None:
    payload = block_event(blocker_id, blocked_id, room_id, blocked=blocked)
    # Addressed to the two people involved rather than to the room, so an
    # unrelated group conversation is not disturbed by a 1:1 block.
    publish_many([user_group(blocker_id), user_group(blocked_id)], payload)
