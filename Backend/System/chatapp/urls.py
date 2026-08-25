from django.urls import path

from .view.attachment_views import AttachmentView
from .view.block_views import BlockedUserListView, BlockUserView, UnblockUserView
from .view.chatroom_views import ChatRoomCreateView, ConversationListView, UnreadCountView
from .view.friend_update_views import FriendRequestUpdateView
from .view.friend_views import FriendDetailView, FriendListView
from .view.friendrequest_views import FriendRequestView
from .view.group_views import GroupDetailView, GroupMembersView, GroupMemberView
from .view.message_list_view import MessageListView
from .view.online_user_views import OnlineUsersView
from .view.profile_update import ProfileUpdateView
from .view.profile_views import ProfileAPIView
from .view.user_detail_views import UserDetailView
from .view.user_search_view import UserSearchView
from .view.user_status_view import AllUsersStatusView

urlpatterns = [
    # Conversations
    path('chatrooms/', ConversationListView.as_view(), name='conversation-list'),
    path('chatrooms/create/', ChatRoomCreateView.as_view(), name='chatroom-create'),
    path('chatrooms/unread-count/', UnreadCountView.as_view(), name='unread-count'),

    # Group administration. Declared after the literal paths above so "create"
    # and "unread-count" can never be read as a room id.
    path('chatrooms/<int:room_id>/', GroupDetailView.as_view(), name='group-detail'),
    path('chatrooms/<int:room_id>/members/', GroupMembersView.as_view(), name='group-members'),
    path(
        'chatrooms/<int:room_id>/members/<int:member_id>/',
        GroupMemberView.as_view(),
        name='group-member',
    ),

    # Messages
    path('message-list/<int:room_id>/', MessageListView.as_view(), name='message-list'),
    path('chat/<int:room_id>/messages/', AttachmentView.as_view(), name='chat-attachment'),

    # Friends & requests
    path('friends/', FriendListView.as_view(), name='friend-list'),
    path('friends/<int:user_id>/', FriendDetailView.as_view(), name='friend-detail'),
    path('friendrequests/', FriendRequestView.as_view(), name='friend-request'),
    path('friendrequests/update/<int:request_id>/', FriendRequestUpdateView.as_view(), name='friend-request-update'),

    # People
    path('online-users/', OnlineUsersView.as_view(), name='online-users'),
    path('users/all-status/', AllUsersStatusView.as_view(), name='all-user-status'),
    path('user-search/', UserSearchView.as_view(), name='user-search'),

    # Profiles
    path('chat-profile/', UserDetailView.as_view(), name='profile-current'),
    path('chat-profile/update/', ProfileUpdateView.as_view(), name='profile-update'),
    # Declared after the literal paths above so "update" is never captured as an id.
    path('chat-profile/<int:user_id>/', ProfileAPIView.as_view(), name='profile-detail'),

    # Blocking
    path('blocked-users/', BlockedUserListView.as_view(), name='blocked-users'),
    path('block-user/<int:blocked_id>/', BlockUserView.as_view(), name='block-user'),
    path('unblock-user/<int:blocked_id>/', UnblockUserView.as_view(), name='unblock-user'),
]
