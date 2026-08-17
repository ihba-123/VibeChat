import logging

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from authentication.serializers import UserProfileSerializer
from authentication.services.token_service import refresh_access_token_service
from authentication.utils.set_refiresh import (
    clear_refresh_cookie,
    refresh_cookie_name,
    set_refresh_cookie,
)

logger = logging.getLogger(__name__)


class RefreshTokenView(APIView):
    """Issue a new access token from the HttpOnly refresh cookie."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        data, status_code = refresh_access_token_service(
            request.COOKIES.get(refresh_cookie_name())
        )

        if 'error' in data:
            # The code tells the client whether "signed out" may be remembered:
            # 'no_session' is definitive, 'session_expired' may be transient.
            response = Response(
                {'detail': data['error'], 'code': data.get('code', 'session_expired')},
                status=status_code,
            )
            # Drop the unusable cookie so the client stops retrying with it.
            return clear_refresh_cookie(response)

        body = {'access': data['access']}
        user = data.get('user')
        if user is not None:
            body['user'] = UserProfileSerializer(user).data

        response = Response(body, status=status.HTTP_200_OK)
        if data.get('refresh'):
            # The rotated refresh token stays in the HttpOnly cookie and is never
            # exposed to JavaScript.
            set_refresh_cookie(response, data['refresh'])
        return response
