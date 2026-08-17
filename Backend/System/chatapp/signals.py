import logging

from django.contrib.auth.signals import user_logged_in, user_logged_out
from django.db.models.signals import post_save
from django.dispatch import receiver

from authentication.models import User

from .models import Profile

logger = logging.getLogger(__name__)


@receiver(post_save, sender=User)
def create_profile(sender, instance, created, **kwargs):
    """Every user needs a Profile; most of the API dereferences ``user.profile``."""
    if created:
        Profile.objects.get_or_create(user=instance)
        logger.info("Profile created for user %s", instance.email)


# Session-based logins (admin, allauth social flow). The JWT login path sets this
# explicitly in its service, and live presence is owned by the WebSocket layer.
@receiver(user_logged_in)
def set_user_online(sender, request, user, **kwargs):
    Profile.objects.filter(user=user).update(is_online=True)


@receiver(user_logged_out)
def set_user_offline(sender, request, user, **kwargs):
    if user is None:
        return
    Profile.objects.filter(user=user).update(is_online=False)


# Note on default images: the previous versions of this module wrote a hardcoded
# Cloudinary public id onto every new Profile and ChatRoom from inside post_save,
# which re-entered the same signal and made "user has uploaded an avatar"
# impossible to distinguish from "user has the default". Defaults now live in
# settings and are applied by the serializers when the field is empty.
