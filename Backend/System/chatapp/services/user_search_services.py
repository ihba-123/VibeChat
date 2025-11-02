from rest_framework import status
from django.db.models import Q
from ..models import User


def user_search(query_params , user):
            query = query_params.get('q', '').strip()
            if not query:
                return {
                    "detail": "Query parameter 'q' is required.",
                    "status": status.HTTP_400_BAD_REQUEST
                }
            
            # Limit query length to prevent abuse
            if len(query) > 100:
                return {
                    "detail": "Query parameter 'q' is too long.",
                    "status": status.HTTP_400_BAD_REQUEST
                }
            
            # Fetch users with profiles in a single query
            users = User.objects.select_related('profile').filter(
                Q(name__icontains=query) | Q(email__icontains=query),
                profile__isnull=False
            ).exclude(id=user.id)[:20]

            return [u.profile for u in users]


   
  