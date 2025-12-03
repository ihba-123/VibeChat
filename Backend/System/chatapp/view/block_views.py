# chat/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from ..services.block_service import (
    block_user_service,
    unblock_user_service
)


class BlockUserView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, blocked_id):

        try:
            created, blocked_user = block_user_service(
                blocker=request.user,
                blocked_id=blocked_id
            )

            if created:
                return Response(
                    {"message": f"User {blocked_user.name or blocked_id} blocked successfully."},
                    status=status.HTTP_201_CREATED
                )
            else:
                return Response(
                    {"message": "User was already blocked."},
                    status=status.HTTP_200_OK
                )

        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class UnblockUserView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, blocked_id):

        try:
            deleted_count = unblock_user_service(
                blocker=request.user,
                blocked_id=blocked_id
            )

            if deleted_count == 0:
                return Response(
                    {"error": "Block relationship not found."},
                    status=status.HTTP_404_NOT_FOUND
                )

            return Response(
                {"message": "User unblocked successfully."},
                status=status.HTTP_200_OK
            )

        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
