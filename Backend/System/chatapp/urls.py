from django.urls import path
from .views import ChatRoomCreateView, FriendRequestView,MessageListView,  OnlineUsersView , UserDetailView, ProfileUpdateView, ProfileAPIView,FriendRequestUpdateView , AllUsersStatusView , AttachmentView,UserSearchView

urlpatterns = [
    path('chatrooms/create/', ChatRoomCreateView.as_view(), name='chatroom-create'),
    path('message-list/<int:room_id>/', MessageListView.as_view(), name='message-list'),
    path('chat/<int:room_id>/attachment/', AttachmentView.as_view(), name='chat-attachment'),
    path('friendrequests/', FriendRequestView.as_view(), name='friend-request'),
    path('friendrequests/update/<int:request_id>/', FriendRequestUpdateView.as_view(), name='friend-request'),
    path('online-users/', OnlineUsersView.as_view(), name='online-users'),# current logged-in user
    path('chat-profile/', UserDetailView.as_view(), name='profile-current'), 
    path('chat-profile/<int:user_id>/', ProfileAPIView.as_view(), name='profile-detail'),  # any user's profile
    path('chat-profile/update/', ProfileUpdateView.as_view(), name='profile-update'),
    path('users/all-status/', AllUsersStatusView.as_view(), name='all-user-status'),  
     path('user-search/', UserSearchView.as_view(), name='user-search'),
]