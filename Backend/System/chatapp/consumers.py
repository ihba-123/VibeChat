# chat/consumers.py
import json
from typing import Any
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.shortcuts import get_object_or_404
from .models import ChatRoom, Message, User


class ChatConsumer(AsyncWebsocketConsumer):

    async def connect(self):
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.user = self.scope["user"]

        self.room = await self._get_room(self.room_id)
        if not self.user.is_authenticated or not await self.is_participant():
            await self.close(code=4003)
            return

        self.room_group_name = f"chat_{self.room_id}"
        await self.channel_layer.group_add(self.room_group_name, self.channel_name)
        await self.accept()

        # Set user online and broadcast
        await self.set_user_online_status(True)
        await self.broadcast_online_status(True)

        # send offline/unread messages
        unread_messages = await self.get_unread_messages()
        for msg in unread_messages:
            await self.send(text_data=json.dumps(msg))

        # mark offline messages as read
        await self.mark_unread_messages_as_read()

    async def disconnect(self, close_code):
        await self.set_user_online_status(False)
        await self.broadcast_online_status(False)
        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)

    # -----------------------------
    # RECEIVE
    # -----------------------------
    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            await self._send_error("Invalid JSON")
            return

        msg_type = data.get("type")
        if msg_type == "chat_message":
            await self.handle_chat_message(data)
        elif msg_type == "read_receipt":
            await self.handle_read_receipt(data)
        else:
            await self._send_error("Invalid message type")

    # -----------------------------
    # HANDLERS
    # -----------------------------
    async def handle_chat_message(self, data):
        content = data.get("content", "")
        attachment = data.get("attachment")
        images = data.get("images")

        if not (content or attachment or images):
            await self._send_error("Message must have content, attachment, or images")
            return

        message_data = await self.save_message(content, attachment, images)

        # broadcast to group
        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "chat_message_event", "message": message_data},
        )

    async def handle_read_receipt(self, data):
        message_id = data.get("message_id")
        if not message_id:
            await self._send_error("Message ID is required")
            return
        await self.mark_message_as_read(message_id)

    # -----------------------------
    # CHANNEL EVENTS
    # -----------------------------
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

    async def user_status(self, event):
        await self.send(text_data=json.dumps({
            "type": "user_status",
            "user_id": event["user_id"],
            "status": event["status"]
        }))

    # -----------------------------
    # DATABASE HELPERS
    # -----------------------------
    @database_sync_to_async
    def _get_room(self, room_id):
        return get_object_or_404(ChatRoom, id=room_id)

    @database_sync_to_async
    def is_participant(self):
        return self.room.participants.filter(id=self.user.id).exists()

    @database_sync_to_async
    def save_message(self, content, attachment=None, images=None):
        msg = Message.objects.create(
            chat_room=self.room,
            sender=self.user,
            content=content,
            attachment=attachment,
            images=images,
        )
        return {
            "id": msg.id,
            "sender": getattr(msg.sender, "username", msg.sender.email),
            "content": msg.decrypted_content,
            "attachment": msg.attachment.url if msg.attachment else None,
            "images": msg.images.url if msg.images else None,
            "timestamp": msg.timestamp.isoformat(),
            "is_group": self.room.is_group,
        }

    @database_sync_to_async
    def get_unread_messages(self):
        unread_qs = Message.objects.filter(chat_room=self.room, is_read=False).exclude(sender=self.user).order_by("timestamp")
        return [
            {
                "id": msg.id,
                "sender": getattr(msg.sender, "username", msg.sender.email),
                "content": msg.decrypted_content,
                "attachment": msg.attachment.url if msg.attachment else None,
                "images": msg.images.url if msg.images else None,
                "timestamp": msg.timestamp.isoformat(),
                "offline": True
            } for msg in unread_qs
        ]

    @database_sync_to_async
    def mark_unread_messages_as_read(self):
        unread = Message.objects.filter(chat_room=self.room, is_read=False).exclude(sender=self.user)
        unread.update(is_read=True)
        for msg in unread:
            msg.read_by.add(self.user)

    @database_sync_to_async
    def _get_message(self, message_id):
        return get_object_or_404(Message, id=message_id, chat_room=self.room)

    async def mark_message_as_read(self, message_id):
        msg = await self._get_message(message_id)
        await database_sync_to_async(msg.read_by.add)(self.user)
        await self.channel_layer.group_send(
            self.room_group_name,
            {"type": "read_receipt_event", "message_id": message_id, "user": getattr(self.user, "username", self.user.email)}
        )

    @database_sync_to_async
    def set_user_online_status(self, status: bool):
        self.user.profile.is_online = status
        self.user.profile.save()

    @database_sync_to_async
    def get_friend_ids(self):
        return list(self.user.profile.friends.values_list("id", flat=True))

    async def broadcast_online_status(self, status: bool):
        friend_ids = await self.get_friend_ids()
        for friend_id in friend_ids:
            friend_user = await database_sync_to_async(User.objects.get)(id=friend_id)
         
            room = await database_sync_to_async(ChatRoom.get_private_chat)(self.user, friend_user)
            room_group_name = f"chat_{room.id}"
            await self.channel_layer.group_send(
                room_group_name,
                {"type": "user_status", "user_id": self.user.id, "status": status}
        )


    # -----------------------------
    # UTILS
    # -----------------------------
    async def _send_error(self, message):
        await self.send(text_data=json.dumps({"type": "error", "message": message}))
