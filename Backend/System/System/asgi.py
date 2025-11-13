import os
import django
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from chatapp.middleware import JWTAuthMiddleware
import chatapp.routing

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "System.settings")
django.setup()

django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JWTAuthMiddleware(
        URLRouter(chatapp.routing.websocket_urlpatterns)
    ),
})
