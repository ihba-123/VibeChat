import logging

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from ..serializers import loginSerializer
from ..services.login_services import login_services
from ..utils.set_refiresh import set_refresh_cookie

logger = logging.getLogger(__name__)


class UserLoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    # Scoped so a brute-force attempt against this endpoint cannot also exhaust
    # the shared anonymous budget for registration and password reset.
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'auth'

    def post(self, request):
        serializer = loginSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            logger.info('Login rejected for %s', request.data.get('email'))
            return Response(
                {'detail': 'Incorrect email or password.', 'code': 'invalid_credentials'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        data = login_services(serializer.validated_data['user'])
        response = Response(
            {'access': data['access'], 'user': data['user']},
            status=status.HTTP_200_OK,
        )
        return set_refresh_cookie(response, data['refresh'])
