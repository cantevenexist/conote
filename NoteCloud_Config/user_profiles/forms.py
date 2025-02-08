from django import forms
from .models import UserProfile


class ProfileForm(forms.ModelForm):
    class Meta:
        model = UserProfile
        fields = ['avatar', 'about_me']
        widgets = {
            'about_me': forms.TextInput(attrs={'readonly': 'readonly'}),
            'avatar': forms.ClearableFileInput(attrs={'disabled': 'disabled'}),
        }
