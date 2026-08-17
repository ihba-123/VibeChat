from django.db.models import Q
from rest_framework.exceptions import ValidationError

from ..models import Profile
from . import blocking

MAX_QUERY_LENGTH = 100


def user_search(query_params, user):
    """Search people by name or email.

    Returns a queryset so the caller can paginate. The previous version returned a
    plain dict on bad input, which the view then handed to a many=True serializer
    and turned into a confusing 400.
    """
    query = (query_params.get("q") or "").strip()
    if not query:
        raise ValidationError({"q": "A search term is required."})
    if len(query) > MAX_QUERY_LENGTH:
        raise ValidationError({"q": f"Search term is too long ({MAX_QUERY_LENGTH} characters max)."})

    excluded = blocking.blocked_ids_for(user) | {user.pk}

    return (
        Profile.objects.select_related("user")
        .filter(Q(user__name__icontains=query) | Q(user__email__icontains=query))
        .filter(user__is_active=True)
        .exclude(user_id__in=excluded)
        .order_by("user__name", "user__id")
    )
