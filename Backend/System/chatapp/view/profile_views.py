from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics, permissions
from ..services.profile_services import profile_view
from ..serializer import ProfileSerializer
class ProfileAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request, user_id):
      try:
         profile = profile_view(user_id)                                        
         serializer = ProfileSerializer(profile)
         print(serializer.data)
         return Response(serializer.data, status=status.HTTP_200_OK)
      except Exception as e:
         return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)