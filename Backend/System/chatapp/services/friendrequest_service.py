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

    existing = FriendRequest.objects.filter(
        Q(from_user=request_user, to_user=to_user)
        | Q(from_user=to_user, to_user=request_user)
    ).first()

    if existing:
        if existing.status == "pending":
            raise ValidationError(
                "A friend request is already pending between you."
                if existing.from_user_id == request_user.pk
                else "This person already sent you a request — accept it instead."
            )
        # A previously rejected request may be retried by reopening the same row,
        # which the unique_together constraint would otherwise block outright.
        if existing.from_user_id == request_user.pk:
            existing.status = "pending"
            existing.save(update_fields=["status"])
            realtime.notify_friend_request(to_user.pk, existing.pk, request_user)
            return existing
        raise ValidationError("This person already sent you a request — accept it instead.")

    try:
        friend_request = FriendRequest.objects.create(from_user=request_user, to_user=to_user)
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
