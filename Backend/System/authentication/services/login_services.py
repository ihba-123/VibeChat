from rest_framework_simplejwt.tokens import RefreshToken

from chatapp.models import Profile

from ..serializers import UserProfileSerializer


def login_services(user):
    """Issue a token pair for a successfully authenticated user."""
    # Guarantees the profile exists before anything dereferences user.profile.
    Profile.for_user(user)

    # Online state is deliberately not set here: presence is owned by the
    # WebSocket layer, so a login that never opens a socket must not leave the
    # account showing as online forever.
    refresh = RefreshToken.for_user(user)

    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
        'user': UserProfileSerializer(user).data,
    }
