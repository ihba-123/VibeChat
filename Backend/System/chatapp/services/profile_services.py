from django.shortcuts import get_object_or_404

from ..models import Profile, User


def profile_view(user_id):
    user = get_object_or_404(User.objects.select_related("profile"), id=user_id)
    return Profile.for_user(user)
