from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from ..services.online_user_services import onlineuser
from rest_framework import status
import logging

logger = logging.getLogger(__name__)
class OnlineUsersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            online_user = onlineuser(request.user)  
            return Response({"online_users": online_user}, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")
            return Response({"detail": "Server error occurred."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
           
        