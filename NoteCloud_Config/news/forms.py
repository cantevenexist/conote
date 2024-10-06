from django import forms
from .models import News

class NewsForm(forms.ModelForm):
    class Meta:
        model = News
        fields = ['title', 'preview_content', 'content', 'image']  # Добавлено поле для изображения
