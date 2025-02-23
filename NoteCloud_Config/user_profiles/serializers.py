from rest_framework import serializers
from .models import UserProfile
from rest_framework.validators import UniqueValidator
from django.contrib.auth.models import User
from rest_framework.exceptions import ValidationError
from django.conf import settings


class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', required=False)

    class Meta:
        model = UserProfile
        fields = ['avatar', 'about_me', 'username']

    def update(self, instance, validated_data):
        old_avatar = instance.avatar

        instance.about_me = validated_data.get('about_me', instance.about_me)

        if 'avatar' in validated_data and validated_data['avatar'] is not None:
            instance.avatar = validated_data['avatar']
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
