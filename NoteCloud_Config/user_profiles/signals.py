from django.db.models.signals import post_save, pre_save, post_delete
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from .models import UserProfile, Subscription, SettingsPrivacy, SettingsNotifications, PremiumSubscription, Notification
from django.db import transaction
from rest_framework.exceptions import ValidationError
import urllib.request
from django.core.files.base import ContentFile
from allauth.account.signals import user_logged_in
from allauth.socialaccount.models import SocialAccount
from django.contrib.contenttypes.models import ContentType
from .tasks import send_push_notification_all
from news.models import News

User = get_user_model()


def _make_template_notification(news: News) -> Notification:
    ct = ContentType.objects.get_for_model(news)
    text = news.title
    if news.preview_content:
        text += "\n" + news.preview_content

    url = f"/news/detail/{news.slug}/"
    button_html = (
        f'\n<a href="{url}"><button>Перейти к новости</button></a>'
    )
    text += button_html

    return Notification.objects.create(
        user=None,
        message=text,
        level='info',
        content_type=ct,
        object_id=news.pk,
    )


@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        try:
            with transaction.atomic():
                UserProfile.objects.create(user=instance)
                Subscription.objects.create(user=instance)
                SettingsPrivacy.objects.create(user=instance)
                SettingsNotifications.objects.create(user=instance)
                PremiumSubscription.objects.create(user=instance)
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


@receiver(pre_save, sender=News)
def news_pre_save(sender, instance: News, **kwargs):
    if instance.pk:
        try:
            old = sender.objects.get(pk=instance.pk)
            instance._old_title = old.title
            instance._old_preview = old.preview_content
        except sender.DoesNotExist:
            instance._old_title = None
            instance._old_preview = None


@receiver(post_save, sender=News)
def news_post_save(sender, instance: News, created, **kwargs):
    ct = ContentType.objects.get_for_model(instance)

    if created:
        tpl = _make_template_notification(instance)
    else:
        old_title = getattr(instance, '_old_title', None)
        old_preview = getattr(instance, '_old_preview', None)

        if old_title == instance.title and old_preview == instance.preview_content:
            return

        Notification.objects.filter(content_type=ct, object_id=instance.pk).delete()
        tpl = _make_template_notification(instance)

    transaction.on_commit(
        lambda tpl_id=tpl.id: send_push_notification_all.delay(
            [tpl_id],
            exclude_kwargs=[
                {'user_settings_notifications__disable_notifications': True},
                {'user_settings_notifications__disabling_news_messages': True},
            ]
        )
    )


@receiver(post_delete, sender=News)
def on_news_delete(sender, instance: News, **kwargs):
    ct = ContentType.objects.get_for_model(instance)
    Notification.objects.filter(content_type=ct, object_id=instance.pk).delete()
