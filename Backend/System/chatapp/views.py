from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics, permissions
from django.shortcuts import get_object_or_404
from django.db.models import Q
from rest_framework.pagination import PageNumberPagination
import logging
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import ChatRoom, FriendRequest, Message, Profile,ChatRoom
from authentication.models import User
from .serializer import ProfileSerializer, ProfileUpdateSerializer , PersonlDetailsSerializer, ChatUserSerializer ,MessageCreateSerializer
from django.core.exceptions import ValidationError

logger = logging.getLogger(__name__)

# -------------------------------
# Chat Room Creation
# -------------------------------
class ChatRoomCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        is_group = request.data.get('is_group', False)
        participant_ids = request.data.get('participants', [])
        name = request.data.get('name', None)

        # rivate chat must have exactly 1 participant
        if not is_group and len(participant_ids) != 1:
            return Response(
                {'detail': 'Private chat must have exactly one participant.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Prevent duplicate private chats
        if not is_group:
            other_user = get_object_or_404(User, id=participant_ids[0])
            existing_room = ChatRoom.objects.filter(
                is_group=False,
                participants=request.user
            ).filter(participants=other_user).first()
            if existing_room:
                return Response({
                    "message": "Private chat already exists.",
                    "room_id": existing_room.id
                })

        chat_room = ChatRoom.objects.create(
            name=name if is_group else None,
            is_group=is_group,
            admin=request.user if is_group else None
        )
        chat_room.add_participant(request.user)

        for user_id in participant_ids:
            user = get_object_or_404(User, id=user_id)
            chat_room.add_participant(user)

        logger.info(f"Chat room created by {request.user.email} (Room ID: {chat_room.id})")
        return Response(
            {"message": "Chat room created successfully.", "room_id": chat_room.id, "is_group": is_group},
            status=status.HTTP_201_CREATED
        )


# Friend Request Management
class FriendRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        to_user_id = request.data.get('to_user_id')
        to_user = get_object_or_404(User, id=to_user_id)

        # Prevent sending request to oneself
        if to_user == request.user:
            return Response(
                {'detail': 'You cannot send a friend request to yourself.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Prevent duplicates both ways
        if FriendRequest.objects.filter(
            Q(from_user=request.user, to_user=to_user) |
            Q(from_user=to_user, to_user=request.user)
        ).exists():
            return Response(
                {'detail': 'A friend request already exists between you two.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        friend_request = FriendRequest.objects.create(from_user=request.user, to_user=to_user)
        logger.info(f"Friend request sent from {request.user.email} to {to_user.email}")
        return Response({'detail': 'Friend request sent successfully.'}, status=status.HTTP_201_CREATED)


# This method allows the recipient of a friend request to either accept or reject it.
class FriendRequestUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request, request_id):
        """Accept or reject a friend request (only recipient can act)."""
        try:
            # Only recipient can accept/reject
            friend_request = FriendRequest.objects.get(id=request_id, to_user=request.user)
        except FriendRequest.DoesNotExist:
            return Response(
                {'detail': 'No pending FriendRequest found for you with this ID.'},
                status=status.HTTP_404_NOT_FOUND
            )

        if friend_request.status != 'pending':
            return Response(
                {'detail': 'This friend request has already been responded to.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        action = request.data.get('action')

        if action == 'accept':
            friend_request.status = 'accepted'
            friend_request.save()

            # Add both users as friends symmetrically
            to_profile = friend_request.to_user.profile
            from_profile = friend_request.from_user.profile

            to_profile.friends.add(friend_request.from_user)
            from_profile.friends.add(friend_request.to_user)

            to_profile.save()
            from_profile.save()

            return Response({'detail': 'Friend request accepted.'}, status=status.HTTP_200_OK)

        elif action == 'reject':
            friend_request.status = 'rejected'
            friend_request.save()
            return Response({'detail': 'Friend request rejected.'}, status=status.HTTP_200_OK)

        return Response({'detail': 'Invalid action. Must be "accept" or "reject".'}, status=status.HTTP_400_BAD_REQUEST)



# Message List View (with Pagination)
class MessageListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, room_id=None):
        if room_id is None:
            room_id = request.query_params.get('room_id')
        chat_room = get_object_or_404(ChatRoom, id=room_id)

        # Check if user is participant
        if not chat_room.participants.filter(id=request.user.id).exists():
            return Response(
                {'detail': 'You are not a participant of this chat room.'},
                status=status.HTTP_403_FORBIDDEN
            )

        messages = Message.objects.filter(chat_room=chat_room).order_by('timestamp')  # oldest first
        paginator = PageNumberPagination()
        paginator.page_size = 20
        page = paginator.paginate_queryset(messages, request)
        serializer = ChatUserSerializer(page, many=True)
        logger.info(f"User {request.user.email} fetched messages for Room ID: {room_id}")
        return paginator.get_paginated_response(serializer.data)



#File and Photo Upload View
class AttachmentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, room_id):
        chat_room = get_object_or_404(ChatRoom, id=room_id)

        if not chat_room.participants.filter(id=request.user.id).exists():
            return Response({'detail': 'You are not a participant of this chat room.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = MessageCreateSerializer(data=request.data)

        if serializer.is_valid():
            message = serializer.save(sender=request.user, chat_room=chat_room)
            logger.info(f"User {request.user.email} sent attachment in Room ID: {room_id}")

            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"chat_{chat_room.id}",
                {
                    "type": "chat_message_event",
                    "message": {
                        "id": message.id,
                        "sender": request.user.email,
                        "content": message.content,
                        "attachment": getattr(message.attachment, 'url', None),
                        "images": getattr(message.images, 'url', None),
                        "timestamp": message.timestamp.isoformat(),
                        "is_group": chat_room.is_group,
                    },
                },
            )

            # serialize for response
            response_serializer = ChatUserSerializer(message)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)





# Online Users (excluding friends & pending requests)
class OnlineUsersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            user = request.user

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

            return Response(data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error fetching online users: {str(e)}")
            print("DEBUG ERROR:", e)
            return Response({'detail': 'Error fetching online users.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# Profile Views
#This view retrieves the details of the currently authenticated user.
class UserDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PersonlDetailsSerializer
    def get_object(self):
        return self.request.user.profile

 

class ProfileUpdateView(generics.UpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ProfileUpdateSerializer

    def get_object(self):
        return self.request.user.profile


class ProfileAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, user_id):
        user = get_object_or_404(User, id=user_id)
        profile, created = Profile.objects.get_or_create(user=user)

        serializer = ProfileSerializer(profile)
        return Response(serializer.data, status=status.HTTP_200_OK)


class AllUsersStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user

        # Get all profiles except yourself
        profiles = Profile.objects.exclude(user=user)

        data = [
    {
        "id": p.user.id,
        "email": p.user.email,
        "name": f"{p.user.name} ",
        "is_online": p.is_online
    }
    for p in profiles
]

        return Response(data, status=status.HTTP_200_OK)



# User Search View
class UserSearchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            query = request.query_params.get('q', '').strip()
            if not query:
                return Response(
                    {"detail": "Query parameter 'q' is required."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Limit query length to prevent abuse
            if len(query) > 100:
                return Response(
                    {"detail": "Query parameter 'q' is too long."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Fetch users with profiles in a single query
            users = User.objects.select_related('profile').filter(
                Q(name__icontains=query) | Q(email__icontains=query),
                profile__isnull=False
            ).exclude(id=request.user.id)[:20]

            serializer = PersonlDetailsSerializer(users, many=True, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)

        except ValidationError as e:
            logger.error(f"Validation error during user search for query '{query}': {str(e)}")
            return Response(
                {"detail": "Invalid query parameters."},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Unexpected error during user search for query '{query}': {str(e)}")
            return Response(
                {"detail": "An unexpected error occurred during the search."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )