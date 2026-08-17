import logging

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .. import presence
from ..pagination import StandardPagination
from ..serializer import ConversationSerializer
from ..services.chat_services import create_chat_room
from ..services.conversation_services import (
    attach_previews,
    conversation_queryset,
    total_unread,
)

logger = logging.getLogger(__name__)


class ChatRoomCreateView(APIView):
    """Open (or create) a conversation.

    Idempotent by design: asking for a direct chat that already exists returns it
    with 200 rather than a 400 the client cannot act on.
    """

    def post(self, request):
        room, created = create_chat_room(
            request.user,
            request.data.get("participant_ids"),
            request.data.get("name"),
            bool(request.data.get("is_group", False)),
        )
        return Response(
            {
                "room_id": room.pk,
                "is_group": room.is_group,
                "created": created,
                "detail": "Conversation created." if created else "Conversation already exists.",
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class ConversationListView(APIView):
    """The sidebar: rooms ordered by activity, with previews and unread counts."""

    def get(self, request):
        queryset = conversation_queryset(request.user)

        paginator = StandardPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        rooms = attach_previews(page, request.user)

        participant_ids = {
            participant.pk for room in rooms for participant in room.participants.all()
        }
        serializer = ConversationSerializer(
            rooms,
            many=True,
            context={
                "viewer": request.user,
                "online_ids": presence.online_ids(participant_ids),
            },
        )
        response = paginator.get_paginated_response(serializer.data)
        response.data["total_unread"] = total_unread(request.user)
        return response


class UnreadCountView(APIView):
    def get(self, request):
        return Response({"total_unread": total_unread(request.user)})
