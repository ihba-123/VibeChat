import logging
from datetime import timedelta
from django.conf import settings
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.permissions import AllowAny , IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import RegisterSerializer, UserSerializer ,loginSerializer , UserProfileSerializer
from .models import User
from chatapp.models import Profile
# Initialize logger
logger = logging.getLogger(__name__)
logger.info("Authentication views loaded")

# Check if SIMPLE_JWT exists in settings
if not hasattr(settings, 'SIMPLE_JWT'):
    raise Exception("SIMPLE_JWT settings not found in settings.py")


# -----------------------------
# Helper: Set refresh token as cookie
# -----------------------------
def set_refresh_cookie(response, refresh_token):
    secure = not settings.DEBUG
    samesite = settings.SIMPLE_JWT.get('COOKIE_SAMESITE', 'Lax')
    path = settings.SIMPLE_JWT.get('COOKIE_PATH', '/')
    lifetime = settings.SIMPLE_JWT.get('REFRESH_TOKEN_LIFETIME', timedelta(days=7))
    max_age = int(lifetime.total_seconds())

    response.set_cookie(
        key="refresh_token",
        value=str(refresh_token),
        httponly=True,
        secure=secure,
        samesite=samesite,
        path=path,
        max_age=max_age
    )
    return response



# User Registration View

class UserRegistrationView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]

    @method_decorator(ensure_csrf_cookie)
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            logger.warning(f"User registration failed: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        try:
            user = serializer.save()
            refresh = RefreshToken.for_user(user)
            response = Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
            set_refresh_cookie(response, refresh)
            response.data['access'] = str(refresh.access_token)
            logger.info(f"User {user.email} registered successfully")
            return response
        except Exception as e:
            logger.error(f"Error creating user: {str(e)}")
            return Response({'detail': 'Error creating user'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


    #----------------------login 

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

            
            profile, created = Profile.objects.get_or_create(user=user)
            profile.is_online = True
            profile.save()

            #  Generate tokens
            refresh = RefreshToken.for_user(user)
            access = refresh.access_token
            # Response
            response = Response({
                'access': str(access),
                'user': UserProfileSerializer(user).data  # include is_online in serializer
            }, status=status.HTTP_200_OK)
            set_refresh_cookie(response, refresh)
            print("Access token --->",str(access))
            logger.info(f"User {user.email} logged in successfully")
            return Response({'detail': 'Login successful','id':user.id}, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error during login: {e}")
            return Response({'detail': f'Error processing login: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


#Logout View
class UserLogoutView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        try:
            user = request.user
            profile = user.profile
            profile.is_online = False
            profile.save()

            response = Response({'detail': 'Logged out successfully'}, status=status.HTTP_200_OK)
            response.delete_cookie('refresh_token', path=settings.SIMPLE_JWT.get('COOKIE_PATH', '/'))
            logger.info(f"User {user.email} logged out successfully")
            return response
        except Exception as e:
            logger.error(f"Error during logout: {str(e)}")
            return Response({'detail': 'Error during logout'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



# Refresh Token View

class RefreshTokenView(APIView):
    permission_classes = [AllowAny]

    @method_decorator(ensure_csrf_cookie)
    def post(self, request):
        refresh_token = request.COOKIES.get("refresh_token")
        print("Refresh token:", str(refresh_token))
        
        if not refresh_token:
            logger.warning("Refresh token not found in cookies", extra={'status': 400})
            return Response({'detail': 'Refresh token not found in cookies'}, status=400)

        try:
            token = RefreshToken(refresh_token)
            print("Token is ------>",token)
            user_id = token.payload.get('user_id')  # extract user ID from token
            if not user_id:
                return Response({'detail': 'Invalid token payload'}, status=400)

            user = User.objects.get(id=user_id)

            # Create new access token
            new_access = str(token.access_token)

            # Rotate refresh token if enabled
            if settings.SIMPLE_JWT.get('ROTATE_REFRESH_TOKENS', False):
                new_refresh = RefreshToken.for_user(user)

                if 'rest_framework_simplejwt.token_blacklist' in settings.INSTALLED_APPS:
                    try:
                        token.blacklist()
                    except Exception as e:
                        logger.error(f"Error blacklisting token: {str(e)}")
                        return Response({'detail': 'Error blacklisting token'}, status=500)

                # Set rotated refresh token as cookie
                response = Response({'access': new_access}, status=200)
                set_refresh_cookie(response, new_refresh)
                logger.info("Refresh token rotated successfully", extra={'status': 200})
                return response

            return Response({'access': new_access}, status=200)

        except Exception  as e:
            logger.error(f"Invalid refresh token: {str(e)}")
            return Response({'detail': 'Invalid refresh token'}, status=400)
        except User.DoesNotExist:
            return Response({'detail': 'User not found'}, status=404)
        except Exception as e:
            logger.error(f"Error rotating refresh token: {str(e)}")
            return Response({'detail': 'Error rotating refresh token'}, status=500)
        

#For user detail
class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        serializer = UserProfileSerializer(user)
        return Response(serializer.data)