from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.marketplace.models import Booking, Category, Message, Review, Service


class Command(BaseCommand):
    help = "Seed demo categories, users, services, bookings, messages, and a review."

    def handle(self, *args, **options):
        user_model = get_user_model()

        categories = [
            ("Design", "design", "Brand identity, UI, and visual work."),
            ("Tutoring", "tutoring", "One-to-one coaching and subject help."),
            ("Tech Help", "tech-help", "Setup, troubleshooting, and automations."),
            ("Marketing", "marketing", "Content planning and campaign support."),
        ]

        category_map = {}
        for name, slug, description in categories:
            category, _ = Category.objects.get_or_create(
                slug=slug,
                defaults={"name": name, "description": description},
            )
            category_map[slug] = category

        demo_users = [
            {
                "username": "alina",
                "email": "alina@example.com",
                "password": "demo12345",
                "first_name": "Alina",
                "last_name": "Kozha",
                "location": "Almaty",
                "bio": "Product designer helping startups shape their first launch.",
            },
            {
                "username": "timur",
                "email": "timur@example.com",
                "password": "demo12345",
                "first_name": "Timur",
                "last_name": "Saken",
                "location": "Astana",
                "bio": "Math tutor focused on fast exam prep and structured practice.",
            },
            {
                "username": "madi",
                "email": "madi@example.com",
                "password": "demo12345",
                "first_name": "Madi",
                "last_name": "Nur",
                "location": "Shymkent",
                "bio": "Freelance automation specialist for solo businesses.",
            },
            {
                "username": "ayana",
                "email": "ayana@example.com",
                "password": "demo12345",
                "first_name": "Ayana",
                "last_name": "Serik",
                "location": "Almaty",
                "bio": "Marketing strategist building practical content systems for small brands.",
            },
        ]

        user_map = {}
        for payload in demo_users:
            password = payload.pop("password")
            user, created = user_model.objects.get_or_create(
                username=payload["username"],
                defaults=payload,
            )
            if created:
                user.set_password(password)
                user.save()
            user_map[user.username] = user

        services = [
            {
                "owner": user_map["alina"],
                "category": category_map["design"],
                "title": "Landing page UI review",
                "summary": "Sharp UI feedback with practical conversion fixes.",
                "description": "I review your landing page, annotate weak spots, and send a concise redesign direction.",
                "price": "18000.00",
                "location": "Remote",
            },
            {
                "owner": user_map["timur"],
                "category": category_map["tutoring"],
                "title": "One-hour calculus tutoring",
                "summary": "Exam-focused tutoring for derivatives and integrals.",
                "description": "We work through your weak areas live and finish with a short custom practice set.",
                "price": "12000.00",
                "location": "Astana or remote",
            },
            {
                "owner": user_map["madi"],
                "category": category_map["tech-help"],
                "title": "Small business workflow automation",
                "summary": "Connect forms, sheets, and notifications without manual busywork.",
                "description": "I map your repetitive workflow and build a simple automation stack around it.",
                "price": "25000.00",
                "location": "Remote",
            },
            {
                "owner": user_map["alina"],
                "category": category_map["design"],
                "title": "Brand identity mini sprint",
                "summary": "A fast visual direction pack for early-stage teams.",
                "description": "I create a lightweight brand direction with mood, color, typography, and key visual rules.",
                "price": "32000.00",
                "location": "Almaty or remote",
            },
            {
                "owner": user_map["timur"],
                "category": category_map["tutoring"],
                "title": "SAT math crash prep",
                "summary": "Targeted drills for algebra, problem solving, and timing strategy.",
                "description": "We diagnose weak areas, solve timed sets together, and finish with a focused revision plan.",
                "price": "15000.00",
                "location": "Astana or remote",
            },
            {
                "owner": user_map["madi"],
                "category": category_map["tech-help"],
                "title": "CRM and inbox automation audit",
                "summary": "Find manual bottlenecks in your lead handling workflow.",
                "description": "I review your current CRM, forms, and inbox process and outline quick automation wins you can ship fast.",
                "price": "21000.00",
                "location": "Remote",
            },
            {
                "owner": user_map["ayana"],
                "category": category_map["marketing"],
                "title": "Monthly content calendar setup",
                "summary": "A practical posting plan for Instagram, LinkedIn, or TikTok.",
                "description": "I build a one-month content calendar with hooks, posting themes, and a lightweight execution workflow.",
                "price": "19000.00",
                "location": "Almaty or remote",
            },
        ]

        service_map = {}
        for payload in services:
            service, _ = Service.objects.get_or_create(
                owner=payload["owner"],
                title=payload["title"],
                defaults=payload,
            )
            service_map[service.title] = service

        accepted_booking, _ = Booking.objects.get_or_create(
            service=service_map["Landing page UI review"],
            client=user_map["madi"],
            defaults={
                "status": Booking.Status.ACCEPTED,
                "scheduled_for": timezone.now() + timedelta(days=3),
                "note": "Need a review for a bakery ordering site.",
            },
        )

        completed_booking, _ = Booking.objects.get_or_create(
            service=service_map["One-hour calculus tutoring"],
            client=user_map["alina"],
            defaults={
                "status": Booking.Status.COMPLETED,
                "scheduled_for": timezone.now() - timedelta(days=2),
                "note": "Focused prep for an integration quiz.",
            },
        )

        pending_booking, _ = Booking.objects.get_or_create(
            service=service_map["Small business workflow automation"],
            client=user_map["timur"],
            defaults={
                "compensation_type": Booking.CompensationType.SERVICE,
                "offered_service": service_map["One-hour calculus tutoring"],
                "status": Booking.Status.PENDING,
                "scheduled_for": timezone.now() + timedelta(days=5),
                "note": "Want to automate intake requests from Google Forms.",
            },
        )

        Message.objects.get_or_create(
            booking=accepted_booking,
            sender=user_map["madi"],
            text="I uploaded the current homepage draft. Can you focus on checkout clarity too?",
        )
        Message.objects.get_or_create(
            booking=accepted_booking,
            sender=user_map["alina"],
            text="Yes. I’ll review the checkout flow and note quick wins for mobile.",
        )

        Review.objects.get_or_create(
            booking=completed_booking,
            defaults={
                "reviewer": user_map["alina"],
                "rating": 5,
                "comment": "Clear explanations and very focused practice problems.",
            },
        )

        self.stdout.write(self.style.SUCCESS("Demo data created or updated."))
