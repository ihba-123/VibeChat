from .. import realtime
from ..serializer import ChatUserSerializer
from . import blocking


def attachment_services(user, chat_room, serializer):
    """Persist an uploaded message and broadcast it to the room."""
    other_ids = set(
        chat_room.participants.exclude(id=user.pk).values_list("id", flat=True)
    )
    if other_ids & blocking.blocked_ids_for(user):
        raise PermissionError("You cannot send messages in this conversation.")

    message = serializer.save(sender=user, chat_room=chat_room)
    message.read_by.add(user)

    # Serialised with the same serializer the socket uses, so both paths put an
    # identically shaped message on the wire. The old version hand-built a dict
    # containing `message.content`, i.e. the still-encrypted ciphertext.
    payload = ChatUserSerializer(message).data
    realtime.broadcast_message(chat_room.pk, payload)
    return message
