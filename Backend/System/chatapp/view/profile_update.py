from rest_framework import generics
from rest_framework import permissions
from ..serializer import ProfileUpdateSerializer
class ProfileUpdateView(generics.UpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ProfileUpdateSerializer

    def get_object(self):
        return self.request.user.profile