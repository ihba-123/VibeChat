from django.contrib import admin
from .models import *
# Register your models here.
@admin.register(ChatRoom)
class ChatRoomAdmin(admin.ModelAdmin):
  list_display = ('id','name', 'is_group', 'created_at')
  search_fields = ('name',)

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
  list_display = ('sender', 'chat_room', 'timestamp')
  search_fields = ('sender__email', 'chat_room__name')
  list_filter = ('chat_room__name',)


@admin.register(FriendRequest)
class FriendRequestAdmin(admin.ModelAdmin):
  list_display = ('id','from_user', 'to_user', 'status', 'created_at')
  search_fields = ('from_user__email', 'to_user__email')
  list_filter = ('status',)



@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
  list_display = ('id','user', 'is_online', 'bio', 'photo')
  search_fields = ('user__email',)
  list_filter = ('is_online',)