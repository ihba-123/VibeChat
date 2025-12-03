from celery import shared_task
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

@shared_task(
    bind=True,
    autoretry_for=(Exception,),                 # retry on any exception
    retry_kwargs={'max_retries': 5},
    retry_backoff=60,                            # 60s, 120s, 240s, 480s, 960s → ~20 min total
    retry_jitter=True,                           # avoid thundering herd
    acks_late=True,                              # CRITICAL: only ack after success
    time_limit=60,                               # kill task if stuck >60s
    soft_time_limit=50,
    queue='emails',                              # optional: separate queue for emails
)
def send_otp_email_task(self, email: str, otp: str, user_id: int = None):
    
    log_prefix = f"[User ID: {user_id}]" if user_id else ""
    try:
        context = {"otp": otp}
        text_content = render_to_string("emails/otp.txt", context)
        html_content = render_to_string("emails/otp.html", context)

        msg = EmailMultiAlternatives(
            subject="Your Secure Password Reset Code",
            body=text_content,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[email],
        )
        msg.attach_alternative(html_content, "text/html")
        msg.send()

        logger.info(f"{log_prefix} OTP email successfully sent to {email}")
        return True

    except Exception as exc:
        logger.error(
            f"{log_prefix} OTP email FAILED (attempt {self.request.retries + 1}/6) to {email}: {exc}",
            exc_info=True
        )
        # This will trigger retry with backoff
        raise self.retry(exc=exc)