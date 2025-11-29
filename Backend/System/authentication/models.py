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
    is_created = models.DateTimeField(auto_now_add=True)
    attempts = models.IntegerField(default=0)

    OTP_VALIDITY_MINUTES = 10
    MAX_ATTEMPTS = 5    

    def __str__(self):
        return f"Password Reset OTP for {self.user.email}"
    
    def save(self , *args, **kwargs):
        # Generate and set the OTP hash and remove old OTPs
        if not self.pk:
            PasswordResetOtp.objects.filter(
                user = self.user,
                is_used = False
            ).exclude(created_at__gte=timezone.now()-timedelta(minutes=self.OTP_VALIDITY_MINUTES)).delete()
        
        super().save(*args, **kwargs)

     
    @classmethod
    def create_otp_for_user( cls , user):
        secret = pyotp.random.base32()
        totp = pyotp.TOTP(secret, interval=600)
        otp = otp.now()

        obj = cls.objects.create(
            user=user,
            otp=secret                
        )
        return obj , otp
    def verify_otp(self, otp_input):
        if self.is_used or self.attempts >= self.MAX_ATTEMPTS:
            return False

        if (timezone.now() - self.created_at) > timedelta(minutes=self.OTP_VALIDITY_MINUTES):
            return False

        totp = pyotp.TOTP(self.otp_hash, interval=600)
        if totp.verify(otp_input):
            self.is_used = True
            self.save()
            return True
        else:
            self.attempts += 1
            self.save()
            return False

    @classmethod
    def cleanup_expired(cls):
        """Call this periodically (e.g., via Celery beat or management command)"""
        expired = timezone.now() - timedelta(minutes=cls.OTP_VALIDITY_MINUTES)
        cls.objects.filter(created_at__lt=expired, is_used=True).delete()    
