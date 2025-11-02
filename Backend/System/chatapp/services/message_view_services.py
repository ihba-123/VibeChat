from rest_framework import status
from rest_framework.response import Response  
from rest_framework.pagination import PageNumberPagination
from ..models import Message, ChatRoom
from ..serializer import ChatUserSerializer
from django.shortcuts import get_object_or_404

def message_list_view(room_id,user):
    chat_room = get_object_or_404(ChatRoom, id=room_id)

        # Check if user is participant
    if not chat_room.participants.filter(id=user.id).exists():
        raise PermissionError("You are not a participant of this chat room.")
    
    messages = Message.objects.filter(chat_room=chat_room).order_by('timestamp')  # oldest first
    return messages




