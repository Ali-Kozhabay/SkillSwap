from difflib import SequenceMatcher

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


def normalize_search_text(value: str) -> str:
    return " ".join("".join(ch.lower() if ch.isalnum() else " " for ch in value).split())


def best_window_similarity(
    normalized_query: str, candidate_tokens: list[str], query_token_count: int
) -> float:
    if not candidate_tokens:
        return 0.0

    best_score = 0.0
    window_sizes = {
        max(1, query_token_count - 1),
        query_token_count,
        min(len(candidate_tokens), query_token_count + 1),
    }

    for window_size in window_sizes:
        if window_size >= len(candidate_tokens):
            window_text = " ".join(candidate_tokens)
            best_score = max(best_score, SequenceMatcher(None, normalized_query, window_text).ratio())
            continue

        for start in range(len(candidate_tokens) - window_size + 1):
            window_text = " ".join(candidate_tokens[start : start + window_size])
            best_score = max(
                best_score,
                SequenceMatcher(None, normalized_query, window_text).ratio(),
            )

    return best_score


def fuzzy_field_score(normalized_query: str, query_tokens: list[str], candidate_text: str) -> float:
    normalized_candidate = normalize_search_text(candidate_text)
    if not normalized_candidate:
        return 0.0

    if normalized_query in normalized_candidate:
        return 1.0

    candidate_tokens = normalized_candidate.split()
    token_scores = []
    for query_token in query_tokens:
        best_token_score = 0.0
        for candidate_token in candidate_tokens:
            token_score = SequenceMatcher(None, query_token, candidate_token).ratio()
            shortest_token_length = min(len(query_token), len(candidate_token))
            starts_with_match = (
                shortest_token_length >= 4
                and (
                    query_token.startswith(candidate_token)
                    or candidate_token.startswith(query_token)
                )
            )
            if starts_with_match:
                token_score = max(token_score, 0.9)
            best_token_score = max(best_token_score, token_score)
        token_scores.append(best_token_score)

    average_token_score = sum(token_scores) / len(token_scores)
    phrase_score = SequenceMatcher(None, normalized_query, normalized_candidate).ratio()
    window_score = best_window_similarity(normalized_query, candidate_tokens, len(query_tokens))
    return max(average_token_score, phrase_score * 0.82, window_score * 0.96)


def service_search_score(normalized_query: str, query_tokens: list[str], service: Service) -> float:
    searchable_fields = [
        service.title,
        service.summary,
        service.description,
        service.category.name,
        service.category.description,
        service.owner.display_name,
        service.owner.username,
    ]
    return max(
        fuzzy_field_score(normalized_query, query_tokens, field)
        for field in searchable_fields
    )


def minimum_search_score(query_tokens: list[str]) -> float:
    longest_token = max((len(token) for token in query_tokens), default=0)
    if len(query_tokens) == 1 and longest_token <= 3:
        return 0.95
    if len(query_tokens) == 1 and longest_token <= 5:
        return 0.84
    return 0.72


def booking_queryset():
    return Booking.objects.select_related(
        "service__owner",
        "service__category",
        "offered_service__owner",
        "offered_service__category",
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

        if category:
            if category.isdigit():
                queryset = queryset.filter(category_id=int(category))
            else:
                queryset = queryset.filter(category__slug=category)
        if not search:
            return queryset

        normalized_search = normalize_search_text(search)
        if not normalized_search:
            return queryset

        query_tokens = normalized_search.split()
        threshold = minimum_search_score(query_tokens)
        scored_services = []
        for service in queryset:
            score = service_search_score(normalized_search, query_tokens, service)
            if score >= threshold:
                scored_services.append((score, service))

        scored_services.sort(key=lambda item: (item[0], item[1].created_at), reverse=True)
        return [service for _, service in scored_services]

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
