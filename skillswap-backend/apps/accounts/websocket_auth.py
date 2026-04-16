from http.cookies import SimpleCookie
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError


class JwtWebSocketMiddleware:
    def __init__(self, inner):
        self.inner = inner
        self.jwt_authentication = JWTAuthentication()

    async def __call__(self, scope, receive, send):
        scope["user"] = await self.get_user(scope)
        return await self.inner(scope, receive, send)

    @database_sync_to_async
    def get_user(self, scope):
        token = self.get_token(scope)
        if not token:
            return AnonymousUser()

        try:
            validated_token = self.jwt_authentication.get_validated_token(token)
            return self.jwt_authentication.get_user(validated_token)
        except (AuthenticationFailed, InvalidToken, TokenError):
            return AnonymousUser()

    def get_token(self, scope) -> str:
        query_params = parse_qs(scope.get("query_string", b"").decode())
        query_token = query_params.get("token", [""])[0].strip()
        if query_token:
            return query_token

        headers = dict(scope.get("headers", []))
        raw_cookie = headers.get(b"cookie", b"").decode()
        if not raw_cookie:
            return ""

        cookies = SimpleCookie()
        cookies.load(raw_cookie)
        access_cookie = cookies.get(settings.JWT_ACCESS_COOKIE_NAME)
        return access_cookie.value if access_cookie else ""


def JwtWebSocketMiddlewareStack(inner):
    return JwtWebSocketMiddleware(inner)
