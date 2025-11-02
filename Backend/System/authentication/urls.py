from django.urls import path 
from .view.registration_view import UserRegistrationView
from .view.login_views import UserLoginView
from .view.user_logout_views import UserLogoutView
from .view.user_profile_views import UserProfileView
from .view.token_views import RefreshTokenView
urlpatterns = [
    path('register/', UserRegistrationView.as_view(), name='register' ),
    path('refresh-token/', RefreshTokenView.as_view(), name='refresh-token'),
    path('login/', UserLoginView.as_view(), name='login'),
    path('profile/', UserProfileView.as_view(), name='profile'),
    path('logout/', UserLogoutView.as_view(), name='logout'),
]
