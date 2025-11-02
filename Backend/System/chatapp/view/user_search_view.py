from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from ..serializer import PersonlDetailsSerializer
from ..services.user_search_services import user_search
from rest_framework import status
import logging

logger = logging.getLogger(__name__)

class UserSearchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        try:
            results = user_search(request.query_params, request.user)
            serializer = PersonlDetailsSerializer(results, many=True, context={'request': request})
            logger.info(f"User {request.user.email} searched for users")
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(f"Error searching for users: {str(e)}")
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)