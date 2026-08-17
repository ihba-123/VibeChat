from rest_framework.pagination import CursorPagination, PageNumberPagination
from rest_framework.response import Response


class StandardPagination(PageNumberPagination):
    """Page-number pagination with a client-tunable, server-capped page size."""

    page_size_query_param = "page_size"
    max_page_size = 100


class MessageCursorPagination(CursorPagination):
    """Newest-first cursor pagination for message history.

        Cursor rather than page-number on purpose: a chat room receives writes while
        the user is scrolling, and with OFFSET-based paging every new message shifts
        the window, so page 2 repeats or skips rows. Cursor paging is also O(1) on the
        (chat_room, timestamp) index instead of degrading as the offset grows.
    """

    page_size_query_param = "page_size"
    max_page_size = 100
    ordering = "-timestamp"

    def get_paginated_response(self, data):
        return Response(
            {
                "next": self.get_next_link(),
                "previous": self.get_previous_link(),
                # The window is fetched newest-first for the cursor to work, but the
                # UI renders oldest-at-top, so hand back the order it needs.
                "results": list(reversed(data)),
            }
        )
