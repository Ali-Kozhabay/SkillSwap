import json
import logging
from types import SimpleNamespace

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from rest_framework import serializers

from .models import Booking, Message
from .serializers import MessageCreateSerializer, MessageReadSerializer

logger = logging.getLogger(__name__)


class BookingChatConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        user = self.scope["user"]
        self.booking_id = int(self.scope["url_route"]["kwargs"]["booking_id"])

        if not user.is_authenticated:
            await self.close(code=4401)
            return

        self.booking = await self.get_booking()
        if not self.booking:
            await self.close(code=4404)
            return

        if user.id not in {self.booking.client_id, self.booking.service.owner_id}:
            await self.close(code=4403)
            return

        self.group_name = f"booking_chat_{self.booking_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive_json(self, content, **kwargs):
        try:
            text = str(content.get("text", "")).strip()
            if not text:
                await self.send_json(
                    {"type": "chat.error", "detail": "Message cannot be empty."}
                )
                return

            message = await self.create_message(text)
        except serializers.ValidationError as exc:
            await self.send_json(
                {"type": "chat.error", "detail": self.serialize_error(exc.detail)}
            )
            return
        except Exception:
            logger.exception("Booking websocket failed while creating a message.")
            await self.close(code=1011)
            return

        try:
            await self.channel_layer.group_send(
                self.group_name,
                {"type": "chat.message", "message": message},
            )
        except Exception:
            logger.exception("Booking websocket failed while broadcasting a message.")
            await self.close(code=1011)

    async def chat_message(self, event):
        try:
            await self.send_json({"type": "chat.message", "message": event["message"]})
        except Exception:
            logger.exception("Booking websocket failed while sending a message payload.")
            await self.close(code=1011)

    @database_sync_to_async
    def get_booking(self):
        try:
            return Booking.objects.select_related("service__owner", "client").get(
                pk=self.booking_id
            )
        except Booking.DoesNotExist:
            return None

    @database_sync_to_async
    def create_message(self, text: str) -> dict:
        serializer = MessageCreateSerializer(
            data={"booking": self.booking_id, "text": text},
            context={"request": SimpleNamespace(user=self.scope["user"])},
        )
        serializer.is_valid(raise_exception=True)
        message = serializer.save()
        message = Message.objects.select_related("sender").get(pk=message.pk)
        return json.loads(json.dumps(MessageReadSerializer(message).data))

    def serialize_error(self, detail) -> str:
        if isinstance(detail, dict):
            return " ".join(
                f"{field}: {' '.join(map(str, value)) if isinstance(value, list) else value}"
                for field, value in detail.items()
            )
        if isinstance(detail, list):
            return " ".join(map(str, detail))
        return str(detail)
