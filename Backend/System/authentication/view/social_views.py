"""Bridge between allauth's session login and the SPA's JWT session.

Google sign-in finishes as a Django session on the API host. The SPA cannot use
that session for its API calls (it authenticates with bearer tokens), so after
allauth redirects back it calls this endpoint once, with credentials, to exchange
the session for a normal token pair.
"""

import logging

from django.contrib.auth import logout as django_logout
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ..services.login_services import login_services
from ..utils.set_refiresh import set_refresh_cookie

logger = logging.getLogger(__name__)


class SessionTokenExchangeView(APIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = login_services(request.user)
        logger.info("Exchanged social session for tokens: user_id=%s", request.user.pk)

        # The session has served its purpose; dropping it leaves exactly one
        # credential in play instead of two with different lifetimes.
        django_logout(request)

        response = Response({'access': data['access'], 'user': data['user']})
        return set_refresh_cookie(response, data['refresh'])
