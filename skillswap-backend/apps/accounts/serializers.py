from django.conf import settings
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
    TokenRefreshSerializer,
)
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User


def strip_required_text(value: str, field_label: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise serializers.ValidationError(f"{field_label} cannot be empty.")
    return normalized


def strip_optional_text(value: str) -> str:
    return value.strip()


class UserSummarySerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "display_name",
            "first_name",
            "last_name",
            "location",
            "bio",
        ]


class CurrentUserSerializer(UserSummarySerializer):
    email = serializers.EmailField()

    class Meta(UserSummarySerializer.Meta):
        fields = UserSummarySerializer.Meta.fields + ["email"]
        read_only_fields = ["id"]

    def validate_email(self, value: str) -> str:
        normalized = value.strip().lower()
        queryset = User.objects.exclude(pk=getattr(self.instance, "pk", None))
        if queryset.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return normalized


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = [
            "username",
            "email",
            "password",
            "confirm_password",
            "first_name",
            "last_name",
            "location",
            "bio",
        ]

    def validate_username(self, value: str) -> str:
        normalized = strip_required_text(value, "Username")
        if User.objects.filter(username__iexact=normalized).exists():
            raise serializers.ValidationError("This username is already taken.")
        return normalized

    def validate_email(self, value: str) -> str:
        normalized = value.strip().lower()
        if not normalized:
            raise serializers.ValidationError("Email cannot be empty.")
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return normalized

    def validate_first_name(self, value: str) -> str:
        return strip_optional_text(value)

    def validate_last_name(self, value: str) -> str:
        return strip_optional_text(value)

    def validate_location(self, value: str) -> str:
        return strip_optional_text(value)

    def validate_bio(self, value: str) -> str:
        return strip_optional_text(value)

    def validate(self, attrs: dict) -> dict:
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError(
                {"confirm_password": "Passwords do not match."}
            )
        return attrs

    def create(self, validated_data: dict) -> User:
        validated_data.pop("confirm_password")
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

    @staticmethod
    def build_auth_payload(user: User) -> dict:
        refresh = RefreshToken.for_user(user)
        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": CurrentUserSerializer(user).data,
        }


class SkillSwapTokenSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user: User):
        token = super().get_token(user)
        token["username"] = user.username
        return token

    def validate(self, attrs: dict) -> dict:
        try:
            data = super().validate(attrs)
        except AuthenticationFailed as exc:
            if exc.get_codes() == "no_active_account":
                raise serializers.ValidationError(
                    {"detail": "Username or password is wrong."}
                ) from exc
            raise
        data["user"] = CurrentUserSerializer(self.user).data
        return data


class CookieTokenRefreshSerializer(TokenRefreshSerializer):
    refresh = serializers.CharField(required=False, allow_blank=True, write_only=True)

    def validate(self, attrs: dict) -> dict:
        refresh = attrs.get("refresh")
        if not refresh:
            request = self.context.get("request")
            refresh = request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME, "") if request else ""

        if not refresh:
            raise serializers.ValidationError({"refresh": "Refresh token is missing."})

        attrs["refresh"] = refresh
        return super().validate(attrs)


class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField(required=False, allow_blank=True, write_only=True)

    def validate(self, attrs: dict) -> dict:
        request = self.context.get("request")
        refresh = attrs.get("refresh") or (
            request.COOKIES.get(settings.JWT_REFRESH_COOKIE_NAME, "") if request else ""
        )

        if not refresh:
            self.token = None
            return attrs

        try:
            self.token = RefreshToken(refresh)
        except TokenError:
            self.token = None
        return attrs

    def save(self, **kwargs) -> None:
        if not self.token:
            return

        try:
            self.token.blacklist()
        except TokenError:
            pass
