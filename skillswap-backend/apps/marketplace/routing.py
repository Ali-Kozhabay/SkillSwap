from django.urls import re_path

from .consumers import BookingChatConsumer


websocket_urlpatterns = [
    re_path(r"^ws/bookings/(?P<booking_id>\d+)/chat/$", BookingChatConsumer.as_asgi()),
]
