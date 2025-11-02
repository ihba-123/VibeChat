from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework.permissions import AllowAny
from rest_framework.throttling import AnonRateThrottle
from ..serializers import loginSerializer
from ..services.login_services import login_services
from ..utils.set_refiresh import set_refresh_cookie
import logging

logger = logging.getLogger(__name__)

class UserLoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]

    @method_decorator(ensure_csrf_cookie)
    def post(self, request):
        serializer = loginSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            logger.warning(f"Login failed: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = serializer.validated_data['user']

            data =  login_services(user)

            response = Response({
                "access": data['access'],
                "user": data['user']
            }, status=status.HTTP_200_OK)
            set_refresh_cookie(response, data['refresh'])

            return response

        except Exception as e:
            logger.error(f"Error during login: {e}")
            return Response({'detail': 'Error during login'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
