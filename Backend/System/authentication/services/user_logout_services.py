import logging

from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from chatapp import presence
from chatapp.models import Profile

logger = logging.getLogger(__name__)


def logout(user, refresh_token=None):
    """Mark the user offline and invalidate their refresh token."""
    # Clear the presence counter so a browser closed without a clean WebSocket
    # teardown does not leave the account showing as online.
    presence.reset(user.pk)
    Profile.objects.filter(user=user).update(is_online=False)

    if refresh_token:
        try:
            # Without this the refresh cookie stays valid after logout and could be
            # replayed to mint new access tokens.
            RefreshToken(refresh_token).blacklist()
        except (TokenError, AttributeError) as exc:
            logger.info('Could not blacklist refresh token on logout: %s', exc)
