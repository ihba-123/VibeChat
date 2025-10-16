from django.urls import path
from .views import UserRegistrationView ,RefreshTokenView , UserLoginView , UserProfileView ,UserLogoutView
from chatapp.views import Profile
urlpatterns = [
    path('register/', UserRegistrationView.as_view(), name='register' ),
    path('refresh-token/', RefreshTokenView.as_view(), name='refresh-token'),
    path('login/', UserLoginView.as_view(), name='login'),
    path('profile/', UserProfileView.as_view(), name='profile'),
    path('logout/', UserLogoutView.as_view(), name='logout'),
]
