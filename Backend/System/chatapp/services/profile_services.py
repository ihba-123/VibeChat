from django.shortcuts import get_object_or_404
from ..models import Profile , User

def profile_view(user_id):
  user = get_object_or_404(User, id=user_id)
  profile, created = Profile.objects.get_or_create(user=user)
  if profile:
    return profile
  else:
    return{
      "success":False,
      "message":"Profile does not exist"
    }
                  