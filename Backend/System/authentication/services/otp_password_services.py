from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils import timezone
from ..models import PasswordResetOtp
from ..tasks import send_otp_email_task
import logging

User = get_user_model()
logger = logging.getLogger(__name__)

# ------------------------------
# Rate limiting helper
# ------------------------------
def rate_limit_key(email: str, action: str) -> str:
    return f"rate_limit:{action}:{email.lower()}"

def check_rate_limit(email: str, action: str, limit: int = 5, period_sec: int = 3600) -> bool:
    """
    Returns True if rate limit exceeded
    """
    key = rate_limit_key(email, action)
    attempts = cache.get(key, 0)
    if attempts >= limit:
        return True
    cache.set(key, attempts + 1, period_sec)
    return False

# ------------------------------
# OTP services
# ------------------------------
def generate_and_send_otp(email: str):
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        logger.info(f"OTP requested for non-existent email: {email}")
        return

    # Create OTP
    otp_obj, otp = PasswordResetOtp.create_otp_for_user(user)

    # Send OTP asynchronously via Celery
    send_otp_email_task.delay(email=email, otp=otp, user_id=user.id)
    logger.info(f"OTP generated and queued for {email} (user_id={user.id})")

def verify_otp(email: str, otp: str) -> bool:
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return False

    latest_otp = PasswordResetOtp.objects.filter(
        user=user, is_used=False
    ).order_by('-created_at').first()

    if not latest_otp:
        return False

    return latest_otp.verify_otp(otp)

def reset_password(email: str, otp: str, new_password: str) -> bool:
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return False

    latest_otp = PasswordResetOtp.objects.filter(
        user=user, is_used=False
    ).order_by('-created_at').first()

    if not latest_otp or not latest_otp.verify_otp(otp):
        return False

    # Change password
    user.set_password(new_password)
    user.save()

    # Invalidate all OTPs
    PasswordResetOtp.objects.filter(user=user).update(is_used=True)

    logger.info(f"Password reset successful for {email} (user_id={user.id})")
    return True
