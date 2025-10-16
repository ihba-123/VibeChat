# chat/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.shortcuts import get_object_or_404
from .models import ChatRoom, Message
from authentication.models import User


class ChatConsumer(AsyncWebsocketConsumer):
  async def connect(self):
    self.room_name = self.scope['url_route']['kwargs']['room_name']
    self.user = self.scope['user'] #attach user to consumer

    self.room = await database_sync_to_async(get_object_or_404)(ChatRoom, id=self.room_name)

    #Checking wheatjer user is a participant of the room and authenticated or not
    if not self.user.is_authenticated or not await self.is_participant():
      await self.close(code=403)
      return
    
    self.room_group_name = f'chat_{self.room_name}'

    # Join room group  
    await self.channel_layer.group_add(
      self.room_group_name,
      self.channel_name
    )

    await self.accept()

  async def disconnect(self , close_code):
        if hasattr(self , 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

  async def receive(self , text_data):
    try:
        data = json.loads(text_data)
    except json.JSONDecodeError:
        await self.send(text_data=json.dumps({'error': 'Invalid JSON'}))
        return
  
    msg_type = data.get('type')
    if msg_type == 'chat_message':
        await self.handle_chat_message(data) 
    elif msg_type == 'read-receipt':
        await self.handle_read_receipt(data)
    else:
        await self.send(text_data=json.dumps({'type': 'error' , 'message': 'Invalid message type'}))

#Helper methods for handeling the handle_chat_message and handle_read_receipt

  async def handle_chat_message(self , data):      
  #process wheather the chatmessaage is attachment or image or file
    attachment = data.get("attachment", None)
    images = data.get("images", None)
    content = data.get("content" , "")

    if not content and not images and not attachment:
        await self.send(text_data=json.dumps({"type":"error","message":"Message must have content, attachment, or images"}))
        return
  
    message = await self.save_message(content, attachment, images)

   # Broadcast the message to all participants
    await self.channel_layer.group_send(
        self.room_group_name,
        {
            "type": "chat_message_event",
            "message": {
                "id": message.id,
                "sender": self.user.email,
                "content": content,
                "attachment": attachment,
                "images": images,
                "timestamp": message.timestamp.isoformat(),
                "is_group": self.room.is_group,
            },
        }
    )

  async def handle_read_receipt(self, data):
     message_id = data.get("message_id")
     if not message_id:
        await self.send(text_data=json.dumps({"type":"error","message":"Message ID is required"}))
        return
     
     #Mark message read in db and broadcast
     await self.mark_message_as_read(message_id)

 
  #Helper method of chat_message_event
  async def chat_message_event(self, event):
        await self.send(text_data=json.dumps({
            "type": "chat_message",
            "message": event["message"]
        }))

  async def read_receipt_event(self, event):
        await self.send(text_data=json.dumps({
            "type": "read_receipt",
            "message_id": event["message_id"],
            "user": event["user"]
        }))


#Database helper methods 
  @database_sync_to_async
  #checking wheather the user is participants of the room
  def is_participant(self):
     return self.room.participants.filter(id=self.user.id).exists()
  
  #To save new messge in db
  @database_sync_to_async
  def save_message(self, content, attachment, images):
      
      return Message.objects.create(
            chat_room=self.room,
            sender=self.user,
            content=content,
            attachment=attachment,
            images=images
        )
  
  async def mark_message_as_read(self, message_id):
      message = await database_sync_to_async(get_object_or_404)(Message, id=message_id , chat_room=self.room)
      await database_sync_to_async(message.read_by.add)(self.user)

      #Broadcast read message
      await self.channel_layer.group_send(
          self.room_group_name,
            {
                "type": "read_receipt_event",
                "message_id": message_id,
                "user": self.user.email
            }
      )
