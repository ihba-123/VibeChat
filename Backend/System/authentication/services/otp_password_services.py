import logging

from django.contrib.auth import get_user_model
from django.db import transaction

# Shared with chatapp so a cache outage degrades instead of returning a 500 on the
# one flow a locked-out user needs.
from chatapp.cache_utils import safe_add, safe_delete, safe_incr, safe_set

from ..models import PasswordResetOtp
from ..tasks import send_otp_email_task

User = get_user_model()
logger = logging.getLogger(__name__)


# ------------------------------
# Rate limiting helper
# ------------------------------
def rate_limit_key(email: str, action: str) -> str:
    return f"rate_limit:{action}:{email.lower()}"


def check_rate_limit(email: str, action: str, limit: int = 5, period_sec: int = 3600) -> bool:
    """True when the caller is over budget. Backed by the shared Redis cache."""
    key = rate_limit_key(email, action)
    # add() then incr() is atomic, so concurrent requests cannot both read the same
    # count and each conclude they are under the limit.
    if safe_add(key, 1, period_sec):
        return False
    attempts = safe_incr(key)
    if attempts is None:
        safe_set(key, 1, period_sec)
        return False
    return attempts > limit


# ------------------------------
# OTP services
# ------------------------------
def generate_and_send_otp(email: str):
    try:
        user = User.objects.get(email=email, is_active=True)
    except User.DoesNotExist:
        # Logged, but the caller returns the same response either way so the
        # endpoint cannot be used to enumerate registered addresses.
        logger.info("OTP requested for unknown email: %s", email)
        return

    _, otp = PasswordResetOtp.create_otp_for_user(user)

    send_otp_email_task.delay(email=email, otp=otp, user_id=user.id)
    logger.info("OTP queued for user_id=%s", user.id)


def _latest_otp(email: str):
    try:
        user = User.objects.get(email=email, is_active=True)
    except User.DoesNotExist:
        return None, None
    otp_row = (
        PasswordResetOtp.objects.filter(user=user, is_used=False)
        .order_by("-created_at")
        .first()
    )
    return user, otp_row


def verify_otp(email: str, otp: str, peek: bool = False) -> bool:
    _, otp_row = _latest_otp(email)
    if otp_row is None:
        return False
    return otp_row.verify_otp(otp, consume=not peek)


def reset_password(email: str, otp: str, new_password: str) -> bool:
    user, otp_row = _latest_otp(email)
    if otp_row is None or not otp_row.verify_otp(otp, consume=True):
        return False

    with transaction.atomic():
        user.set_password(new_password)
        user.save(update_fields=["password", "updated_at"])
        PasswordResetOtp.objects.filter(user=user).update(is_used=True)

    _revoke_sessions(user)
    safe_delete(rate_limit_key(email, "forgot"))
    logger.info("Password reset completed for user_id=%s", user.id)
    return True


def _revoke_sessions(user):
    """Blacklist the user's outstanding refresh tokens after a password reset.

    Without this, a session opened by whoever prompted the reset stays usable.
    """
    try:
        from rest_framework_simplejwt.token_blacklist.models import (
            BlacklistedToken,
            OutstandingToken,
        )
    except ImportError:  # pragma: no cover - blacklist app not installed
        return

    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)
