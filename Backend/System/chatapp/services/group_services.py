"""Group administration: renaming a group and managing its membership.

Every group has exactly one admin — the person who created it, stored on
``ChatRoom.admin``. These operations are the only ones that mutate a group after
creation, so the authorisation check lives here once rather than in each view.

``PermissionError`` is raised rather than DRF's ``PermissionDenied`` to match the
rest of the service layer; the project's exception handler maps it to a 403.
"""

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import ValidationError

from authentication.models import User

from .. import realtime
from ..models import ChatRoom
from . import blocking
from .chat_services import MAX_GROUP_PARTICIPANTS, clean_participant_ids

MAX_GROUP_NAME_LENGTH = 255


def get_group(user, room_id):
    """A group the user belongs to, or raise."""
    room = get_object_or_404(ChatRoom, id=room_id)
    if not room.participants.filter(pk=user.pk).exists():
        raise PermissionError("You are not a participant of this conversation.")
    if not room.is_group:
        # A bare string, not a field dict: the error envelope surfaces the first
        # value of a dict prefixed with its field name, which would read
        # "detail: This is not a group conversation." to the user.
        raise ValidationError("This is not a group conversation.")
    return room


def get_group_as_admin(user, room_id):
    """Same, but only for the group's admin.

    ``admin`` is nullable (SET_NULL when the creator's account is deleted), so the
    identity check is written against ``user.pk`` — a room with no admin left has
    no one who can administer it, which is the safe reading.
    """
    room = get_group(user, room_id)
    if room.admin_id != user.pk:
        raise PermissionError("Only the group admin can do that.")
    return room


def _clean_name(name):
    clean = (name or "").strip()
    if not clean:
        raise ValidationError({"name": "A group needs a name."})
    if len(clean) > MAX_GROUP_NAME_LENGTH:
        raise ValidationError(
            {"name": f"Group name is too long ({MAX_GROUP_NAME_LENGTH} characters max)."}
        )
    return clean


def rename_group(user, room_id, name):
    """Rename a group. Admin only. Returns the room."""
    room = get_group_as_admin(user, room_id)
    clean = _clean_name(name)

    if clean == room.name:
        # Nothing changed — don't spend a write or a broadcast on it.
        return room

    room.name = clean
    room.save(update_fields=["name"])
    realtime.notify_conversation_updated(room.pk, name=clean)
    return room


def remove_group_member(user, room_id, member_id):
    """Remove someone from a group. Admin only. Returns ``(room, member)``."""
    room = get_group_as_admin(user, room_id)

    try:
        member_id = int(member_id)
    except (TypeError, ValueError):
        raise ValidationError({"member_id": "A valid user id is required."})

    if member_id == room.admin_id:
        # Handing the group over is a different feature; without this guard the
        # admin could remove themselves and leave the group unadministerable.
        raise ValidationError({"member_id": "The group admin cannot be removed."})

    member = room.participants.filter(pk=member_id).first()
    if member is None:
        raise ValidationError({"member_id": "That person is not a member of this group."})

    room.remove_participant(member)

    # Order matters: the removed member is still in the room's channel group, so
    # the room-wide update reaches them first and the targeted event that follows
    # is what actually closes the conversation on their client.
    realtime.notify_conversation_updated(room.pk)
    realtime.notify_conversation_removed(member.pk, room.pk)
    return room, member


def add_group_members(user, room_id, participant_ids):
    """Add people to an existing group. Admin only.

    Returns ``(room, added)`` where ``added`` is the users actually joined —
    anyone already in the group is skipped rather than rejected, so a client that
    re-sends a request it is unsure landed gets the same result instead of an
    error.
    """
    room = get_group_as_admin(user, room_id)
    ids = clean_participant_ids(participant_ids, user)

    blocked = blocking.blocked_ids_for(user)
    if any(i in blocked for i in ids):
        raise ValidationError(
            {"participant_ids": "Remove blocked people before adding them to the group."}
        )

    current_ids = set(room.participants.values_list("id", flat=True))
    new_ids = [i for i in ids if i not in current_ids]
    if not new_ids:
        raise ValidationError(
            {"participant_ids": "Everyone you picked is already in this group."}
        )

    # The cap is on the resulting group, not on the size of this one request.
    if len(current_ids) + len(new_ids) > MAX_GROUP_PARTICIPANTS:
        raise ValidationError(
            {"participant_ids": f"A group cannot exceed {MAX_GROUP_PARTICIPANTS} members."}
        )

    added = list(User.objects.filter(id__in=new_ids, is_active=True))
    with transaction.atomic():
        room.participants.add(*added)

    # Two audiences, two events: the people already in the room need their member
    # list re-read, while the new members have no room to update yet and instead
    # need the "join this conversation" event the socket acts on.
    realtime.notify_conversation_updated(room.pk)
    realtime.notify_conversation_created([u.pk for u in added], room.pk)
    return room, added
