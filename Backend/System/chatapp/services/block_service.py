from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError

from authentication.models import User

from .. import realtime
from ..models import BlockedUser, ChatRoom
from . import blocking


def block_user_service(blocker, blocked_id):
    try:
        blocked_id = int(blocked_id)
    except (TypeError, ValueError):
        raise ValidationError("Invalid user id.")

    if blocker.pk == blocked_id:
        raise ValidationError("You cannot block yourself.")

    blocked_user = get_object_or_404(User, id=blocked_id)

    # Write first, then announce. The previous order broadcast the block (which
    # closes both sockets) *before* the row was created, so a failure at the
    # database step kicked two people out of a conversation that was never blocked.
    _, created = BlockedUser.objects.get_or_create(blocker=blocker, blocked=blocked_user)

    blocking.invalidate(blocker.pk, blocked_id)

    # Looked up without creating: presence and block used to instantiate a room as
    # a side effect just to name a group.
    room = ChatRoom.find_private_chat(blocker, blocked_user)
    realtime.notify_block(blocker.pk, blocked_id, room.pk if room else None, blocked=True)

    return created, blocked_user


def unblock_user_service(blocker, blocked_id):
    try:
        blocked_id = int(blocked_id)
    except (TypeError, ValueError):
        raise ValidationError("Invalid user id.")

    if blocker.pk == blocked_id:
        raise ValidationError("Invalid operation.")

    deleted_count, _ = BlockedUser.objects.filter(
        blocker=blocker, blocked_id=blocked_id
    ).delete()

    if deleted_count:
        blocking.invalidate(blocker.pk, blocked_id)
        room = ChatRoom.objects.filter(
            is_group=False, participants=blocker
        ).filter(participants__id=blocked_id).first()
        realtime.notify_block(
            blocker.pk, blocked_id, room.pk if room else None, blocked=False
        )

    return deleted_count


def blocked_queryset(user):
    return BlockedUser.objects.filter(blocker=user).select_related(
        "blocked", "blocked__profile"
    )
