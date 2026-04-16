from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework.test import APITestCase


class AuthCookieFlowTests(APITestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="logout-user",
            email="logout@example.com",
            password="demo12345",
        )

    def test_login_sets_auth_cookies_and_allows_cookie_authentication(self):
        login_response = self.client.post(
            "/api/auth/login/",
            {"username": "logout-user", "password": "demo12345"},
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.assertEqual(login_response.data["user"]["username"], "logout-user")
        self.assertNotIn("access", login_response.data)
        self.assertNotIn("refresh", login_response.data)
        self.assertIn("skillswap_access_token", login_response.cookies)
        self.assertIn("skillswap_refresh_token", login_response.cookies)
        self.assertIn("skillswap_session", login_response.cookies)

        me_response = self.client.get("/api/auth/me/")
        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        self.assertEqual(me_response.data["username"], "logout-user")

    def test_refresh_uses_refresh_cookie(self):
        self.client.post(
            "/api/auth/login/",
            {"username": "logout-user", "password": "demo12345"},
            format="json",
        )
        refresh_response = self.client.post(
            "/api/auth/refresh/",
            {},
            format="json",
        )
        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
        self.assertEqual(refresh_response.data["detail"], "Session refreshed.")
        self.assertIn("skillswap_access_token", refresh_response.cookies)

    def test_logout_blacklists_refresh_cookie_and_clears_auth_cookies(self):
        login_response = self.client.post(
            "/api/auth/login/",
            {"username": "logout-user", "password": "demo12345"},
            format="json",
        )
        refresh_token = login_response.cookies["skillswap_refresh_token"].value

        logout_response = self.client.post("/api/auth/logout/", {}, format="json")
        self.assertEqual(logout_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(logout_response.cookies["skillswap_access_token"]["max-age"], 0)
        self.assertEqual(logout_response.cookies["skillswap_refresh_token"]["max-age"], 0)
        self.assertEqual(logout_response.cookies["skillswap_session"]["max-age"], 0)

        fresh_client = APIClient()
        refresh_response = fresh_client.post(
            "/api/auth/refresh/",
            {"refresh": refresh_token},
            format="json",
        )
        self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_returns_custom_message_for_invalid_credentials(self):
        response = self.client.post(
            "/api/auth/login/",
            {"username": "logout-user", "password": "wrong-password"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"][0], "Username or password is wrong.")

    def test_register_rejects_duplicate_email_with_different_case(self):
        response = self.client.post(
            "/api/auth/register/",
            {
                "username": "second-user",
                "email": "LOGOUT@EXAMPLE.COM",
                "password": "demo12345",
                "confirm_password": "demo12345",
                "first_name": "Second",
                "last_name": "User",
                "location": "Remote",
                "bio": "Duplicate email check",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)
