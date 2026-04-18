from django.db.models import Avg
from django.utils import timezone
from rest_framework import serializers

from apps.accounts.serializers import UserSummarySerializer

from .models import Booking, Category, Message, Review, Service


def strip_required_text(value: str, field_label: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise serializers.ValidationError(f"{field_label} cannot be empty.")
    return normalized


def strip_optional_text(value: str) -> str:
    return value.strip()


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "slug", "description"]


class ServiceFilterSerializer(serializers.Serializer):
    search = serializers.CharField(required=False, allow_blank=True)
    category = serializers.CharField(required=False, allow_blank=True)

    def validate_search(self, value: str) -> str:
        return value.strip()

    def validate_category(self, value: str) -> str:
        return value.strip()


class ReviewSerializer(serializers.ModelSerializer):
    reviewer = UserSummarySerializer(read_only=True)

    class Meta:
        model = Review
        fields = ["id", "rating", "comment", "created_at", "reviewer"]


class ServiceReadSerializer(serializers.ModelSerializer):
    owner = UserSummarySerializer(read_only=True)
    category = CategorySerializer(read_only=True)
    average_rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()
    can_book = serializers.SerializerMethodField()

    class Meta:
        model = Service
        fields = [
            "id",
            "title",
            "summary",
            "description",
            "price",
            "location",
            "is_active",
            "created_at",
            "updated_at",
            "owner",
            "category",
            "average_rating",
            "review_count",
            "can_book",
        ]

    def get_average_rating(self, obj: Service):
        average = obj.bookings.filter(review__isnull=False).aggregate(avg=Avg("review__rating"))[
            "avg"
        ]
        return round(float(average), 1) if average is not None else None

    def get_review_count(self, obj: Service) -> int:
        return obj.bookings.filter(review__isnull=False).count()

    def get_can_book(self, obj: Service) -> bool:
        request = self.context.get("request")
        return bool(
            request
            and request.user.is_authenticated
            and request.user.id != obj.owner_id
            and obj.is_active
        )


class ServiceDetailSerializer(ServiceReadSerializer):
    reviews = serializers.SerializerMethodField()

    class Meta(ServiceReadSerializer.Meta):
        fields = ServiceReadSerializer.Meta.fields + ["reviews"]

    def get_reviews(self, obj: Service):
        reviews = Review.objects.filter(booking__service=obj).select_related("reviewer")
        return ReviewSerializer(reviews, many=True).data


class ServiceWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = ["category", "title", "summary", "description", "price", "location", "is_active"]

    def validate_title(self, value: str) -> str:
        return strip_required_text(value, "Title")

    def validate_summary(self, value: str) -> str:
        return strip_required_text(value, "Summary")

    def validate_description(self, value: str) -> str:
        return strip_required_text(value, "Description")

    def validate_location(self, value: str) -> str:
        return strip_required_text(value, "Location")


class BookingReadSerializer(serializers.ModelSerializer):
    service = ServiceReadSerializer(read_only=True)
    offered_service = ServiceReadSerializer(read_only=True)
    client = UserSummarySerializer(read_only=True)
    provider = serializers.SerializerMethodField()
    provider_completion_confirmed = serializers.SerializerMethodField()
    client_completion_confirmed = serializers.SerializerMethodField()
    can_review = serializers.SerializerMethodField()
    review = ReviewSerializer(read_only=True)
    user_role = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = [
            "id",
            "service",
            "compensation_type",
            "offered_service",
            "client",
            "provider",
            "status",
            "provider_completion_confirmed",
            "client_completion_confirmed",
            "scheduled_for",
            "note",
            "created_at",
            "updated_at",
            "user_role",
            "can_review",
            "review",
        ]

    def get_provider(self, obj: Booking):
        return UserSummarySerializer(obj.service.owner).data

    def get_provider_completion_confirmed(self, obj: Booking) -> bool:
        return obj.provider_completion_confirmed or obj.status == Booking.Status.COMPLETED

    def get_client_completion_confirmed(self, obj: Booking) -> bool:
        return obj.client_completion_confirmed or obj.status == Booking.Status.COMPLETED

    def get_can_review(self, obj: Booking) -> bool:
        request = self.context.get("request")
        return bool(
            request
            and request.user.is_authenticated
            and obj.client_id == request.user.id
            and obj.status == Booking.Status.COMPLETED
            and not hasattr(obj, "review")
        )

    def get_user_role(self, obj: Booking) -> str:
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return "guest"
        if obj.client_id == request.user.id:
            return "client"
        if obj.service.owner_id == request.user.id:
            return "provider"
        return "guest"


class BookingStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Booking.Status.choices)


class BookingCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Booking
        fields = ["service", "scheduled_for", "note", "compensation_type", "offered_service"]

    def validate_service(self, service: Service) -> Service:
        request = self.context["request"]
        if service.owner_id == request.user.id:
            raise serializers.ValidationError("You cannot book your own service.")
        if not service.is_active:
            raise serializers.ValidationError("This service is not available.")
        return service

    def validate_scheduled_for(self, value):
        if value and value <= timezone.now():
            raise serializers.ValidationError("Pick a date in the future.")
        return value

    def validate_note(self, value: str) -> str:
        return strip_optional_text(value)

    def validate(self, attrs: dict) -> dict:
        request = self.context["request"]
        service = attrs["service"]
        compensation_type = attrs.get("compensation_type", Booking.CompensationType.MONEY)
        offered_service = attrs.get("offered_service")

        if compensation_type == Booking.CompensationType.SERVICE:
            if not offered_service:
                raise serializers.ValidationError(
                    {"offered_service": "Choose one of your services to offer for the swap."}
                )
            if offered_service.owner_id != request.user.id:
                raise serializers.ValidationError(
                    {"offered_service": "You can only offer one of your own services."}
                )
            if not offered_service.is_active:
                raise serializers.ValidationError(
                    {"offered_service": "Only active services can be offered in a swap."}
                )
        elif offered_service is not None:
            raise serializers.ValidationError(
                {"offered_service": "Remove the offered service or switch to a service swap."}
            )

        has_active_booking = Booking.objects.filter(
            client=request.user,
            service=service,
            status__in=[Booking.Status.PENDING, Booking.Status.ACCEPTED],
        ).exists()
        if has_active_booking:
            raise serializers.ValidationError(
                {"service": "You already have an active booking for this service."}
            )
        return attrs

    def create(self, validated_data: dict) -> Booking:
        return Booking.objects.create(client=self.context["request"].user, **validated_data)


class MessageReadSerializer(serializers.ModelSerializer):
    sender = UserSummarySerializer(read_only=True)

    class Meta:
        model = Message
        fields = ["id", "booking", "sender", "text", "created_at"]


class MessageCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ["booking", "text"]

    def validate_booking(self, booking: Booking) -> Booking:
        request = self.context["request"]
        if request.user.id not in {booking.client_id, booking.service.owner_id}:
            raise serializers.ValidationError("You do not have access to this booking chat.")
        return booking

    def validate_text(self, value: str) -> str:
        if not value.strip():
            raise serializers.ValidationError("Message cannot be empty.")
        return value.strip()

    def create(self, validated_data: dict) -> Message:
        return Message.objects.create(sender=self.context["request"].user, **validated_data)


class ReviewCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = ["booking", "rating", "comment"]

    def validate_comment(self, value: str) -> str:
        return strip_optional_text(value)

    def validate_booking(self, booking: Booking) -> Booking:
        request = self.context["request"]
        if booking.client_id != request.user.id:
            raise serializers.ValidationError("Only the client can review this booking.")
        if booking.status != Booking.Status.COMPLETED:
            raise serializers.ValidationError("Reviews are allowed only after completion.")
        if hasattr(booking, "review"):
            raise serializers.ValidationError("A review already exists for this booking.")
        return booking

    def create(self, validated_data: dict) -> Review:
        return Review.objects.create(reviewer=self.context["request"].user, **validated_data)
