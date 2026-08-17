from django.db import models
from django.contrib.auth.models import BaseUserManager, AbstractBaseUser
from django.utils import timezone
from datetime import timedelta
import pyotp
import binascii


# Custom User Manager
class UserManager(BaseUserManager):
    def create_user(self, email, name, password=None, photo=None, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address")

        user = self.model(
            email=self.normalize_email(email),
            name=name,
            **extra_fields
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, name, password=None, **extra_fields):
        user = self.create_user(
            email=email,
            name=name,
            password=password,
            **extra_fields
        )
        user.is_admin = True
        user.is_superuser = True
        user.save(using=self._db)
        return user


# Custom User Model
class User(AbstractBaseUser):
    email = models.EmailField(max_length=255, unique=True)
    name = models.CharField(max_length=200)
    is_active = models.BooleanField(default=True)
    is_admin = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["name"]

    def __str__(self):
        return self.email

    def has_perm(self, perm, obj=None):
        return self.is_admin or self.is_superuser

    def has_module_perms(self, app_label):
        return True

    @property
    def is_staff(self):
        return self.is_admin




#For forget password
class PasswordResetOtp(models.Model):
    user = models.ForeignKey(User , on_delete=models.CASCADE)
    is_used = models.BooleanField(default=False)
    otp_hash = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    attempts = models.IntegerField(default=0)

    OTP_VALIDITY_MINUTES = 10
    MAX_ATTEMPTS = 5    

    def __str__(self):
        return f"Password Reset OTP for {self.user.email}"
    
    # TOTP steps are aligned to absolute time, so a code generated late in a step
    # would otherwise be rejected only moments later. The validity window above is
    # enforced by created_at; this just keeps the step boundary from cutting it short.
    OTP_INTERVAL_SECONDS = 600
    OTP_VALID_WINDOW = 1

    def save(self, *args, **kwargs):
        if not self.pk:
            # Retire the user's earlier codes so only the newest one can be used.
            PasswordResetOtp.objects.filter(user=self.user, is_used=False).update(is_used=True)
        super().save(*args, **kwargs)

    @classmethod
    def create_otp_for_user(cls, user):
        secret = pyotp.random_base32()
        totp = pyotp.TOTP(secret, interval=cls.OTP_INTERVAL_SECONDS)
        otp = totp.now()

        obj = cls.objects.create(user=user, otp_hash=secret)
        return obj, otp

    @property
    def is_expired(self):
        return (timezone.now() - self.created_at) > timedelta(minutes=self.OTP_VALIDITY_MINUTES)

    def verify_otp(self, otp_input, consume=True):
        """Check a submitted code.

        ``consume=False`` lets the UI validate a code without spending it, so the
        two-step "verify, then choose a new password" flow does not invalidate the
        code before the reset request arrives.
        """
        if self.is_used or self.attempts >= self.MAX_ATTEMPTS or self.is_expired:
            return False

        totp = pyotp.TOTP(self.otp_hash, interval=self.OTP_INTERVAL_SECONDS)
        if totp.verify(otp_input, valid_window=self.OTP_VALID_WINDOW):
            if consume:
                self.is_used = True
                self.save(update_fields=['is_used'])
            return True

        # Counted even on a peek, so repeated guessing is still capped.
        self.attempts += 1
        self.save(update_fields=['attempts'])
        return False

    @classmethod
    def cleanup_expired(cls):
        """Call this periodically (e.g., via Celery beat or management command)"""
        expired = timezone.now() - timedelta(minutes=cls.OTP_VALIDITY_MINUTES)
        cls.objects.filter(created_at__lt=expired, is_used=True).delete()    
