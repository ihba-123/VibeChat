from rest_framework.throttling import ScopedRateThrottle

from ..services.user_search_services import user_search
from .mixins import PaginatedProfileListView


class UserSearchView(PaginatedProfileListView):
    """Search people by name or email."""

    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "search"

    def get_profiles(self):
        return user_search(self.request.query_params, self.request.user)
