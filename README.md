# 🚀 SkillSwap — Peer-to-Peer Service Marketplace
# Group members: Kozhabay Ali, Sakhan Zarina, Khurshitova Nazgul

## 📌 Overview
**SkillSwap** is a full-stack web application that allows users to offer and book services in a peer-to-peer marketplace.  
The platform enables seamless interaction between service providers and clients through booking, messaging, and review systems.

This project demonstrates a **real-world marketplace architecture** using modern web technologies.

---

Features

###  Authentication
- User registration and login (JWT-based)
- Secure session handling
- User profiles with basic information

### Service Marketplace
- Create and manage services
- Browse all available services
- View detailed service information

### Search & Filtering
- Search services by title
- Filter services by category

### Booking System (Core Feature)
- Book services from other users
- Booking lifecycle:
  - `pending`
  - `accepted`
  - `completed`
- Prevent users from booking their own services

### Chat System
- Messaging between users within bookings
- Access restricted to booking participants
- Messages linked to bookings

### Review System
- Users can leave ratings (1–5)
- Reviews allowed only after booking completion
- Builds trust and reputation

---
