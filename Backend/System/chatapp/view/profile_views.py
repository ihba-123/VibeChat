from rest_framework import generics

from .. import presence
from ..models import Profile
from ..serializer import ProfileSerializer
from ..services.blocking import blocked_ids_for
from ..services.profile_services import profile_view


class ProfileAPIView(generics.RetrieveAPIView):
    """Any user's public profile, annotated with the viewer's relationship to them."""

    serializer_class = ProfileSerializer

    def get_object(self):
        return profile_view(self.kwargs["user_id"])

    def get_serializer_context(self):
        context = super().get_serializer_context()
        viewer = self.request.user
        viewer_profile = Profile.for_user(viewer)
        context.update(
            viewer=viewer,
            viewer_friend_ids=set(viewer_profile.friends.values_list("id", flat=True)),
            blocked_ids=blocked_ids_for(viewer),
            online_ids=presence.online_ids([self.kwargs["user_id"]]),
        )
        return context
