from django.contrib import admin

from .models import Booking, Category, Message, Review, Service


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = ("title", "owner", "category", "price", "is_active", "created_at")
    list_filter = ("category", "is_active")
    search_fields = ("title", "summary", "description", "owner__username")


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        "service",
        "client",
        "compensation_type",
        "offered_service",
        "status",
        "scheduled_for",
        "created_at",
    )
    list_filter = ("status", "compensation_type")
    search_fields = (
        "service__title",
        "offered_service__title",
        "client__username",
    )


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ("booking", "sender", "created_at")
    search_fields = ("booking__service__title", "sender__username", "text")


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ("booking", "reviewer", "rating", "created_at")
