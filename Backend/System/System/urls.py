from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('authentication.urls')),
    path('api/', include('chatapp.urls')),
    path('accounts/', include('allauth.urls')),
]
# http://127.0.0.1:8000/accounts/google/login/callback/