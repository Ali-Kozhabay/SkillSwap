from django.urls import path

from .views import (
    BookingCreateView,
    BookingDetailView,
    BookingMessagesView,
    BookingStatusUpdateView,
    MessageCreateView,
    MyBookingsView,
    ReviewCreateView,
    ServiceDetailView,
    ServiceListCreateView,
    category_list_view,
    my_services_view,
)


urlpatterns = [
    path("categories/", category_list_view, name="category-list"),
    path("services/", ServiceListCreateView.as_view(), name="service-list-create"),
    path("services/mine/", my_services_view, name="my-services"),
    path("services/<int:pk>/", ServiceDetailView.as_view(), name="service-detail"),
    path("bookings/", BookingCreateView.as_view(), name="booking-create"),
    path("bookings/my/", MyBookingsView.as_view(), name="my-bookings"),
    path("bookings/<int:pk>/", BookingDetailView.as_view(), name="booking-detail"),
    path("bookings/<int:pk>/status/", BookingStatusUpdateView.as_view(), name="booking-status"),
    path(
        "bookings/<int:booking_id>/messages/",
        BookingMessagesView.as_view(),
        name="booking-messages",
    ),
    path("messages/", MessageCreateView.as_view(), name="message-create"),
    path("reviews/", ReviewCreateView.as_view(), name="review-create"),
]
