from rest_framework.exceptions import ValidationError

from ..models import Profile


def friend_profiles(user, search=None):
    """The user's friends as Profile rows, ready for UserSummarySerializer."""
    profile = Profile.for_user(user)
    queryset = Profile.objects.filter(user__in=profile.friends.all()).select_related("user")
    if search:
        queryset = queryset.filter(user__name__icontains=search)
    return queryset.order_by("user__name", "user__id")


def remove_friend(user, friend_user_id):
    try:
        friend_user_id = int(friend_user_id)
    except (TypeError, ValueError):
        raise ValidationError("A valid user id is required.")

    profile = Profile.for_user(user)
    friend = profile.friends.filter(pk=friend_user_id).first()
    if friend is None:
        raise ValidationError("You are not friends with this person.")

    profile.remove_friend(friend)
    return friend
