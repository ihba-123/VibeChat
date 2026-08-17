import logging

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from ..services.otp_password_services import (
    check_rate_limit,
    generate_and_send_otp,
    reset_password,
    verify_otp,
)

logger = logging.getLogger(__name__)


def _validated_password(password, field='password'):
    """Run Django's password validators and surface failures as a 400."""
    try:
        validate_password(password)
    except DjangoValidationError as exc:
        raise ValidationError({field: list(exc.messages)})
    return password


class ForgotPasswordView(APIView):
    # These endpoints must stay public. The project default is now
    # IsAuthenticated, so omitting this would lock a user out of password reset
    # precisely when they cannot sign in.
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'otp'

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        if not email:
            return Response({'detail': 'Email is required.', 'code': 'invalid'}, status=400)

        if check_rate_limit(email, 'forgot'):
            return Response(
                {'detail': 'Too many requests. Please try again later.', 'code': 'throttled'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        generate_and_send_otp(email)
        # Deliberately identical whether or not the address exists, so this cannot
        # be used to enumerate accounts.
        return Response({'detail': 'If that email is registered, a code has been sent.'}, status=200)


class VerifyOTPView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'otp'

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        otp = (request.data.get('otp') or '').strip()

        if not email or not otp.isdigit() or len(otp) != 6:
            return Response(
                {'detail': 'A valid email and 6-digit code are required.', 'code': 'invalid'},
                status=400,
            )

        # peek=True so simply checking the code does not consume it; the reset step
        # verifies it again for real.
        if not verify_otp(email, otp, peek=True):
            return Response({'detail': 'Invalid or expired code.', 'code': 'invalid_otp'}, status=400)

        return Response({'detail': 'Code verified.'}, status=200)


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'otp'

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        otp = (request.data.get('otp') or '').strip()
        new_password = request.data.get('password') or ''

        if not all([email, otp, new_password]):
            return Response({'detail': 'All fields are required.', 'code': 'invalid'}, status=400)

        _validated_password(new_password)

        if not reset_password(email, otp, new_password):
            return Response({'detail': 'Invalid or expired code.', 'code': 'invalid_otp'}, status=400)

        return Response({'detail': 'Password reset successful. You can sign in now.'}, status=200)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        old_password = request.data.get('old_password') or ''
        new_password = request.data.get('new_password') or ''

        if not request.user.check_password(old_password):
            return Response(
                {'detail': 'Current password is incorrect.', 'code': 'invalid_password'}, status=400
            )
        if old_password == new_password:
            return Response(
                {'detail': 'New password must be different from the current one.', 'code': 'invalid'},
                status=400,
            )

        _validated_password(new_password, field='new_password')

        request.user.set_password(new_password)
        request.user.save(update_fields=['password', 'updated_at'])
        logger.info('Password changed for user %s', request.user.pk)

        return Response({'detail': 'Password changed successfully.'}, status=200)
