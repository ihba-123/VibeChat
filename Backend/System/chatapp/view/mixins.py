"""Shared view plumbing."""

from rest_framework import generics

from .. import presence
from ..serializer import UserSummarySerializer


class PaginatedProfileListView(generics.ListAPIView):
    """Base for every "list of people" endpoint.

    These differ only in which profiles they select, so that is the one thing
    subclasses implement. Presence is resolved for the rows actually being
    rendered, in a single cache round trip — and the endpoints are paginated
    because serialising the whole user table per request was the dominant cost
    once the account count grew.
    """

    serializer_class = UserSummarySerializer

    def get_profiles(self):
        raise NotImplementedError

    def get_queryset(self):
        return self.get_profiles()

    def get_serializer(self, *args, **kwargs):
        rows = args[0] if args else []
        context = kwargs.pop("context", None) or self.get_serializer_context()
        try:
            user_ids = [getattr(row, "user_id", None) for row in rows]
        except TypeError:  # a single instance rather than a page
            user_ids = [getattr(rows, "user_id", None)]
        context["online_ids"] = presence.online_ids([uid for uid in user_ids if uid])
        return super().get_serializer(*args, context=context, **kwargs)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["viewer"] = self.request.user
        return context

    def search_term(self):
        return (self.request.query_params.get("q") or "").strip() or None
