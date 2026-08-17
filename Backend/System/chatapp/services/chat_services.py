from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError

from authentication.models import User

from .. import realtime
from ..models import ChatRoom
from . import blocking

MAX_GROUP_PARTICIPANTS = 200


def _clean_participant_ids(raw, user):
    """Validate the requested participants and return them as a de-duplicated list."""
    if raw is None:
        raise ValidationError({"participant_ids": "This field is required."})
    if isinstance(raw, (str, int)):
        # Tolerate a single id so `len()` is never taken on a string, which used to
        # make "abc" look like a three-participant request.
        raw = [raw]
    if not isinstance(raw, (list, tuple)):
        raise ValidationError({"participant_ids": "Expected a list of user ids."})

    ids = []
    for value in raw:
        try:
            ids.append(int(value))
        except (TypeError, ValueError):
            raise ValidationError({"participant_ids": f"{value!r} is not a valid user id."})

    ids = [i for i in dict.fromkeys(ids) if i != user.pk]
    if not ids:
        raise ValidationError({"participant_ids": "Add at least one other person."})
    if len(ids) > MAX_GROUP_PARTICIPANTS:
        raise ValidationError(
            {"participant_ids": f"A group cannot exceed {MAX_GROUP_PARTICIPANTS} members."}
        )

    found = set(User.objects.filter(id__in=ids, is_active=True).values_list("id", flat=True))
    missing = [i for i in ids if i not in found]
    if missing:
        raise ValidationError({"participant_ids": f"Unknown user id(s): {missing}."})
    return ids


def create_chat_room(user, participant_ids, name, is_group=False):
    """Get or create a conversation.

    Returns ``(room, created)``. An existing private chat is *returned*, not
    rejected: the caller's intent is "open a conversation with this person", and
    the previous 400 response left the client with no room id to navigate to.
    """
    ids = _clean_participant_ids(participant_ids, user)
    blocked = blocking.blocked_ids_for(user)

    if not is_group:
        if len(ids) != 1:
            raise ValidationError(
                {"participant_ids": "A direct conversation has exactly one other person."}
            )
        other = get_object_or_404(User, id=ids[0], is_active=True)
        if other.pk in blocked:
            raise ValidationError(
                {"participant_ids": "You cannot start a conversation with this person."}
            )

        existing = ChatRoom.find_private_chat(user, other)
        if existing:
            return existing, False

        room = ChatRoom.get_private_chat(user, other)
        realtime.notify_conversation_created([user.pk, other.pk], room.pk)
        return room, True

    clean_name = (name or "").strip()
    if not clean_name:
        raise ValidationError({"name": "A group needs a name."})
    if len(clean_name) > 255:
        raise ValidationError({"name": "Group name is too long (255 characters max)."})

    blocked_members = [i for i in ids if i in blocked]
    if blocked_members:
        raise ValidationError(
            {"participant_ids": "Remove blocked people before creating the group."}
        )

    wanted = sorted(ids + [user.pk])
    for room in ChatRoom.objects.filter(is_group=True, participants=user).prefetch_related(
        "participants"
    ):
        if sorted(p.pk for p in room.participants.all()) == wanted:
            return room, False

    with transaction.atomic():
        room = ChatRoom.objects.create(name=clean_name, is_group=True, admin=user)
        room.participants.add(user, *User.objects.filter(id__in=ids))

    realtime.notify_conversation_created(wanted, room.pk)
    return room, True
