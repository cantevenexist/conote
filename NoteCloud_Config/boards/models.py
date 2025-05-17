from django.db import models
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from user_profiles.models import PremiumSubscription
import uuid
import time
import hashlib
from django.utils import timezone
from .storages import MinioStorage
from django.utils.deconstruct import deconstructible
import json
from django.core.files.base import ContentFile


@deconstructible
class BoardFilePath(object):
    def __init__(self, upload_to):
        self.upload_to = upload_to

    def __call__(self, instance, filename):
        return self.generate_filename(instance, filename)

    def generate_filename(self, instance, filename):
        username_hash = hashlib.md5(instance.user.username.encode()).hexdigest()
        return f'media/boards/{username_hash}/{instance.url_hash}.json'


class Board(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='board_owner')
    name = models.CharField(max_length=255, default='Без названия')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    access_users = models.ManyToManyField(User, blank=True, related_name='accessible_boards')
    board_value = models.FileField(upload_to=BoardFilePath('media/'), storage=MinioStorage(), blank=True, null=True)
    url_hash = models.CharField(max_length=64, unique=True, blank=True, null=True)
    favorites = models.ManyToManyField(User, blank=True, related_name='favorite_boards')

    def clean(self):
        subscription = PremiumSubscription.objects.get(user=self.user)
        limit = 10 if subscription.check_subscription else 5
        if self.access_users.count() > limit:
            raise ValidationError(f"Максимальное количество пользователей для доступа: {limit}")

    def save(self, *args, **kwargs):
        creating = self.pk is None

        if not self.url_hash:
            server_time = str(time.time())
            hash_input = f"{self.name}{server_time}{self.user.username}{uuid.uuid4()}"
            self.url_hash = hashlib.sha256(hash_input.encode('utf-8')).hexdigest()
        super().save(*args, **kwargs)

        if creating and not self.board_value:
            default_content = json.dumps({})
            file = ContentFile(default_content.encode('utf-8'))
            file.name = f"{self.url_hash}.json"
            self.board_value.save(file.name, file)
            super().save(update_fields=['board_value'])

    def delete(self, *args, **kwargs):
        if self.board_value:
            self.board_value.delete(save=False)
        super().delete(*args, **kwargs)

    def __str__(self):
        return f'{self.name} ({self.user.username})'


class Trash(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='trash_items')
    name = models.CharField(max_length=255, null=False)
    created_at = models.DateTimeField(null=False)
    updated_at = models.DateTimeField(null=False)
    board_value = models.TextField(blank=True, null=True)
    url_hash = models.CharField(max_length=64, unique=True, blank=True, null=False)
    deleted_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Доска {self.name} удалена"


class Invitation(models.Model):
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    board = models.ForeignKey(Board, on_delete=models.CASCADE, related_name='invitations')
    invited_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='invitations_received')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='invitations_sent')
    created_at = models.DateTimeField(auto_now_add=True)
    used = models.BooleanField(default=False)
    used_at = models.DateTimeField(null=True, blank=True)

    def mark_used(self):
        self.used = True
        self.used_at = timezone.now()
        self.save(update_fields=['used', 'used_at'])
