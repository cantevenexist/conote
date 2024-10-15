from django import forms
from .models import News, Comment

class NewsForm(forms.ModelForm):
    class Meta:
        model = News
        fields = ['title', 'preview_content', 'content', 'image']


class CommentForm(forms.ModelForm):
    class Meta:
        model = Comment
        fields = ['content']