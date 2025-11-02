from rest_framework.views import APIView
from ..services.user_logout_services import logout
from rest_framework.response import Response
from rest_framework import permissions
from rest_framework import status
from django.conf import settings
import logging


logger = logging.getLogger(__name__)
class UserLogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        try:
            data = logout(request.user)
            response = Response({'detail': 'Logged out successfully'}, status=status.HTTP_200_OK)
            response.delete_cookie('refresh_token', path=settings.SIMPLE_JWT.get('COOKIE_PATH', '/'))
            return response
        
        except Exception as e:
            logger.error(f"Error during logout: {str(e)}")
            return Response({'detail': 'Error during logout'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)