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

# http://127.0.0.1:8000/accounts/google/login/callback/
