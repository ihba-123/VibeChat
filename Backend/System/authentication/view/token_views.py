from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.views.decorators.csrf import ensure_csrf_cookie
from authentication.utils.set_refiresh import set_refresh_cookie
from authentication.services.token_service import refresh_access_token_service
from django.utils.decorators import method_decorator
import logging

logger = logging.getLogger(__name__)

class RefreshTokenView(APIView):
    permission_classes = [AllowAny]

    @method_decorator(ensure_csrf_cookie)
    def post(self, request):
        refresh_token = request.COOKIES.get("refresh_token")

        if not refresh_token:
            return Response({'detail': 'Refresh token missing'}, status=401)

        data, status_code = refresh_access_token_service(refresh_token)

        if 'error' in data:
            return Response({'detail': data['error']}, status=status_code)

        # Always send back new ACCESS TOKEN
        response_data = {
            'access': data['access']
        }

        response = Response(response_data, status=status_code)

        # If refresh rotation is enabled → set new refresh cookie
        if 'refresh' in data:
            set_refresh_cookie(response, data['refresh'])

        return response
