from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from ..services.chat_services import create_chat_room
import logging

logger = logging.getLogger(__name__)

class ChatRoomCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        is_group = request.data.get('is_group', False)
        participant_ids = request.data.get('participant_ids', [])
        name = request.data.get('name', None)

        print(f"Received is_group: {is_group}, participant_ids: {participant_ids}, name: {name}")

        try:
            result = create_chat_room(request.user, participant_ids, name, is_group)
            print(f"Chat room result: {result}")

            if not result["success"]:
                return Response(
                    {"message": result["message"]},
                    status=status.HTTP_400_BAD_REQUEST
                )

            room = result["room"]

            return Response(
                {
                    "message": result["message"],
                    "room_id": room.id,
                    "is_group": is_group
                },
                status=status.HTTP_201_CREATED
            )

        except Exception as e:
            logger.error(f"Error creating chat room: {str(e)}")
            return Response(
                {"detail": f"Error creating chat room: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
