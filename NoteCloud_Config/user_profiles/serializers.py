from rest_framework import serializers
from .models import UserProfile


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserProfile
        fields = ['avatar', 'about_me']

    def update(self, instance, validated_data):
        old_avatar = instance.avatar

        instance.about_me = validated_data.get('about_me', instance.about_me)

        if 'avatar' in validated_data and validated_data['avatar'] is not None:
            instance.avatar = validated_data['avatar']
        else:
            instance.avatar = old_avatar

        instance.save()
        return instance
