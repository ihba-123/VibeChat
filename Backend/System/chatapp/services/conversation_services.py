"""Conversation sidebar data.

The list needs, per room: the other members, the newest message and the viewer's
unread count. Done naively that is three-plus queries *per row*; here it is a
fixed four queries for the whole page regardless of how many conversations the
user has.
"""

from django.db.models import Count, F, Max, Prefetch

from authentication.models import User

from ..models import ChatRoom, Message


def conversation_queryset(user):
    """Rooms the user belongs to, newest activity first."""
    return (
        ChatRoom.objects.filter(participants=user)
        .prefetch_related(
            Prefetch("participants", queryset=User.objects.select_related("profile"))
        )
        .annotate(last_message_time=Max("messages__timestamp"))
        # A room with no messages yet still has to appear, hence nulls_last.
        .order_by(F("last_message_time").desc(nulls_last=True), "-created_at")
    )


def attach_previews(rooms, user):
    """Populate ``last_message_obj`` and ``unread_total`` on the given rooms."""
    rooms = list(rooms)
    if not rooms:
        return rooms

    room_ids = [room.pk for room in rooms]

    # DISTINCT ON gives the newest row per room in a single indexed pass. The
    # project targets PostgreSQL, where this is supported.
    latest = (
        Message.objects.filter(chat_room_id__in=room_ids)
        .with_sender()
        .order_by("chat_room_id", "-timestamp", "-id")
        .distinct("chat_room_id")
    )
    latest_by_room = {message.chat_room_id: message for message in latest}

    unread_rows = (
        Message.objects.filter(chat_room_id__in=room_ids)
        .unread_for(user)
        .values("chat_room_id")
        .annotate(total=Count("id", distinct=True))
    )
    unread_by_room = {row["chat_room_id"]: row["total"] for row in unread_rows}

    for room in rooms:
        room.last_message_obj = latest_by_room.get(room.pk)
        room.unread_total = unread_by_room.get(room.pk, 0)
    return rooms


def total_unread(user) -> int:
    """Unread messages across every conversation, for the tab badge."""
    return Message.objects.filter(chat_room__participants=user).unread_for(user).count()
