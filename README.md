# SkillSwap

SkillSwap is a peer-to-peer service marketplace where users can publish services, book other users, chat inside a booking, and leave reviews only after completion. The project is built as a full-stack web application with an Angular 21 frontend and a Django REST backend with JWT cookie authentication.

## Team

- Kozhabay Ali
- Sakhan Zarina
- Khurshitova Nazgul

## Stack

- Frontend: Angular 21 SPA in [`skillswap-frontend`](skillswap-frontend)
- Backend: Django REST + Channels in [`skillswap-backend`](skillswap-backend)
- Auth: JWT access/refresh cookies
- Database: SQLite by default, PostgreSQL-ready through environment variables
- Real-time: WebSocket chat scoped to booking participants

## Core Features

- User registration, login, refresh, logout, and current-user profile retrieval
- Marketplace listing creation, update, delete, search, and category filtering
- Booking lifecycle with `pending`, `accepted`, and double-confirmed `completed`
- Real-time booking chat restricted to the client and provider
- Review flow unlocked only after a completed booking
- Provider dashboard for listings, incoming requests, outgoing bookings, and reviews

## Architecture Summary

- Angular handles routing, marketplace browsing, account access, dashboard actions, and live chat UI.
- Django REST Framework exposes the marketplace and authentication APIs under `/api/`.
- Django Channels handles `/ws/bookings/:id/chat/` for real-time booking messages.
- Business rules are enforced on the backend so the UI cannot bypass them.

## Key Business Rules

- Users cannot book their own services.
- Only active services appear publicly in the marketplace.
- Inactive services remain manageable by their owners but are hidden from other users.
- Only the provider can accept a pending booking.
- Completion requires confirmation from both provider and client.
- Only booking participants can access messages or the WebSocket chat.
- Reviews are limited to one per booking and only after completion.

## Quick Start

### Backend

From [`skillswap-backend`](skillswap-backend):

```bash
python3 -m pip install -r requirements.txt
python3 manage.py migrate
python3 manage.py seed_demo
python3 manage.py runserver
```

Notes:

- SQLite is used by default for fast local startup.
- PostgreSQL can be configured with [`skillswap-backend/.env.example`](skillswap-backend/.env.example).
- API base path is `/api/`.

Demo accounts after seeding:

- `alina / demo12345`
- `timur / demo12345`
- `madi / demo12345`

### Frontend

From [`skillswap-frontend`](skillswap-frontend):

```bash
npm install
npm start
```

Notes:

- The Angular dev server proxies `/api` requests to `http://127.0.0.1:8000` via [`skillswap-frontend/proxy.conf.json`](skillswap-frontend/proxy.conf.json).
- Main routes:
  - `/login`
  - `/services`
  - `/service/:id`
  - `/dashboard`
  - `/chat/:bookingId`

## Demo Flow For Defense

1. Open the marketplace and show search/category filtering.
2. Log in with a seeded user and open the dashboard.
3. Create or manage a service listing.
4. Book a service from another account.
5. Accept the booking as the provider.
6. Open the booking chat and send a live message.
7. Confirm completion from provider, then confirm from client.
8. Submit a review and show it on the service detail page.

## API Overview

- `POST /api/auth/register/`
- `POST /api/auth/login/`
- `POST /api/auth/refresh/`
- `POST /api/auth/logout/`
- `GET /api/auth/me/`
- `GET /api/categories/`
- `GET /api/services/`
- `POST /api/services/`
- `GET /api/services/{id}/`
- `GET /api/services/mine/`
- `POST /api/bookings/`
- `GET /api/bookings/my/`
- `GET /api/bookings/{id}/`
- `PATCH /api/bookings/{id}/status/`
- `GET /api/bookings/{id}/messages/`
- `POST /api/messages/`
- `POST /api/reviews/`

## Verification

- Frontend production build
- Frontend unit tests
- Django system check
- Django test suite covering auth cookies, booking completion, service visibility, message endpoint behavior, and WebSocket chat

## Repository Notes

- Root setup instructions live in this README.
- Frontend-specific notes live in [`skillswap-frontend/README.md`](skillswap-frontend/README.md).
- Backend requirements are in [`skillswap-backend/requirements.txt`](skillswap-backend/requirements.txt).
