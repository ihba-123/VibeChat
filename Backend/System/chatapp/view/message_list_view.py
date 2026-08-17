import logging

from rest_framework.views import APIView

from ..pagination import MessageCursorPagination
from ..serializer import ChatUserSerializer
from ..services.message_view_services import message_list_view

logger = logging.getLogger(__name__)


class MessageListView(APIView):
    """Message history for a room, newest page first, oldest-at-top within a page."""

    def get(self, request, room_id=None):
        # PermissionError from the service is mapped to 403 by the project's
        # exception handler rather than being flattened into a 500.
        messages = message_list_view(room_id, request.user)

        paginator = MessageCursorPagination()
        page = paginator.paginate_queryset(messages, request, view=self)
        serializer = ChatUserSerializer(page, many=True, context={"viewer": request.user})
        return paginator.get_paginated_response(serializer.data)
