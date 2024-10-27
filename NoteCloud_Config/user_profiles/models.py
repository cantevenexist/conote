from django.db import models
from django.contrib.auth import get_user_model
import os
import hashlib

User = get_user_model()


def user_avatar_path(instance, filename):
    username_hash = hashlib.md5(instance.user.username.encode()).hexdigest()
    file_hash = hashlib.md5(filename.encode()).hexdigest()
    return f'avatars/{username_hash}/{file_hash}.png'


class UserProfile(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='profile')
    avatar = models.ImageField(upload_to=user_avatar_path, blank=True, null=True)
    about_me = models.CharField(max_length=500, blank=True, null=True)

    def __str__(self):
        return f"Профиль {User.username}"

    def save(self, *args, **kwargs):
        if self.pk:
            try:
                old_image = UserProfile.objects.get(pk=self.pk).avatar
            except UserProfile.DoesNotExist:
                old_image = None

            if old_image and old_image != self.avatar:
                if os.path.isfile(old_image.path):
                    os.remove(old_image.path)

        super().save(*args, **kwargs)
