from django.urls import path

from .view.login_views import UserLoginView
from .view.otp_password_views import (
    ChangePasswordView,
    ForgotPasswordView,
    ResetPasswordView,
    VerifyOTPView,
)
from .view.registration_view import UserRegistrationView
from .view.social_views import SessionTokenExchangeView
from .view.token_views import RefreshTokenView
from .view.user_logout_views import UserLogoutView
from .view.user_profile_views import UserProfileView

urlpatterns = [
    path('register/', UserRegistrationView.as_view(), name='register'),
    path('login/', UserLoginView.as_view(), name='login'),
    path('logout/', UserLogoutView.as_view(), name='logout'),
    path('refresh-token/', RefreshTokenView.as_view(), name='refresh-token'),
    path('profile/', UserProfileView.as_view(), name='profile'),

    # Google / allauth session -> JWT
    path('auth/session-token/', SessionTokenExchangeView.as_view(), name='session-token'),

    path('password/forgot/', ForgotPasswordView.as_view(), name='forgot-password'),
    path('password/verify-otp/', VerifyOTPView.as_view(), name='verify-otp'),
    path('password/reset/', ResetPasswordView.as_view(), name='reset-password'),
    path('password/change/', ChangePasswordView.as_view(), name='change-password'),
]
