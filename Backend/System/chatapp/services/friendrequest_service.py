from ..models import FriendRequest
from rest_framework import status
from rest_framework.response import Response
from django.db.models import Q
from authentication.models import User
from django.shortcuts import get_object_or_404

def send_friend_request(request_user, to_user_id):
        to_user = get_object_or_404(User, id=to_user_id)
  # Prevent sending request to oneself
        if to_user == request_user:
            raise ValueError("Cannot send friend request to yourself.")

        # Prevent duplicates both ways
        if FriendRequest.objects.filter(
            Q(from_user=request_user, to_user=to_user) |
            Q(from_user=to_user, to_user=request_user)
        ).exists():
            raise ValueError("Friend request already sent.")
           
        friend_requests= FriendRequest.objects.create(from_user=request_user, to_user=to_user)
          
        return friend_requests
        
       