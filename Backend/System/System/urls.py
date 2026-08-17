from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('authentication.urls')),
    path('api/', include('chatapp.urls')),
    path('accounts/', include('allauth.urls')),
]

# Serve uploads from MEDIA_ROOT during development. Only relevant when
# MEDIA_BACKEND resolves to local storage; with Cloudinary the URLs point at the
# CDN. In production a web server or object store should serve these instead.
if settings.DEBUG and settings.MEDIA_BACKEND == 'local':
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Google OAuth: allauth builds the redirect_uri from the *request host*, so the URI
# sent to Google is whatever host the browser used. Google requires an exact match
# against the client's "Authorized redirect URIs", and it treats localhost and
# 127.0.0.1 as different origins — registering one does not authorize the other.
#
# The SPA sends users to VITE_API_BASE_URL (http://localhost:8000), so register at
# minimum:
#     http://localhost:8000/accounts/google/login/callback/
# and register the 127.0.0.1 form too if the backend is ever reached that way:
#     http://127.0.0.1:8000/accounts/google/login/callback/
#
# The host also has to stay consistent after the redirect: the allauth session cookie
# is host-scoped, so /api/auth/session-token/ must be called on the same host that
# completed the OAuth flow or the exchange has no session to trade.
