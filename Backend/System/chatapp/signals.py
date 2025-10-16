from .models import *
from django.contrib.auth.signals import user_logged_in, user_logged_out
from django.db.models.signals import post_save
from django.dispatch import receiver
import logging

logger = logging.getLogger(__name__)


# Auto-create profile for new users
@receiver(post_save, sender=User)
def create_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)
        logger.info(f"Profile created for user {instance.email}")


# Set user online/offline   
@receiver(user_logged_in)
def set_user_online(sender, request, user, **kwargs):
    profile, _ = Profile.objects.get_or_create(user=user)
    profile.is_online = True
    profile.save()
    logger.info(f"User {user.email} is online")

@receiver(user_logged_out)
def set_user_offline(sender, request, user, **kwargs):
    try:
        profile = Profile.objects.get(user=user)
        profile.is_online = False
        profile.save()
        logger.info(f"User {user.email} is offline")
    except Profile.DoesNotExist:
        logger.error(f"Profile does not exist for user {user.email}")


# Set default group image for ChatRoom
@receiver(post_save, sender=ChatRoom)
def set_default_group_image(sender, instance, created, **kwargs):
    if created and not instance.group_image:
        instance.group_image = "chatroom/default_group_image.jpg"
        instance.save()
        logger.info(f"Default group image set for ChatRoom {instance.id}")
    else:
        logger.info(f"Default group image already set for ChatRoom {instance.id}")



# Default Photo for Profile
@receiver(post_save , sender=Profile)  
def set_default_profile_photo(sender,instance, created , **kwargs):
    if created and not instance.photo:  
        instance.photo = "defaults/Default_Image_rpwtrc"
        instance.save(update_fields=['photo'])
        logger.info(f"Default profile photo set for Profile {instance.id}")
    else:
        logger.info(f"Default profile photo already set for Profile {instance.id}")


    

