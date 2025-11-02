from django.db import transaction
from ..serializers import UserProfileSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from chatapp.models import Profile

@transaction.atomic
def login_services(user):
  profile, created = Profile.objects.get_or_create(user=user)
  profile.is_online = True
  profile.save()

  #  Generate tokens
  refresh = RefreshToken.for_user(user)
  access = refresh.access_token
  # Response
  return{
      'refresh':str(refresh),
      'access': str(access),
      'user': UserProfileSerializer(user).data  # include is_online in serializer
  }
  

  