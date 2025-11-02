from rest_framework import permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from ..models import Message, ChatRoom
from ..serializer import ChatUserSerializer
from ..services.message_view_services import message_list_view
import logging

logger = logging.getLogger(__name__)

class MessageListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request , room_id=None):
      try:
        room_id = request.query_params.get('room_id')
        if not room_id:
            return Response({'detail': 'room_id query parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        messages = message_list_view(room_id , request.user)
        paginator = PageNumberPagination()
        paginator.page_size = 20
        page = paginator.paginate_queryset(messages, request)
        serializer = ChatUserSerializer(page, many=True)
        logger.info(f"User {request.user.email} fetched messages for Room ID: {room_id}")
        return paginator.get_paginated_response(serializer.data)
      
      except Exception as e:
        logger.error(f"Error fetching messages: {str(e)}")
        return Response({'detail': 'Error fetching messages.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)