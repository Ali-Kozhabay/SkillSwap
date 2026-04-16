from django.core.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404
from django.db.models import Prefetch, Q
from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Booking, Category, Message, Review, Service
from .permissions import IsServiceOwnerOrReadOnly
from .serializers import (
    BookingCreateSerializer,
    BookingReadSerializer,
    BookingStatusUpdateSerializer,
    CategorySerializer,
    MessageCreateSerializer,
    MessageReadSerializer,
    ReviewCreateSerializer,
    ReviewSerializer,
    ServiceFilterSerializer,
    ServiceDetailSerializer,
    ServiceReadSerializer,
    ServiceWriteSerializer,
)


def service_queryset():
    return Service.objects.select_related("owner", "category")


def booking_queryset():
    return Booking.objects.select_related(
        "service__owner",
        "service__category",
        "client",
    ).prefetch_related(
        Prefetch(
            "messages",
            queryset=Message.objects.select_related("sender"),
        )
    )


def ensure_booking_participant(user, booking: Booking) -> None:
    if user.id not in {booking.client_id, booking.service.owner_id}:
        raise PermissionDenied("You do not have access to this booking.")


@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def category_list_view(request):
    serializer = CategorySerializer(Category.objects.all(), many=True)
    return Response(serializer.data)


@api_view(["GET"])
@permission_classes([permissions.IsAuthenticated])
def my_services_view(request):
    queryset = service_queryset().filter(owner=request.user)
    serializer = ServiceReadSerializer(queryset, many=True, context={"request": request})
    return Response(serializer.data)


class ServiceListCreateView(generics.ListCreateAPIView):
    queryset = service_queryset()
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def get_queryset(self):
        queryset = super().get_queryset().filter(is_active=True)
        filters = ServiceFilterSerializer(data=self.request.query_params)
        filters.is_valid(raise_exception=True)
        search = filters.validated_data.get("search", "")
        category = filters.validated_data.get("category", "")

        if search:
            queryset = queryset.filter(Q(title__icontains=search) | Q(summary__icontains=search))
        if category:
            if category.isdigit():
                queryset = queryset.filter(category_id=int(category))
            else:
                queryset = queryset.filter(category__slug=category)
        return queryset

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ServiceWriteSerializer
        return ServiceReadSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        service = serializer.save(owner=request.user)
        response_data = ServiceReadSerializer(service, context=self.get_serializer_context()).data
        return Response(response_data, status=status.HTTP_201_CREATED)


class ServiceDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsServiceOwnerOrReadOnly]

    def get_queryset(self):
        queryset = service_queryset()
        if self.request.method not in permissions.SAFE_METHODS:
            return queryset

        user = self.request.user
        if user.is_authenticated:
            return queryset.filter(Q(is_active=True) | Q(owner=user)).distinct()

        return queryset.filter(is_active=True)

    def get_serializer_class(self):
        if self.request.method in permissions.SAFE_METHODS:
            return ServiceDetailSerializer
        return ServiceWriteSerializer

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        service = serializer.save()
        response_data = ServiceDetailSerializer(service, context=self.get_serializer_context()).data
        return Response(response_data)


class BookingCreateView(generics.CreateAPIView):
    serializer_class = BookingCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        booking = serializer.save()
        response_data = BookingReadSerializer(booking, context={"request": request}).data
        return Response(response_data, status=status.HTTP_201_CREATED)


class MyBookingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        as_client = booking_queryset().filter(client=request.user)
        as_provider = booking_queryset().filter(service__owner=request.user)
        return Response(
            {
                "as_client": BookingReadSerializer(
                    as_client,
                    many=True,
                    context={"request": request},
                ).data,
                "as_provider": BookingReadSerializer(
                    as_provider,
                    many=True,
                    context={"request": request},
                ).data,
            }
        )


class BookingDetailView(generics.RetrieveAPIView):
    serializer_class = BookingReadSerializer
    permission_classes = [permissions.IsAuthenticated]
    queryset = booking_queryset()

    def get_object(self):
        booking = super().get_object()
        ensure_booking_participant(self.request.user, booking)
        return booking


class BookingStatusUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk, *args, **kwargs):
        booking = get_object_or_404(booking_queryset(), pk=pk)
        serializer = BookingStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        next_status = serializer.validated_data["status"]
        user = request.user

        if next_status == Booking.Status.ACCEPTED:
            if booking.service.owner_id != user.id:
                raise PermissionDenied("Only the service owner can accept a booking.")
            if booking.status != Booking.Status.PENDING:
                return Response(
                    {"detail": "Only pending bookings can be accepted."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            booking.status = next_status
            booking.provider_completion_confirmed = False
            booking.client_completion_confirmed = False
            update_fields = [
                "status",
                "provider_completion_confirmed",
                "client_completion_confirmed",
                "updated_at",
            ]
        elif next_status == Booking.Status.COMPLETED:
            ensure_booking_participant(user, booking)
            if booking.status != Booking.Status.ACCEPTED:
                return Response(
                    {"detail": "Only accepted bookings can move through completion confirmation."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if booking.service.owner_id == user.id:
                if booking.provider_completion_confirmed:
                    return Response(
                        {"detail": "The executive already confirmed completion."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                booking.provider_completion_confirmed = True
                update_fields = ["provider_completion_confirmed", "updated_at"]
            else:
                if not booking.provider_completion_confirmed:
                    return Response(
                        {"detail": "The executive must confirm completion first."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if booking.client_completion_confirmed:
                    return Response(
                        {"detail": "The client already confirmed completion."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                booking.client_completion_confirmed = True
                booking.status = Booking.Status.COMPLETED
                update_fields = ["client_completion_confirmed", "status", "updated_at"]
        else:
            return Response(
                {"detail": "Unsupported status transition."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        booking.save(update_fields=update_fields)
        return Response(BookingReadSerializer(booking, context={"request": request}).data)


class BookingMessagesView(generics.ListAPIView):
    serializer_class = MessageReadSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        booking = get_object_or_404(booking_queryset(), pk=self.kwargs["booking_id"])
        ensure_booking_participant(self.request.user, booking)
        return booking.messages.select_related("sender")


class MessageCreateView(generics.CreateAPIView):
    serializer_class = MessageCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        message = serializer.save()
        response_data = MessageReadSerializer(message, context={"request": request}).data
        return Response(response_data, status=status.HTTP_201_CREATED)


class ReviewCreateView(generics.CreateAPIView):
    serializer_class = ReviewCreateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review = serializer.save()
        response_data = ReviewSerializer(review, context={"request": request}).data
        return Response(response_data, status=status.HTTP_201_CREATED)
