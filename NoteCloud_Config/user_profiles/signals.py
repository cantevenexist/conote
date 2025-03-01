from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from .models import UserProfile, Subscription, SettingsPrivacy, SettingsNotifications
from django.db import transaction
from rest_framework.exceptions import ValidationError
import urllib.request
from django.core.files.base import ContentFile
from allauth.account.signals import user_logged_in
from allauth.socialaccount.models import SocialAccount

User = get_user_model()


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        try:
            with transaction.atomic():
                UserProfile.objects.create(user=instance)
                Subscription.objects.create(user=instance)
                SettingsPrivacy.objects.create(user=instance)
                SettingsNotifications.objects.create(user=instance)
        except Exception as e:
            raise ValueError(f"Ошибка создания профиля пользователя и связанных объектов: {str(e)}")


@receiver(user_logged_in)
def save_telegram_avatar_on_login(sender, request, user, **kwargs):
    social_account = SocialAccount.objects.filter(user=user, provider='telegram').first()
    if social_account:
        avatar_url = social_account.extra_data.get('photo_url')
        if avatar_url:
            user_profile, created = UserProfile.objects.get_or_create(user=user)
            if created or not user_profile.avatar:
                response = urllib.request.urlopen(avatar_url)
                avatar_image = ContentFile(response.read())
                user_profile.avatar.save(f'{user.username}_avatar.jpg', avatar_image)
                user_profile.save()
