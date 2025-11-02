from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.throttling import AnonRateThrottle
from rest_framework.response import Response
from rest_framework import status
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie

from ..serializers import RegisterSerializer, UserSerializer
from ..services.registration_service import RegisterService
from ..utils.set_refiresh import set_refresh_cookie

class UserRegistrationView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]

    @method_decorator(ensure_csrf_cookie)
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Pass validated serializer to service
            user, refresh = RegisterService.create_user({'serializer': serializer})

            # Construct response
            response = Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
            set_refresh_cookie(response, refresh)
            response.data['access'] = str(refresh.access_token)

            return response

        except Exception:
            return Response({'detail': 'Error creating user'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
