from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..services.friend_services import friend_profiles, remove_friend
from .mixins import PaginatedProfileListView


class FriendListView(PaginatedProfileListView):
    """The signed-in user's friends."""

    def get_profiles(self):
        return friend_profiles(self.request.user, search=self.search_term())


class FriendDetailView(APIView):
    """Remove a friend (symmetrically)."""

    def delete(self, request, user_id):
        friend = remove_friend(request.user, user_id)
        return Response(
            {"detail": f"{friend.name or friend.email} removed from your friends."},
            status=status.HTTP_200_OK,
        )
