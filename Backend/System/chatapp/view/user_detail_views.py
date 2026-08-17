from rest_framework import generics

from .. import presence
from ..models import Profile
from ..serializer import MeSerializer


class UserDetailView(generics.RetrieveAPIView):
    """The signed-in user's own profile."""

    serializer_class = MeSerializer

    def get_object(self):
        # get_or_create rather than `self.request.user.profile`, which raised
        # RelatedObjectDoesNotExist for any account created while the profile
        # signal was not being registered.
        return Profile.for_user(self.request.user)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["viewer"] = self.request.user
        context["online_ids"] = presence.online_ids([self.request.user.pk])
        return context
