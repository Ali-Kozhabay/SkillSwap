# 🚀 SkillSwap — Peer-to-Peer Service Marketplace

## 📌 Overview
**SkillSwap** is a full-stack web application that allows users to offer and book services in a peer-to-peer marketplace.  
The platform enables seamless interaction between service providers and clients through booking, messaging, and review systems.

This project demonstrates a **real-world marketplace architecture** using modern web technologies.

---

## 🎯 Features

### 🔐 Authentication
- User registration and login (JWT-based)
- Secure session handling
- User profiles with basic information

### 🛍 Service Marketplace
- Create and manage services
- Browse all available services
- View detailed service information

### 🔍 Search & Filtering
- Search services by title
- Filter services by category

### 📅 Booking System (Core Feature)
- Book services from other users
- Booking lifecycle:
  - `pending`
  - `accepted`
  - `completed`
- Prevent users from booking their own services

### 💬 Chat System
- Messaging between users within bookings
- Access restricted to booking participants
- Messages linked to bookings

### ⭐ Review System
- Users can leave ratings (1–5)
- Reviews allowed only after booking completion
- Builds trust and reputation

---

## 🏗 Architecture


- **Frontend:** Angular (SPA)
- **Backend:** Django + Django REST Framework
- **Authentication:** JWT
- **Database:** PostgreSQL

---

## 🗂 Database Schema

### Main Models
- **User** — platform users
- **Category** — service categories
- **Service** — services created by users
- **Booking** — service reservations
- **Message** — chat messages within bookings
- **Review** — user feedback and ratings

### Relationships
- Service → User (owner)
- Booking → Service + User (client)
- Message → Booking + User
- Review → Booking

---

## 🔌 API Endpoints (Core)

### Auth
- `POST /auth/register`
- `POST /auth/login`

### Services
- `GET /services/`
- `POST /services/`
- `GET /services/{id}/`

### Bookings
- `POST /bookings/`
- `GET /bookings/my/`

### Messages
- `GET /bookings/{id}/messages/`
- `POST /messages/`

### Reviews
- `POST /reviews/`

---

## ⚙️ Business Logic

- Users **cannot book their own services**
- Only booking participants can access chat
- Reviews are allowed **only after completion**
- All actions are validated on the backend

---

## 🖥 Frontend Structure (Angular)

### Pages
- `/login`
- `/services`
- `/service/:id`
- `/dashboard`
- `/chat/:bookingId`

### Key Features
- Angular routing
- Forms with `[(ngModel)]`
- HTTP communication via `HttpClient`
- JWT interceptor for authentication
- Error handling and user feedback

---

## 🧪 Testing

- API tested using **Postman collection**
- Includes example requests and responses

---

## 🚀 Getting Started

### Backend Setup
```bash
git clone <repo>
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
