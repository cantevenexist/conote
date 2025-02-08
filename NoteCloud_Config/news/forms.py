from django import forms
from .models import News, Comment


class NewsForm(forms.ModelForm):
    class Meta:
        model = News
        fields = ['title', 'preview_content', 'content', 'image']
        widgets = {
            'title': forms.Textarea(attrs={'class': 'textarea', 'rows': 1,'placeholder': 'Заголовок новости...'}),
            'preview_content': forms.Textarea(attrs={'class': 'textarea', 'rows': 1,'placeholder': 'Превью новости...'}),
            'content': forms.Textarea(attrs={'class': 'textarea', 'rows': 1,'placeholder': 'Содержание новости...'}),
            'image': forms.ClearableFileInput(attrs={'class': 'form-control'}),
        }

class CommentForm(forms.ModelForm):
    class Meta:
        model = Comment
        fields = ['content']
        widgets = {
            'content': forms.Textarea(attrs={'class': 'textarea', 'rows': 1,'placeholder': 'Написать комментарий...'}),
        }
