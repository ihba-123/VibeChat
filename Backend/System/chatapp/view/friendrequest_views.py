from rest_framework.views import APIView
from rest_framework import permissions
from ..services.friendrequest_service import send_friend_request
from rest_framework.response import Response
from rest_framework import status
import logging

logger = logging.getLogger(__name__)
class FriendRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        to_user_id = request.data.get('to_user_id')
        print(f"Received friend request to user ID: {to_user_id}")

        try:
          friend_request = send_friend_request(request.user , to_user_id)
          # logger.info(f"Friend request sent from {friend_request.user.id} to {to_user_id}")
          return Response({'detail': 'Friend request sent successfully.'}, status=status.HTTP_201_CREATED)
        
        except ValueError as e:
            logger.warning(f"Failed to send friend request from {request.user.id} to {to_user_id}: {str(e)}")
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
                                