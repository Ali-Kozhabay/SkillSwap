from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .cookies import clear_auth_cookies, set_auth_cookies
from .serializers import (
    CookieTokenRefreshSerializer,
    CurrentUserSerializer,
    LogoutSerializer,
    RegisterSerializer,
    SkillSwapTokenSerializer,
)


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        payload = RegisterSerializer.build_auth_payload(user)
        response = Response({"user": payload["user"]}, status=status.HTTP_201_CREATED)
        set_auth_cookies(response, payload["access"], payload["refresh"])
        return response


class LoginView(TokenObtainPairView):
    permission_classes = [permissions.AllowAny]
    serializer_class = SkillSwapTokenSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK:
            access = response.data.pop("access", None)
            refresh = response.data.pop("refresh", None)
            set_auth_cookies(response, access, refresh)
        return response


class RefreshView(TokenRefreshView):
    permission_classes = [permissions.AllowAny]
    serializer_class = CookieTokenRefreshSerializer

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK:
            access = response.data.pop("access", None)
            refresh = response.data.pop("refresh", None)
            set_auth_cookies(response, access, refresh)
            response.data = {"detail": "Session refreshed."}
        else:
            clear_auth_cookies(response)
        return response


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = LogoutSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_auth_cookies(response)
        return response


class MeView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CurrentUserSerializer

    def get_object(self):
        return self.request.user
