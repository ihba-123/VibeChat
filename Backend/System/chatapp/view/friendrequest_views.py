import logging

from rest_framework import generics, status
from rest_framework.response import Response

from ..serializer import FriendRequestSerializer
from ..services.friendrequest_service import friend_request_queryset, send_friend_request

logger = logging.getLogger(__name__)


class FriendRequestView(generics.ListAPIView):
    """List friend requests, and send new ones.

    The list side is new: the client had no way to discover pending requests, so
    an incoming request was invisible until the page was reloaded.
    ``?direction=incoming|outgoing`` and ``?status=pending|accepted|rejected|all``.
    """

    serializer_class = FriendRequestSerializer

    def get_queryset(self):
        return friend_request_queryset(
            self.request.user,
            direction=self.request.query_params.get("direction"),
            status=self.request.query_params.get("status", "pending"),
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["viewer"] = self.request.user
        return context

    def post(self, request):
        friend_request = send_friend_request(request.user, request.data.get("to_user_id"))
        logger.info(
            "Friend request %s: %s -> %s",
            friend_request.pk, request.user.pk, friend_request.to_user_id,
        )
        return Response(
            {
                "detail": "Friend request sent.",
                "request": FriendRequestSerializer(
                    friend_request, context={"viewer": request.user}
                ).data,
            },
            status=status.HTTP_201_CREATED,
        )
