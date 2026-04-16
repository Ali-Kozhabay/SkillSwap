import os

from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

from apps.accounts.websocket_auth import JwtWebSocketMiddlewareStack
from apps.marketplace.routing import websocket_urlpatterns

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

django_asgi_application = get_asgi_application()

application = ProtocolTypeRouter(
    {
        "http": django_asgi_application,
        "websocket": JwtWebSocketMiddlewareStack(URLRouter(websocket_urlpatterns)),
    }
)
