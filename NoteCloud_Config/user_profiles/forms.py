from django import forms
from .models import UserProfile
from allauth.socialaccount.forms import SignupForm
from django.conf import settings
from django.contrib.auth.models import User
from rest_framework.exceptions import ValidationError
from allauth.account.adapter import get_adapter
from telegram_bot import is_subscribed
from django.utils.safestring import mark_safe


def is_subscribed_to_bot(telegram_user_id):
    if is_subscribed(telegram_user_id):
        return True
    return False


class ProfileForm(forms.ModelForm):
    class Meta:
        model = UserProfile
        fields = ['avatar', 'about_me']
        widgets = {
            'about_me': forms.TextInput(attrs={'readonly': 'readonly'}),
            'avatar': forms.ClearableFileInput(attrs={'disabled': 'disabled'}),
        }


class CustomSignupForm(SignupForm):
    username = forms.CharField(label="Username")

    def __init__(self, *args, **kwargs):
        super(CustomSignupForm, self).__init__(*args, **kwargs)

        if not settings.SOCIALACCOUNT_EMAIL_REQUIRED:
            if 'email' in self.fields:
                self.fields['email'].widget = forms.HiddenInput()

    def clean_username(self):
        username = self.cleaned_data.get('username')

        if User.objects.filter(username=username).exists():
            self.add_error('username', "Этот логин уже занят.")
        if username.lower() in settings.ACCOUNT_USERNAME_BLACKLIST:
            self.add_error('username', "Такое имя пользователя не может быть использовано, выберите другое.")
        if len(username) < settings.ACCOUNT_USERNAME_MIN_LENGTH:
            self.add_error('username', "Увеличьте имя пользователя до 4 символов или более.")

        return username

    def clean(self):
        cleaned_data = super().clean()

        if hasattr(self, 'sociallogin') and self.sociallogin:
            social_account = self.sociallogin.account
            if social_account.provider == 'telegram':
                telegram_user_id = social_account.extra_data.get('id')
                if not is_subscribed_to_bot(telegram_user_id):
                    self.add_error('username',
                                   mark_safe("Вы не подписаны на Telegram-бота <a href='https://t.me/CoNoteBot' target='_blank'>@CoNoteBot</a>. Подпишитесь, чтобы продолжить."))

        return cleaned_data

    def save(self, request):
        user = super().save(request)
        user.username = self.cleaned_data['username']

        if not settings.SOCIALACCOUNT_EMAIL_REQUIRED:
            user.email = ''

        user.save()

        return user
