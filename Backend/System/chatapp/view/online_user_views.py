from ..services.online_user_services import discoverable_profiles
from .mixins import PaginatedProfileListView


class OnlineUsersView(PaginatedProfileListView):
    """People to connect with: not already friends, no pending request, not blocked.

    ``?online=1`` narrows it to those currently connected.
    """

    def get_profiles(self):
        queryset = discoverable_profiles(self.request.user, search=self.search_term())
        if self.request.query_params.get("online") in ("1", "true", "True"):
            queryset = queryset.filter(is_online=True)
        return queryset
