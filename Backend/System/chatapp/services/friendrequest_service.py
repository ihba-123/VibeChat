from django.db import IntegrityError
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError

from authentication.models import User

from .. import realtime
from ..models import FriendRequest, Profile
from . import blocking


def send_friend_request(request_user, to_user_id):
    try:
        to_user_id = int(to_user_id)
    except (TypeError, ValueError):
        raise ValidationError({"to_user_id": "A valid user id is required."})

    if to_user_id == request_user.pk:
        raise ValidationError("You cannot send a friend request to yourself.")

    to_user = get_object_or_404(User, id=to_user_id, is_active=True)

    if to_user_id in blocking.blocked_ids_for(request_user):
        raise ValidationError("You cannot send a friend request to this person.")

    profile = Profile.for_user(request_user)
    if profile.friends.filter(pk=to_user.pk).exists():
        raise ValidationError("You are already friends.")

    # Both directions, because `unique_together` is per direction and the pair can
    # hold a settled row each way.
    history = list(
        FriendRequest.objects.filter(
            Q(from_user=request_user, to_user=to_user)
            | Q(from_user=to_user, to_user=request_user)
        )
    )

    pending = next((row for row in history if row.status == "pending"), None)
    if pending:
        raise ValidationError(
            "A friend request is already pending between you."
            if pending.from_user_id == request_user.pk
            else "This person already sent you a request — accept it instead."
        )

    # Nothing is pending, so every surviving row is settled: rejected, or accepted
    # for a friendship that has since been removed. Neither still describes
    # anything, and a settled row addressed *to* this user used to be answered with
    # "accept it instead" — pointing at a request that no longer exists anywhere in
    # the UI, which left whoever had accepted the original request permanently
    # unable to re-add the other person. Clear them and start over.
    theirs = [row.pk for row in history if row.from_user_id != request_user.pk]
    if theirs:
        FriendRequest.objects.filter(pk__in=theirs).delete()

    # This user's own settled row is reopened rather than replaced: recreating it
    # is what `unique_together` would block outright.
    mine = next((row for row in history if row.from_user_id == request_user.pk), None)
    if mine:
        mine.status = "pending"
        mine.save(update_fields=["status"])
        friend_request = mine
    else:
        try:
            friend_request = FriendRequest.objects.create(
                from_user=request_user, to_user=to_user
            )
        except IntegrityError:
            # Lost a race with a concurrent identical request.
            raise ValidationError("A friend request is already pending between you.")

    realtime.notify_friend_request(to_user.pk, friend_request.pk, request_user)
    return friend_request


def friend_request_queryset(user, direction=None, status="pending"):
    queryset = FriendRequest.objects.select_related(
        "from_user", "from_user__profile", "to_user", "to_user__profile"
    )
    if direction == "incoming":
        queryset = queryset.filter(to_user=user)
    elif direction == "outgoing":
        queryset = queryset.filter(from_user=user)
    else:
        queryset = queryset.filter(Q(to_user=user) | Q(from_user=user))

    if status and status != "all":
        queryset = queryset.filter(status=status)
    return queryset.order_by("-created_at")
