from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

def attachment_services(user , chat_room , serializer):
  
    message = serializer.save(sender=user, chat_room=chat_room)
    print("Message ----->",message)
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
                f"chat_{chat_room.id}",
                {
                    "type": "chat_message_event",
                    "message": {
                        "id": message.id,
                        "sender": user.email,
                        "content": message.content,
                        "attachment": getattr(message.attachment, 'url', None),
                        "images": getattr(message.images, 'url', None),
                        "timestamp": message.timestamp.isoformat(),
                        "is_group": chat_room.is_group,
                    },
                },
            )
    return message
  