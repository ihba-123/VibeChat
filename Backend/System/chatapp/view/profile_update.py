from rest_framework import generics
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from .. import presence
from ..models import Profile
from ..serializer import MeSerializer, ProfileUpdateSerializer


class ProfileUpdateView(generics.UpdateAPIView):
    """Update the signed-in user's name, bio and avatar."""

    serializer_class = ProfileUpdateSerializer
    # Needed for the avatar upload; JSON is still accepted for text-only edits.
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_object(self):
        return Profile.for_user(self.request.user)

    def update(self, request, *args, **kwargs):
        profile = self.get_object()
        serializer = self.get_serializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Respond with the same shape as GET /chat-profile/ so the client can drop
        # the result straight into its cache.
        profile.refresh_from_db()
        return Response(
            MeSerializer(
                profile,
                context={
                    "viewer": request.user,
                    "online_ids": presence.online_ids([request.user.pk]),
                },
            ).data
        )
