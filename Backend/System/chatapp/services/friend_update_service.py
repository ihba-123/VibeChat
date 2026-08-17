from django.db import transaction
from rest_framework.exceptions import ValidationError

from .. import realtime
from ..models import ChatRoom, FriendRequest, Profile

VALID_ACTIONS = {"accept", "reject"}


def friend_update_status(request_user, request_id, action):
    if action not in VALID_ACTIONS:
        raise ValidationError({"action": 'Use "accept" or "reject".'})

    with transaction.atomic():
        # Locked for the duration so two clicks on Accept cannot both pass the
        # pending check and add the friendship twice.
        friend_request = (
            FriendRequest.objects.select_for_update()
            .select_related("from_user", "to_user")
            .filter(id=request_id, to_user=request_user)
            .first()
        )
        if friend_request is None:
            raise ValidationError("Friend request not found.")
        if friend_request.status != "pending":
            raise ValidationError("This friend request has already been responded to.")

        friend_request.status = "accepted" if action == "accept" else "rejected"
        friend_request.save(update_fields=["status"])

        room = None
        if action == "accept":
            Profile.for_user(request_user).add_friend(friend_request.from_user)
            # Give the pair a conversation immediately so the new friend shows up
            # in both sidebars without an extra round trip.
            room = ChatRoom.get_private_chat(request_user, friend_request.from_user)

    realtime.notify_friend_update(
        friend_request.from_user_id, friend_request.pk, friend_request.status, request_user
    )
    if room is not None:
        realtime.notify_conversation_created(
            [request_user.pk, friend_request.from_user_id], room.pk
        )

    return friend_request, friend_request.status
