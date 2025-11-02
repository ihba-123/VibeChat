import logging
from rest_framework_simplejwt.tokens import RefreshToken

logger = logging.getLogger(__name__)

class RegisterService:
    @staticmethod
    def create_user(validated_data):
        try:
            # Create user
            user = validated_data['serializer'].save()

            # Generate tokens
            refresh = RefreshToken.for_user(user)

            # Logging
            logger.info(f"User {user.email} registered successfully")

            return user, refresh

        except Exception as e:
            logger.error(f"Error creating user: {str(e)}")
            raise e
