from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings
from authentication.models import User
import logging

logger = logging.getLogger(__name__)

def refresh_access_token_service(refresh_token):
    if not refresh_token:
        logger.warning("Refresh token not found")
        return {'error': 'Refresh token not found in cookies'}, 400

    try:
        token = RefreshToken(refresh_token)
        user_id = token.payload.get('user_id')

        if not user_id:
            return {'error': 'Invalid token payload'}, 400

        user = User.objects.get(id=user_id)

        # Create new access token
        new_access = str(token.access_token)

        # Rotate refresh token if enabled
        if settings.SIMPLE_JWT.get('ROTATE_REFRESH_TOKENS', False):
            new_refresh = RefreshToken.for_user(user)

            # If blacklist app is active, blacklist the old token
            if 'rest_framework_simplejwt.token_blacklist' in settings.INSTALLED_APPS:
                try:
                    token.blacklist()
                except Exception as e:
                    logger.error(f"Error blacklisting token: {str(e)}")
                    return {'error': 'Error blacklisting token'}, 500

            logger.info("Refresh token rotated successfully")
            return {
                'access': new_access,
                'refresh': str(new_refresh)
            }, 200

        # If rotation is disabled, return only new access
        return {'access': new_access}, 200

    except User.DoesNotExist:
        return {'error': 'User not found'}, 404
    except Exception as e:
        logger.error(f"Error refreshing token: {str(e)}")
        return {'error': 'Invalid refresh token'}, 400
