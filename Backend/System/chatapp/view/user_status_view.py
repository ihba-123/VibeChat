from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from ..services.user_status_services import user_status
from rest_framework import status

class AllUsersStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            data = user_status(request.user)
            return Response(data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)