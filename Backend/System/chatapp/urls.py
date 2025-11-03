from django.urls import path
from .view.chatroom_views import ChatRoomCreateView
from .view.friendrequest_views import FriendRequestView
from .view.friend_update_views import FriendRequestUpdateView
from .view.message_list_view import MessageListView
from .view.attachment_views import AttachmentView
from .view.online_user_views import OnlineUsersView
from .view.user_detail_views import UserDetailView
from .view.profile_update import ProfileUpdateView
from .view.profile_views import ProfileAPIView
from .view.user_status_view import AllUsersStatusView
from .view.user_search_view import UserSearchView
urlpatterns = [
    path('chatrooms/create/', ChatRoomCreateView.as_view(), name='chatroom-create'),
    path('message-list/<int:room_id>/', MessageListView.as_view(), name='message-list'),
    path('chat/<int:room_id>/messages/', AttachmentView.as_view(), name='chat-attachment'),
    path('friendrequests/', FriendRequestView.as_view(), name='friend-request'),
    path('friendrequests/update/<int:request_id>/', FriendRequestUpdateView.as_view(), name='friend-request'),
    path('online-users/', OnlineUsersView.as_view(), name='online-users'),# current logged-in user
    path('chat-profile/', UserDetailView.as_view(), name='profile-current'), 
    path('chat-profile/<int:user_id>/', ProfileAPIView.as_view(), name='profile-detail'),  # any user's profile
    path('chat-profile/update/', ProfileUpdateView.as_view(), name='profile-update'),
    path('users/all-status/', AllUsersStatusView.as_view(), name='all-user-status'),  
    path('user-search/', UserSearchView.as_view(), name='user-search'),
]   