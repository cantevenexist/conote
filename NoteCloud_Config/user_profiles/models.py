from django.db import models
from django.contrib.auth import get_user_model
import os
import hashlib
from django.utils.deconstruct import deconstructible
from django.db import transaction
from django.core.validators import FileExtensionValidator
from django.core.exceptions import ValidationError
from .storages import MinioStorage
import re
import uuid
from django.utils import timezone

User = get_user_model()


@deconstructible
class UploadToPath(object):
    def __init__(self, upload_to):
        self.upload_to = upload_to

    def __call__(self, instance, filename):
        return self.generate_filename(instance, filename)

    def generate_filename(self, instance, filename):
        username_hash = hashlib.md5(instance.user.username.encode()).hexdigest()
        file_hash = hashlib.md5(filename.encode()).hexdigest()
        unique_id = uuid.uuid4().hex
        file_extension = filename.split('.')[-1]
        return f'media/avatars/{username_hash}/{file_hash}_{unique_id}.{file_extension}'


def file_size(value):
    limit = 2 * 1024 * 1024
    if value.size > limit:
        raise ValidationError('Размер изображения не должен превышать 2МБ')


def validate_https_url(value):
    pattern = r'^https:\/\/[^\s]+$'
    if not re.match(pattern, value):
        raise ValidationError('Неверный формат URL. Поддерживаются только ссылки с https протоколом')


def validate_links(value):
    if len(value) > 3:
        raise ValidationError('Разрешено добавить не более 3 ссылок на сторонние сервисы')
    for url in value:
        validate_https_url(url)


class UserProfile(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='profile')
    avatar = models.ImageField(upload_to=UploadToPath('media/'), blank=True, null=True, storage=MinioStorage(),
                               validators=[
                                   FileExtensionValidator(allowed_extensions=['bmp', 'jpeg', 'png', 'jpg', 'heic']),
                                   file_size
                               ])
    about_me = models.CharField(max_length=500, blank=True, null=True)
    links = models.JSONField(blank=True, null=True, validators=[validate_links])

    def __str__(self):
        return f"Профиль {User.username}"

    def save(self, *args, **kwargs):
        if self.pk:
            try:
                old_profile = UserProfile.objects.get(pk=self.pk)
            except UserProfile.DoesNotExist:
                old_profile = None

            if old_profile and old_profile.avatar and self.avatar and old_profile.avatar.name != self.avatar.name:
                old_profile.avatar.storage.delete(old_profile.avatar.name)

        super().save(*args, **kwargs)


class Subscription(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_subscriptions')
    subscriptions = models.ManyToManyField(User, related_name='subscriptions', blank=True)
    subscribers = models.ManyToManyField(User, related_name='subscribers', blank=True)

    async def get_subscriptions_info(self):
        subscriptions_data = []
        qs = self.subscriptions.all().prefetch_related('profile')
        async for user in qs.aiterator():
            profile = await user.profile.afirst() if hasattr(user.profile, "afirst") else user.profile
            avatar_url = profile.avatar.url if profile and profile.avatar else None
            subscriptions_data.append({'username': user.username, 'avatar': avatar_url})
        return subscriptions_data

    async def get_subscribers_info(self):
        subscribers_data = []
        qs = self.subscribers.all().prefetch_related('profile')
        async for user in qs.aiterator():
            profile = await user.profile.afirst() if hasattr(user.profile, "afirst") else user.profile
            avatar_url = profile.avatar.url if profile and profile.avatar else None
            subscribers_data.append({'username': user.username, 'avatar': avatar_url})
        return subscribers_data

    def subscribe(self, user_to_subscribe):
        with transaction.atomic():
            self.subscriptions.add(user_to_subscribe)
            user_subscription = Subscription.objects.get(user=user_to_subscribe)
            user_subscription.subscribers.add(self.user)

    def unsubscribe(self, user_to_unsubscribe):
        with transaction.atomic():
            self.subscriptions.remove(user_to_unsubscribe)
            user_subscription = Subscription.objects.get(user=user_to_unsubscribe)
            user_subscription.subscribers.remove(self.user)


class SettingsPrivacy(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_settings_privacy')
    disable_subscribers_view = models.BooleanField(default=False)
    disable_subscriptions_view = models.BooleanField(default=False)
    disable_profile_view = models.BooleanField(default=False)


class SettingsNotifications(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_settings_notifications')
    disable_notifications = models.BooleanField(default=False)
    disabling_news_messages = models.BooleanField(default=False)


class PremiumSubscription(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='premiumsubscription')
    is_active = models.BooleanField(default=False)
    activated_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True)
    unlimited = models.BooleanField(default=False)
    tokens = models.PositiveIntegerField(default=0)

    def save(self, *args, **kwargs):
        if self.unlimited:
            self.expires_at = None
        super().save(*args, **kwargs)

    def check_subscription(self):
        if not self.is_active:
            return False
        if self.unlimited:
            return True
        if self.is_active:
            if self.expires_at != None:
                if timezone.now() < self.expires_at:
                    return True
                else:
                    self.is_active = False
        return False

    def __str__(self):
        status = "Активна" if self.check_subscription else "Неактивна"
        return f'Статус подписки для  {self.user.username}: {status}'


class Notification(models.Model):
    LEVELS = (
        ('info', 'Информация'),
        ('warning', 'Предупреждение'),
        ('error', 'Ошибка'),
        ('critical', 'Критично'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    message = models.TextField()
    level = models.CharField(max_length=10, choices=LEVELS, default='info')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"[{self.level.upper()}] {self.message[:50]}"
