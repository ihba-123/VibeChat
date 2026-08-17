import logging

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..serializer import FriendRequestSerializer
from ..services.friend_update_service import friend_update_status

logger = logging.getLogger(__name__)


class FriendRequestUpdateView(APIView):
    """Accept or reject an incoming friend request."""

    def put(self, request, request_id):
        friend_request, new_status = friend_update_status(
            request.user, request_id, request.data.get("action")
        )
        logger.info("Friend request %s %s by %s", request_id, new_status, request.user.pk)
        return Response(
            {
                "detail": f"Friend request {new_status}.",
                "status": new_status,
                "request": FriendRequestSerializer(
                    friend_request, context={"viewer": request.user}
                ).data,
            },
            status=status.HTTP_200_OK,
        )
