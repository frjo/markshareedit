import json
import logging
from collections import defaultdict

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.utils import timezone

from .models import Document

logger = logging.getLogger(__name__)

# In-memory presence tracking: {group_name: {channel_name: display_name}}
# Works correctly with InMemoryChannelLayer (single process).
_group_members: dict[str, dict[str, str]] = defaultdict(dict)


class DocumentConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated:
            await self.close()
            return

        self.doc_id = self.scope["url_route"]["kwargs"]["doc_id"]
        self.group_name = f"document_{self.doc_id}"
        self.user = user

        if not await self.document_exists():
            await self.close()
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        _group_members[self.group_name][self.channel_name] = user.get_display_name
        await self.accept()

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "presence.update",
                "members": list(_group_members[self.group_name].values()),
            },
        )

    async def disconnect(self, close_code):
        if not hasattr(self, "group_name"):
            return
        _group_members[self.group_name].pop(self.channel_name, None)
        await self.channel_layer.group_discard(self.group_name, self.channel_name)
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "presence.update",
                "members": list(_group_members[self.group_name].values()),
            },
        )

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        if data.get("type") == "content":
            content = data.get("content", "")
            await self.save_content(content)
            await self.channel_layer.group_send(
                self.group_name,
                {
                    "type": "document.content",
                    "content": content,
                    "sender": self.channel_name,
                },
            )

    async def document_content(self, event):
        if event["sender"] != self.channel_name:
            await self.send(text_data=json.dumps({"type": "content", "content": event["content"]}))

    async def presence_update(self, event):
        await self.send(text_data=json.dumps({"type": "presence", "members": event["members"]}))

    @database_sync_to_async
    def document_exists(self):
        return Document.objects.filter(pk=self.doc_id).exists()

    @database_sync_to_async
    def save_content(self, content):
        Document.objects.filter(pk=self.doc_id).update(
            content=content,
            updated_by=self.user,
            updated_at=timezone.now(),
        )
