from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..serializer import BlockedUserSerializer
from ..services.block_service import blocked_queryset, block_user_service, unblock_user_service


class BlockUserView(APIView):
    def post(self, request, blocked_id):
        created, blocked_user = block_user_service(
            blocker=request.user, blocked_id=blocked_id
        )
        label = blocked_user.name or blocked_user.email
        return Response(
            {
                "detail": f"{label} blocked." if created else f"{label} was already blocked.",
                "user_id": blocked_user.pk,
                "blocked": True,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class UnblockUserView(APIView):
    def delete(self, request, blocked_id):
        deleted_count = unblock_user_service(blocker=request.user, blocked_id=blocked_id)
        if deleted_count == 0:
            return Response(
                {"detail": "That person is not blocked.", "code": "not_found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(
            {"detail": "User unblocked.", "user_id": int(blocked_id), "blocked": False},
            status=status.HTTP_200_OK,
        )


class BlockedUserListView(generics.ListAPIView):
    """Everyone the signed-in user has blocked."""

    serializer_class = BlockedUserSerializer

    def get_queryset(self):
        return blocked_queryset(self.request.user).order_by("-blocked_at")
