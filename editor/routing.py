from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    re_path(r"ws/document/(?P<doc_id>[a-z0-9]+)/$", consumers.DocumentConsumer.as_asgi()),
]
