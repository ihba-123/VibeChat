from rest_framework.views import APIView
from rest_framework import permissions
from ..services.friend_update_service import friend_update_status
from rest_framework.response import Response
import logging
from rest_framework import status

logger = logging.getLogger(__name__)
class FriendRequestUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request, request_id):
        action = request.data.get('action')
        print(f"Received action: {action}")
        if not action:
            return Response({"detail": "Action is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            friend_request, new_status = friend_update_status(request.user, request_id, action)
            print(f"Friend request updated: {friend_request}, new status: {new_status}")
            return Response({"detail": f"Friend request {new_status} successfully."}, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")
            return Response({"detail": "Server error occurred."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)