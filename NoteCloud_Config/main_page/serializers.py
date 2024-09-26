from rest_framework import serializers
from .models import News


class NewsTitlesSerializer(serializers.ModelSerializer):
    class Meta:
        model = News
        fields = ['id', 'title', 'date']
        extra_kwargs = {
            'date': {'format': '%d.%m.%Y'}
        }


class NewsContentSerializer(serializers.ModelSerializer):
    class Meta:
        model = News
        fields = ['id', 'title', 'date', 'content']
        extra_kwargs = {
            'date': {'format': '%d.%m.%Y'}
        }
