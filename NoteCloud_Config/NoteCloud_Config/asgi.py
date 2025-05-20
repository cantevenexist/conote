"""
ASGI config for NoteCloud_Config project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.1/howto/deployment/asgi/
"""

import os
from django.core.asgi import get_asgi_application


os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'NoteCloud_Config.settings')
django_asgi_app = get_asgi_application()


from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from boards.routing import websocket_urlpatterns as boards_websocket_urlpatterns
from user_profiles.routing import websocket_urlpatterns as profiles_websocket_urlpatterns

websocket_urlpatterns = boards_websocket_urlpatterns + profiles_websocket_urlpatterns

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AuthMiddlewareStack(
        URLRouter(websocket_urlpatterns)
    ),
})
