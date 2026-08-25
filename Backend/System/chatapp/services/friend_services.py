from django.db import transaction
from django.db.models import Q
from rest_framework.exceptions import ValidationError

from ..models import FriendRequest, Profile


def friend_profiles(user, search=None):
    """The user's friends as Profile rows, ready for UserSummarySerializer."""
    profile = Profile.for_user(user)
    queryset = Profile.objects.filter(user__in=profile.friends.all()).select_related("user")
    if search:
        queryset = queryset.filter(user__name__icontains=search)
    return queryset.order_by("user__name", "user__id")


def remove_friend(user, friend_user_id):
    try:
        friend_user_id = int(friend_user_id)
    except (TypeError, ValueError):
        raise ValidationError("A valid user id is required.")

    profile = Profile.for_user(user)
    friend = profile.friends.filter(pk=friend_user_id).first()
    if friend is None:
        raise ValidationError("You are not friends with this person.")

    with transaction.atomic():
        profile.remove_friend(friend)
        # The accepted request that created this friendship goes with it. Left
        # behind, it is a row saying "accepted" about two people who are no longer
        # friends, and `send_friend_request` reads it as history that still counts —
        # so the pair could never be re-added. The conversation and its messages are
        # deliberately untouched: unfriending is not deleting the chat.
        FriendRequest.objects.filter(
            Q(from_user=user, to_user=friend) | Q(from_user=friend, to_user=user)
        ).delete()

    return friend
