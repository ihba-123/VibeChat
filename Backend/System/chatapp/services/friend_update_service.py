from ..models import FriendRequest
from django.shortcuts import get_object_or_404


def friend_update_status(request_user, request_id, action):
  print(f"DEBUG: Current user ID = {request_user.id}, request ID = {request_id}")
  try:
    friend_request = FriendRequest.objects.get(id=request_id, to_user=request_user)
    print(f"Fetched friend request: {friend_request}")
    if friend_request.status != 'pending':
        raise ValueError("This friend request has already been responded to.")

    if action == 'accept':
        friend_request.status = 'accepted'
        friend_request.save()

        # Add both users as friends
        to_profile = friend_request.to_user.profile
        from_profile = friend_request.from_user.profile

        to_profile.friends.add(friend_request.from_user)
        from_profile.friends.add(friend_request.to_user)

        to_profile.save()
        from_profile.save()

    elif action == 'reject':
        friend_request.status = 'rejected'
        friend_request.save()

    else:
        raise ValueError('Invalid action. Use "accept" or "reject".')

    return friend_request, friend_request.status
  
  except FriendRequest.DoesNotExist:
    raise ValueError("Friend request not found.")