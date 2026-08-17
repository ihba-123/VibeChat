from ..models import Profile
from . import blocking


def user_status(user, search=None):
    """Every other account with its presence state.

    Returned as a queryset: this used to build a list of dicts for the entire user
    table with a Cloudinary lookup per row, so its cost grew linearly with signups.
    """
    excluded = blocking.blocked_ids_for(user) | {user.pk}
    queryset = (
        Profile.objects.select_related("user")
        .filter(user__is_active=True)
        .exclude(user_id__in=excluded)
    )
    if search:
        queryset = queryset.filter(user__name__icontains=search)
    return queryset.order_by("-is_online", "user__name", "user__id")
