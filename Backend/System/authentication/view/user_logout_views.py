import logging

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..services.user_logout_services import logout
from ..utils.set_refiresh import clear_refresh_cookie, refresh_cookie_name

logger = logging.getLogger(__name__)


class UserLogoutView(APIView):
    def post(self, request):
        logout(request.user, request.COOKIES.get(refresh_cookie_name()))
        response = Response({'detail': 'Logged out successfully.'}, status=status.HTTP_200_OK)
        return clear_refresh_cookie(response)
