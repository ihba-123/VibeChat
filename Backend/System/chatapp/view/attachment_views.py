from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from ..serializer import MessageCreateSerializer , ChatUserSerializer
from django.shortcuts import get_object_or_404
from ..models import ChatRoom
from ..services.attachment_services import attachment_services
from rest_framework.permissions import IsAuthenticated
import logging

logger = logging.getLogger(__name__)
class AttachmentView(APIView):
  permission_classes = [IsAuthenticated]
  def post(self, request, room_id):
    chat_room = get_object_or_404(ChatRoom, id=room_id)

    if not chat_room.participants.filter(id=request.user.id).exists():
      logger.error({"You are not a participant of this chat room."})
      return Response(
        {'detail': 'You are not a participant of this chat room.'},
        status=status.HTTP_403_FORBIDDEN
      )
    serializer = MessageCreateSerializer(data=request.data)
    if serializer.is_valid():
          logger.info(f"User {request.user.email} sent attachment in Room ID: {room_id}")
    
    try:
       services = attachment_services(request.user , chat_room , serializer)
       response_serializer =  ChatUserSerializer(services)
       return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    except Exception as e:
        logger.error(f"Attachment send error by {request.user.email}: {e}")
        return Response(
          {'detail': 'Failed to send attachment.'},
              status=status.HTTP_500_INTERNAL_SERVER_ERROR
          )

