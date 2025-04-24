from rest_framework import serializers
from .models import UserProfile
from rest_framework.validators import UniqueValidator
from django.contrib.auth.models import User
from rest_framework.exceptions import ValidationError
from django.conf import settings
from PIL import Image
from io import BytesIO
from django.core.files.base import ContentFile


def remove_exif(image_field):
    try:
        image = Image.open(image_field)
        output = BytesIO()

        image.save(output, format=image.format, exif=b"")
        output.seek(0)

        return ContentFile(output.read(), name=image_field.name)

    except Exception:
        return image_field


class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', required=False)
    links = serializers.ListField(
        required=False,
        allow_null=True
    )

    class Meta:
        model = UserProfile
        fields = ['avatar', 'about_me', 'username', 'links']

    def update(self, instance, validated_data):
        old_avatar = instance.avatar

        instance.about_me = validated_data.get('about_me', instance.about_me)

        links_data = validated_data.get('links', None)
        if links_data is not None:
            instance.links = links_data[:3]

        avatar_data = validated_data.get('avatar', None)
        if avatar_data:
            avatar_data = remove_exif(avatar_data)
            instance.avatar = avatar_data
        else:
            instance.avatar = old_avatar

        user_data = validated_data.get('user', {})
        if 'username' in user_data:
            username_data = user_data['username']

            if username_data.lower() in settings.ACCOUNT_USERNAME_BLACKLIST:
                raise ValidationError({"username_error": "Такое имя пользователя не может быть использовано, выберите другое."})

            if len(username_data.lower()) < settings.ACCOUNT_USERNAME_MIN_LENGTH:
                raise ValidationError({"username_error": "Увеличьте имя пользователя до 4 символов или более. "})

            if User.objects.filter(username=username_data).exists():
                raise ValidationError({"username_error": "Этот логин уже занят."})
            instance.user.username = username_data
            instance.user.save()

        instance.save()
        return instance
