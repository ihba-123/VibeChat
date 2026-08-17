from django.db import models, transaction
from django.db.models import Q

from authentication.models import User

from .storage import image_storage, raw_storage
from .utils.encryption import is_encrypted, message_decode, message_encrypt


# Profile Model (Friends)

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile", db_index=True)
    friends = models.ManyToManyField(User, blank=True, related_name="friends" ,db_index=True)
    is_online = models.BooleanField(default=False,db_index=True)
    bio = models.TextField(blank=True, null=True)
    photo = models.ImageField(
        upload_to='avatars/', storage=image_storage, blank=True, null=True
    )

    class Meta:
        indexes =[
            models.Index(fields=['user']),
            models.Index(fields=['is_online']),
        ]
        verbose_name = 'Profile'
        verbose_name_plural= 'Profiles'

    @staticmethod
    def for_user(user):
        """Profile for ``user``, creating it if a signal was missed."""
        profile, _ = Profile.objects.get_or_create(user=user)
        return profile

    def add_friend(self, friend_user):
        """Add a friend symmetrically."""
        other = Profile.for_user(friend_user)
        self.friends.add(friend_user)
        other.friends.add(self.user)

    def remove_friend(self, friend_user):
        """Remove a friend symmetrically."""
        other = Profile.for_user(friend_user)
        self.friends.remove(friend_user)
        other.friends.remove(self.user)

    def __str__(self):
        return f"Profile for user {self.user.email}"



# FriendRequest Model

class FriendRequest(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
    )

    from_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_friend_requests', db_index=True)
    to_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_friend_requests', db_index=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('from_user', 'to_user')

    def __str__(self):
        return f"Friend request from {self.from_user.email} to {self.to_user.email}"



# ChatRoom Model

class ChatRoom(models.Model):
    name = models.CharField(max_length=255, blank=True, null=True)
    is_group = models.BooleanField(default=False,db_index=True)
    participants = models.ManyToManyField(User, related_name="chat_rooms")
    admin = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="admin_rooms")
    group_image = models.ImageField(upload_to='group_images/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True,db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=["is_group"]),
            models.Index(fields=["created_at"]),
        ]
        verbose_name = "Chat Room"
        verbose_name_plural = "Chat Rooms"

    @classmethod
    def find_private_chat(cls, user1, user2):
        """The 1:1 room shared by both users, or None. Never writes."""
        if user1.pk == user2.pk:
            return None

        candidates = (
            cls.objects.filter(is_group=False, participants=user1)
            .filter(participants=user2)
            .order_by("id")
            .prefetch_related("participants")
        )

        # The membership check is done in Python rather than with an annotated
        # Count: chaining two filters on `participants` and then aggregating over
        # the same relation makes Django reuse one of the constrained joins, so the
        # count comes back as 1 and never matches. The candidate set here is
        # normally a single row, so the prefetch is cheap.
        wanted = {user1.pk, user2.pk}
        for room in candidates:
            if {p.pk for p in room.participants.all()} == wanted:
                return room
        return None

    @classmethod
    def get_private_chat(cls, user1, user2):
        """Get or create the 1:1 room for two users."""
        existing = cls.find_private_chat(user1, user2)
        if existing:
            return existing

        with transaction.atomic():
            # Re-check inside the transaction so two concurrent openers of the same
            # conversation cannot each create a room.
            existing = cls.find_private_chat(user1, user2)
            if existing:
                return existing
            chat = cls.objects.create(is_group=False)
            chat.participants.add(user1, user2)
        return chat

    def add_participant(self, user):
        """Add a user to the chat room."""
        self.participants.add(user)

    def remove_participant(self, user):
        """Remove a user from the chat room."""
        self.participants.remove(user)

    def display_name_for(self, user):
        """Group name, or the other member's name for a private room."""
        if self.is_group:
            return self.name or f"Group Chat ({self.pk})"
        other = next((p for p in self.participants.all() if p.pk != user.pk), None)
        return other.name or other.email if other else "Empty conversation"

    def __str__(self):
        if self.is_group:
            return self.name or f"Group Chat ({self.pk})"
        else:
            participant_names = ", ".join([p.email for p in self.participants.all()])
            return f"Private Chat: {participant_names}" if participant_names else f"Private Chat ({self.pk})"



# Message Model

class MessageQuerySet(models.QuerySet):
    def with_sender(self):
        """Avoid the per-message sender/profile lookups the serializer would do."""
        return self.select_related("sender", "sender__profile")

    def unread_for(self, user):
        return self.exclude(sender=user).exclude(read_by=user)


class Message(models.Model):
    chat_room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name="messages",db_index=True)
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sent_messages",db_index=True)
    content = models.TextField(blank=True)
    attachment = models.FileField(
        upload_to='attachments/', storage=raw_storage, blank=True, null=True
    )
    images = models.ImageField(
        upload_to='images/', storage=image_storage, blank=True, null=True
    )
    timestamp = models.DateTimeField(auto_now_add=True)
    read_by = models.ManyToManyField(User, blank=True, related_name="read_messages",db_index=True)
    is_read = models.BooleanField(default=False,db_index=True)

    objects = MessageQuerySet.as_manager()

    class Meta:
        indexes = [
            models.Index(fields=["chat_room", "timestamp"]),
            models.Index(fields=["sender"]),
        ]
        ordering = ["timestamp"]
        verbose_name = "Message"
        verbose_name_plural = "Messages"

    def save(self , *args, **kwargs):
        # Encrypt on the way in, but only once: this used to re-encrypt on every
        # save, so any second save (marking a message read, an admin edit) buried
        # the plaintext under a second layer and broke decryption.
        if self.content and not is_encrypted(self.content):
            self.content = message_encrypt(self.content)
        super().save(*args, **kwargs)

    @property
    def decrypted_content(self):
        if not self.content:
            return ""
        try:
            return message_decode(self.content)
        except Exception:
            # Rows written before encryption existed are stored as plaintext.
            return self.content

    def __str__(self):

        return f"Message from {self.sender.email} to {self.chat_room.name} at {self.timestamp}"



# BlockedUser Model

class BlockedUser(models.Model):
    blocker = models.ForeignKey(User, on_delete=models.CASCADE, related_name="blocking",db_index=True)
    blocked = models.ForeignKey(User, on_delete=models.CASCADE, related_name="blocked_by",db_index=True)
    blocked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('blocker', 'blocked')
        indexes = [
            models.Index(fields=['blocker']),
            models.Index(fields=['blocked']),
        ]
        verbose_name = "Blocked User"
        verbose_name_plural = "Blocked Users"

    @staticmethod
    def blocked_ids_for(user):
        """Every user id ``user`` cannot talk to, in either direction — one query."""
        rows = BlockedUser.objects.filter(
            Q(blocker=user) | Q(blocked=user)
        ).values_list("blocker_id", "blocked_id")
        return {
            other for blocker_id, blocked_id in rows
            for other in (blocker_id, blocked_id)
            if other != user.pk
        }

    def __str__(self):
        return f"{self.blocker.email} blocked {self.blocked.email}"
