from ..models import Profile,FriendRequest

def onlineuser(user):
  try:
            # Ensure the current user has a profile
            profile, _ = Profile.objects.get_or_create(user=user)

            # Get all online users except current one
            online_users = Profile.objects.filter(is_online=True).exclude(user=user)

            # Exclude friends
            online_users = online_users.exclude(user__in=profile.friends.all())

            # Exclude pending friend requests
            sent = FriendRequest.objects.filter(from_user=user, status='pending').values_list('to_user', flat=True)
            received = FriendRequest.objects.filter(to_user=user, status='pending').values_list('from_user', flat=True)
            excluded = list(sent) + list(received)
            online_users = online_users.exclude(user__in=excluded)

            data = [
                {
                    'id': p.user.id,
                    'email': p.user.email,
                    'username': p.user.name,
                    'is_online': p.is_online
                }
                for p in online_users
            ]

            return data

  except Exception as e:
            print("DEBUG ERROR:", e)
            return {
                   "success":False,
                   "message":"Error while fetching online users"
            }