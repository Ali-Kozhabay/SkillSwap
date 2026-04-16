from django.db import migrations, models


def mark_existing_completed_bookings_as_confirmed(apps, schema_editor):
    Booking = apps.get_model("marketplace", "Booking")
    Booking.objects.filter(status="completed").update(
        provider_completion_confirmed=True,
        client_completion_confirmed=True,
    )


class Migration(migrations.Migration):
    dependencies = [
        ("marketplace", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="booking",
            name="provider_completion_confirmed",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="booking",
            name="client_completion_confirmed",
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(
            mark_existing_completed_bookings_as_confirmed,
            migrations.RunPython.noop,
        ),
    ]
