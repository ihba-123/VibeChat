from ..models import FriendRequest, Profile
from . import blocking


def discoverable_profiles(user, search=None):
    """People the user could connect with.

    Excludes existing friends, anyone with a pending request in either direction,
    and blocked users. Returned as a queryset so the view can paginate it — with a
    thousand accounts this endpoint previously serialised every one of them.
    """
    profile = Profile.for_user(user)

    pending = set(
        FriendRequest.objects.filter(status="pending")
        .filter(from_user=user)
        .values_list("to_user_id", flat=True)
    )
    pending.update(
        FriendRequest.objects.filter(status="pending")
        .filter(to_user=user)
        .values_list("from_user_id", flat=True)
    )

    excluded = pending | blocking.blocked_ids_for(user) | {user.pk}
    excluded.update(profile.friends.values_list("id", flat=True))

    queryset = (
        Profile.objects.select_related("user")
        .filter(user__is_active=True)
        .exclude(user_id__in=excluded)
    )
    if search:
        queryset = queryset.filter(user__name__icontains=search)
    # Online first, then alphabetically; id keeps paging deterministic.
    return queryset.order_by("-is_online", "user__name", "user__id")


# Backwards-compatible alias for the original import name.
def onlineuser(user):
    return discoverable_profiles(user).filter(is_online=True)
