import logging

from django.db import transaction
from rest_framework_simplejwt.tokens import RefreshToken

from chatapp.models import Profile

logger = logging.getLogger(__name__)


class RegisterService:
    @staticmethod
    def create_user(serializer):
        """Create the user and return ``(user, refresh_token)``."""
        with transaction.atomic():
            user = serializer.save()
            # The post_save signal creates this; the explicit call makes the
            # invariant hold even if signal registration is ever disturbed again.
            Profile.for_user(user)

        refresh = RefreshToken.for_user(user)
        logger.info('User %s registered', user.email)
        return user, refresh
