from __future__ import annotations

from math import ceil

from django.conf import settings


def _cookie_max_age_seconds(lifetime_setting: str) -> int:
    lifetime = settings.SIMPLE_JWT[lifetime_setting]
    return ceil(lifetime.total_seconds())


def set_auth_cookies(response, access_token: str | None = None, refresh_token: str | None = None):
    if access_token:
        response.set_cookie(
            settings.JWT_ACCESS_COOKIE_NAME,
            access_token,
            max_age=_cookie_max_age_seconds("ACCESS_TOKEN_LIFETIME"),
            path="/",
            samesite=settings.JWT_COOKIE_SAMESITE,
            secure=settings.JWT_COOKIE_SECURE,
            httponly=True,
        )

    if refresh_token:
        response.set_cookie(
            settings.JWT_REFRESH_COOKIE_NAME,
            refresh_token,
            max_age=_cookie_max_age_seconds("REFRESH_TOKEN_LIFETIME"),
            path=settings.JWT_REFRESH_COOKIE_PATH,
            samesite=settings.JWT_COOKIE_SAMESITE,
            secure=settings.JWT_COOKIE_SECURE,
            httponly=True,
        )

    response.set_cookie(
        settings.JWT_SESSION_COOKIE_NAME,
        "1",
        max_age=_cookie_max_age_seconds("REFRESH_TOKEN_LIFETIME"),
        path="/",
        samesite=settings.JWT_COOKIE_SAMESITE,
        secure=settings.JWT_COOKIE_SECURE,
        httponly=False,
    )


def clear_auth_cookies(response):
    response.delete_cookie(
        settings.JWT_ACCESS_COOKIE_NAME,
        path="/",
        samesite=settings.JWT_COOKIE_SAMESITE,
    )
    response.delete_cookie(
        settings.JWT_REFRESH_COOKIE_NAME,
        path=settings.JWT_REFRESH_COOKIE_PATH,
        samesite=settings.JWT_COOKIE_SAMESITE,
    )
    response.delete_cookie(
        settings.JWT_SESSION_COOKIE_NAME,
        path="/",
        samesite=settings.JWT_COOKIE_SAMESITE,
    )
