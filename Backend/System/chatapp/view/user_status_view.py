from ..services.user_status_services import user_status
from .mixins import PaginatedProfileListView


class AllUsersStatusView(PaginatedProfileListView):
    """Every other account with its presence state."""

    def get_profiles(self):
        return user_status(self.request.user, search=self.search_term())
