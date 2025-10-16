from django.db import models
from authentication.models import User  
from cloudinary.models import CloudinaryField

# Profile Model (Friends)

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    friends = models.ManyToManyField(User, blank=True, related_name="friends")
    is_online = models.BooleanField(default=False)
    bio = models.TextField(blank=True, null=True)
    photo = CloudinaryField('image', blank=True, null=True)
    def add_friend(self, friend_user):
        """Add a friend symmetrically."""
        if not self.friends.filter(pk=friend_user.pk).exists():
            self.friends.add(friend_user)
            friend_user.profile.friends.add(self.user)

    def remove_friend(self, friend_user):
        """Remove a friend symmetrically."""
        if self.friends.filter(pk=friend_user.pk).exists():
            self.friends.remove(friend_user)
            friend_user.profile.friends.remove(self.user)

    def __str__(self):
        return f"Profile for user {self.user.email}"



# FriendRequest Model

class FriendRequest(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('rejected', 'Rejected'),
    )

    from_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_friend_requests')
    to_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_friend_requests')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('from_user', 'to_user')

    def __str__(self):
        return f"Friend request from {self.from_user.email} to {self.to_user.email}"



# ChatRoom Model

class ChatRoom(models.Model):
    name = models.CharField(max_length=255, blank=True, null=True)
    is_group = models.BooleanField(default=False)
    participants = models.ManyToManyField(User, related_name="chat_rooms")
    admin = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="admin_rooms")
    group_image = models.ImageField(upload_to='group_images/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @classmethod
    def get_private_chat(cls, user1, user2):
        chat_rooms = cls.objects.filter(is_group=False, participants=user1).filter(participants=user2)
        for chat in chat_rooms:
            if chat.participants.count() == 2:
                return chat
        
        chat=cls.objects.create(is_group=False)
        chat.participants.add(user1, user2)
        return chat


    def add_participant(self, user):
        """Add a user to the chat room."""
        if not self.participants.filter(pk=user.pk).exists():
            self.participants.add(user)

    def remove_participant(self, user):
        """Remove a user from the chat room."""
        if self.participants.filter(pk=user.pk).exists():
            self.participants.remove(user)

    def __str__(self):
        if self.is_group:
            return self.name or f"Group Chat ({self.pk})"
        else:
            participant_names = ", ".join([p.email for p in self.participants.all()])
            return f"Private Chat: {participant_names}" if participant_names else f"Private Chat ({self.pk})"



# Message Model

class Message(models.Model):
    chat_room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE, related_name="messages")
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sent_messages")
    content = models.TextField(blank=True)
    attachment = CloudinaryField('attachment', blank=True, null=True,resource_type='raw')
    images = CloudinaryField('image', blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    read_by = models.ManyToManyField(User, blank=True, related_name="read_messages")

    def __str__(self):

        return f"Message from {self.sender.email} to {self.chat_room.name} at {self.timestamp}"
