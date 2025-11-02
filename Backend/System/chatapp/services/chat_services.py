from django.shortcuts import get_object_or_404
from ..models import ChatRoom, User

def create_chat_room(user, participant_ids, name, is_group=False):
    # Validate for private chat
    if not is_group and len(participant_ids) != 1:
        return {
            "success": False,
            "message": "Private chat must have exactly 1 participant.",
            "room": None
        }

    # Prevent duplicate private chats
    if not is_group:
        other_user = get_object_or_404(User, id=participant_ids[0])
        existing_room = ChatRoom.objects.filter(
            is_group=False,
            participants=user
        ).filter(participants=other_user).first()

        if existing_room:
            return {
                "success": False,
                "message": "Private chat already exists.",
                "room": existing_room
            }
        

    if is_group:
        existing_group = ChatRoom.objects.filter(is_group=True , participants=user)
        print("Existing group:", existing_group)
        for room in existing_group:
            room_participants = list(room.participants.values_list('id', flat=True))
            if sorted(room_participants) == sorted(participant_ids + [user.id]):
                return {
                    "success": False,
                    "message": "Group chat already exists.",
                    "room": room
                }
    
    unique_ids = set(participant_ids)
    print("Uniqueu Ids---->",unique_ids)
    
    if len(unique_ids) != len(participant_ids):
        return{
            "success": False,
            "message": "Duplicate Ids not allowed"
        }

        
    

    # Create new room
    chat_room = ChatRoom.objects.create(
        name=name if is_group else None,
        is_group=is_group,
        admin=user if is_group else None
    )

  

    # Add participants
    chat_room.participants.add(user)
    for user_id in participant_ids:
        participant = get_object_or_404(User, id=user_id)
        chat_room.participants.add(participant)

    return {
        "success": True,
        "message": "Chat room created successfully.",
        "room": chat_room
    }
