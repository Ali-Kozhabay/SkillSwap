from asgiref.sync import async_to_sync, sync_to_async
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from config.asgi import application

from .models import Booking, Category, Message, Service


class ServiceVisibilityTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.owner = user_model.objects.create_user(
            username="service-owner",
            email="owner@example.com",
            password="demo12345",
        )
        self.viewer = user_model.objects.create_user(
            username="service-viewer",
            email="viewer@example.com",
            password="demo12345",
        )
        self.category = Category.objects.create(
            name="Design",
            slug="design",
            description="Design work",
        )
        self.inactive_service = Service.objects.create(
            owner=self.owner,
            category=self.category,
            title="Private strategy session",
            summary="Inactive listing",
            description="Review and planning support",
            price="85000.00",
            location="Almaty",
            is_active=False,
        )

    def test_guest_cannot_open_inactive_service_detail(self):
        response = self.client.get(f"/api/services/{self.inactive_service.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_non_owner_cannot_open_inactive_service_detail(self):
        self.client.force_authenticate(user=self.viewer)
        response = self.client.get(f"/api/services/{self.inactive_service.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_owner_can_open_inactive_service_detail(self):
        self.client.force_authenticate(user=self.owner)
        response = self.client.get(f"/api/services/{self.inactive_service.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.inactive_service.id)


class BookingCompletionFlowTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.client_user = user_model.objects.create_user(
            username="booking-client",
            email="booking-client@example.com",
            password="demo12345",
        )
        self.executive_user = user_model.objects.create_user(
            username="booking-executive",
            email="booking-executive@example.com",
            password="demo12345",
        )

        self.category = Category.objects.create(
            name="Engineering",
            slug="engineering",
            description="Engineering work",
        )
        self.service = Service.objects.create(
            owner=self.executive_user,
            category=self.category,
            title="Backend delivery",
            summary="API work",
            description="Build the backend",
            price="120000.00",
            location="Remote",
            is_active=True,
        )
        self.booking = Booking.objects.create(
            service=self.service,
            client=self.client_user,
            status=Booking.Status.ACCEPTED,
            note="Ship the project",
        )

    def booking_status_url(self) -> str:
        return f"/api/bookings/{self.booking.id}/status/"

    def test_client_cannot_complete_before_executive_confirms(self):
        self.client.force_authenticate(user=self.client_user)

        response = self.client.patch(
            self.booking_status_url(),
            {"status": Booking.Status.COMPLETED},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "The executive must confirm completion first.")

    def test_executive_confirmation_keeps_booking_accepted_until_client_confirms(self):
        self.client.force_authenticate(user=self.executive_user)

        response = self.client.patch(
            self.booking_status_url(),
            {"status": Booking.Status.COMPLETED},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], Booking.Status.ACCEPTED)
        self.assertTrue(response.data["provider_completion_confirmed"])
        self.assertFalse(response.data["client_completion_confirmed"])

    def test_client_confirmation_completes_booking_after_executive_confirms(self):
        self.client.force_authenticate(user=self.executive_user)
        self.client.patch(
            self.booking_status_url(),
            {"status": Booking.Status.COMPLETED},
            format="json",
        )

        self.client.force_authenticate(user=self.client_user)
        response = self.client.patch(
            self.booking_status_url(),
            {"status": Booking.Status.COMPLETED},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], Booking.Status.COMPLETED)
        self.assertTrue(response.data["provider_completion_confirmed"])
        self.assertTrue(response.data["client_completion_confirmed"])
        self.assertTrue(response.data["can_review"])


class BookingChatConsumerTests(TransactionTestCase):
    def setUp(self):
        user_model = get_user_model()
        self.client_user = user_model.objects.create_user(
            username="chat-client",
            email="client@example.com",
            password="demo12345",
        )
        self.executive_user = user_model.objects.create_user(
            username="chat-executive",
            email="executive@example.com",
            password="demo12345",
        )
        self.outsider_user = user_model.objects.create_user(
            username="chat-outsider",
            email="outsider@example.com",
            password="demo12345",
        )

        self.category = Category.objects.create(
            name="Operations",
            slug="operations",
            description="Ops support",
        )
        self.service = Service.objects.create(
            owner=self.executive_user,
            category=self.category,
            title="Executive support",
            summary="Real-time support",
            description="Support for ongoing work",
            price="25000.00",
            location="Remote",
            is_active=True,
        )
        self.booking = Booking.objects.create(
            service=self.service,
            client=self.client_user,
            status=Booking.Status.ACCEPTED,
            note="Need live coordination",
        )

    def websocket_path(self, user):
        access_token = str(RefreshToken.for_user(user).access_token)
        return f"/ws/bookings/{self.booking.id}/chat/?token={access_token}"

    def test_booking_participants_receive_live_messages(self):
        async_to_sync(self.assert_live_message_flow)(
            self.websocket_path(self.client_user),
            self.websocket_path(self.executive_user),
        )

    def test_outsider_cannot_connect_to_booking_chat(self):
        async_to_sync(self.assert_outsider_rejected)(self.websocket_path(self.outsider_user))

    async def assert_live_message_flow(self, client_path, executive_path):
        client_socket = WebsocketCommunicator(application, client_path)
        executive_socket = WebsocketCommunicator(application, executive_path)

        client_connected, _ = await client_socket.connect()
        executive_connected, _ = await executive_socket.connect()

        self.assertTrue(client_connected)
        self.assertTrue(executive_connected)

        await client_socket.send_json_to({"text": "Need an update on this booking."})

        client_payload = await client_socket.receive_json_from()
        executive_payload = await executive_socket.receive_json_from()

        self.assertEqual(client_payload["type"], "chat.message")
        self.assertEqual(executive_payload["type"], "chat.message")
        self.assertEqual(client_payload["message"]["text"], "Need an update on this booking.")
        self.assertEqual(executive_payload["message"]["text"], "Need an update on this booking.")
        self.assertEqual(await sync_to_async(Message.objects.count, thread_sensitive=True)(), 1)

        await client_socket.disconnect()
        await executive_socket.disconnect()

    async def assert_outsider_rejected(self, outsider_path):
        outsider_socket = WebsocketCommunicator(application, outsider_path)
        connected, _ = await outsider_socket.connect()
        self.assertFalse(connected)


class BookingMessageEndpointTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.client_user = user_model.objects.create_user(
            username="message-client",
            email="message-client@example.com",
            password="demo12345",
        )

    def test_invalid_booking_messages_endpoint_returns_404(self):
        self.client.force_authenticate(user=self.client_user)
        response = self.client.get("/api/bookings/999/messages/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
