from django.db.models import Count
from django.shortcuts import get_object_or_404

from ..models import ChatRoom, Message


def get_room_for(user, room_id):
    room = get_object_or_404(ChatRoom, id=room_id)
    if not room.participants.filter(id=user.pk).exists():
        # Raised as PermissionError and mapped to 403 by the exception handler; it
        # used to be swallowed by a bare `except Exception` and returned as a 500.
        raise PermissionError("You are not a participant of this chat room.")
    return room


def message_list_view(room_id, user):
    get_room_for(user, room_id)
    return (
        Message.objects.filter(chat_room_id=room_id)
        # Without this the serializer issues two queries per message to build the
        # sender block — 60 extra queries for a single 30-message page.
        .with_sender()
        .annotate(read_by_total=Count("read_by", distinct=True))
    )
