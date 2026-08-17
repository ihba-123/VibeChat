import logging

from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from ..serializer import ChatUserSerializer, MessageCreateSerializer
from ..services.attachment_services import attachment_services
from ..services.message_view_services import get_room_for

logger = logging.getLogger(__name__)


class AttachmentView(APIView):
    """Send a message with an image or file attachment."""

    parser_classes = [MultiPartParser, FormParser]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "upload"

    def post(self, request, room_id):
        chat_room = get_room_for(request.user, room_id)

        serializer = MessageCreateSerializer(data=request.data)
        # The result of is_valid() used to be ignored, so invalid input fell through
        # to serializer.save() and surfaced as a 500 instead of a 400.
        serializer.is_valid(raise_exception=True)

        message = attachment_services(request.user, chat_room, serializer)
        logger.info("User %s uploaded to room %s", request.user.pk, room_id)

        return Response(
            ChatUserSerializer(message, context={"viewer": request.user}).data,
            status=status.HTTP_201_CREATED,
        )
