from rest_framework import generics
from rest_framework import permissions
from ..serializer import PersonlDetailsSerializer

class UserDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PersonlDetailsSerializer
    def get_object(self):
        return self.request.user.profile