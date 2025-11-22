from django.shortcuts import get_object_or_404
from authentication.models import User
from ..models import BlockedUser
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from chatapp.models import ChatRoom
\
def block_user_service(blocker, blocked_id):

    if blocker.id == blocked_id:
        raise ValueError("You cannot block yourself.")

    channel_layer = get_channel_layer()

    private_room = ChatRoom.get_private_chat(blocker, get_object_or_404(User, id=blocked_id))

    async_to_sync(channel_layer.group_send)(
        f"chat_{private_room.id}",
        {
            "type": "block_event",
            "blocked_id": blocked_id,
            "blocker_id": blocker.id
        }
    )
    # Fetch the user to block
    blocked_user = get_object_or_404(User, id=blocked_id)

    # Create or get existing block
    block, created = BlockedUser.objects.get_or_create(
        blocker=blocker,
        blocked=blocked_user
    )

    return created, blocked_user


def unblock_user_service(blocker, blocked_id):

    if blocker.id == blocked_id:
        raise ValueError("Invalid operation.")

    deleted_count, _ = BlockedUser.objects.filter(
        blocker=blocker,
        blocked_id=blocked_id
    ).delete()

    return deleted_count
