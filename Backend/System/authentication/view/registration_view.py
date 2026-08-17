import logging

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from ..serializers import RegisterSerializer, UserSerializer
from ..services.registration_service import RegisterService
from ..utils.set_refiresh import set_refresh_cookie

logger = logging.getLogger(__name__)


class UserRegistrationView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user, refresh = RegisterService.create_user(serializer)

        response = Response(
            {
                'user': UserSerializer(user).data,
                'access': str(refresh.access_token),
            },
            status=status.HTTP_201_CREATED,
        )
        return set_refresh_cookie(response, refresh)
