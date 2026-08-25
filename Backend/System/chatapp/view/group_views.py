"""Group administration endpoints.

Kept apart from ``chatroom_views`` because these are the only routes with an
authorisation rule beyond membership: the caller must be the group's admin. The
rule itself lives in the service layer, so both views stay thin.
"""

import logging

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..serializer import avatar_url
from ..services.group_services import (
    add_group_members,
    remove_group_member,
    rename_group,
)

logger = logging.getLogger(__name__)


class GroupDetailView(APIView):
    """Rename a group. Admin only."""

    def patch(self, request, room_id):
        room = rename_group(request.user, room_id, request.data.get("name"))
        return Response(
            {
                "room_id": room.pk,
                "name": room.name,
                "admin_id": room.admin_id,
                "detail": "Group renamed.",
            },
            status=status.HTTP_200_OK,
        )


class GroupMemberView(APIView):
    """Remove a member from a group. Admin only."""

    def delete(self, request, room_id, member_id):
        room, member = remove_group_member(request.user, room_id, member_id)
        label = member.name or member.email
        return Response(
            {
                "room_id": room.pk,
                "user_id": member.pk,
                "detail": f"{label} removed from the group.",
            },
            status=status.HTTP_200_OK,
        )


class GroupMembersView(APIView):
    """Add people to an existing group. Admin only."""

    def post(self, request, room_id):
        room, added = add_group_members(
            request.user, room_id, request.data.get("participant_ids")
        )
        return Response(
            {
                "room_id": room.pk,
                # The full person shape, so the client can splice these rows into
                # the member list it already holds instead of re-reading the room.
                "added": [
                    {
                        "user_id": person.pk,
                        "name": person.name,
                        "email": person.email,
                        "photo": avatar_url(getattr(person, "profile", None)),
                        "is_online": False,
                    }
                    for person in added
                ],
                "detail": f"{len(added)} added to the group."
                if len(added) != 1
                else f"{added[0].name or added[0].email} added to the group.",
            },
            status=status.HTTP_201_CREATED,
        )
