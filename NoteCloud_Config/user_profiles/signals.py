from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from .models import UserProfile, Subscription, SettingsPrivacy, SettingsEmailMessages, SettingsNotifications

User = get_user_model()


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)
        Subscription.objects.create(user=instance)
        SettingsPrivacy.objects.create(user=instance)
        SettingsEmailMessages.objects.create(user=instance)
        SettingsNotifications.objects.create(user=instance)
