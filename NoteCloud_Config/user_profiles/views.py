from django.shortcuts import render, redirect, get_object_or_404
from rest_framework.views import APIView
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from .models import UserProfile
from .serializers import UserProfileSerializer
from .forms import ProfileForm
from django.contrib.auth.models import User


class ProfileView(APIView):
    def get(self, request, username):
        user = get_object_or_404(User, username=username)
        user_profile = get_object_or_404(UserProfile, user=user)
        form = ProfileForm(instance=user_profile)
        return render(request, 'profile/profile.html', {'form': form, 'username': user_profile.user.username})


class SettingsView(APIView):
    @method_decorator(login_required)
    def get(self, request):
        if request.user.is_authenticated:
            return render(request, 'profile/layout_settings.html')
        else:
            return redirect('/accounts/login/')


class ProfileEditView(APIView):
    @method_decorator(login_required)
    def get(self, request):
        user_profile = UserProfile.objects.get(user=request.user)
        return render(request, 'profile/edit_profile.html', {'user_profile': user_profile})

    @method_decorator(login_required)
    def post(self, request):
        user_profile = UserProfile.objects.get(user=request.user)

        if 'delete_avatar' in request.POST:
            user_profile.avatar.delete(save=False)
            user_profile.avatar = None
            user_profile.save()
            return redirect('edit_profile')

        serializer = UserProfileSerializer(user_profile, data=request.data, partial=True)

        if serializer.is_valid():
            serializer.save()
            return redirect('edit_profile')

        return render(request, 'profile/edit_profile.html', {'user_profile': user_profile, 'errors': serializer.errors})


class SettingsNotificationsView(APIView):
    @method_decorator(login_required)
    def get(self, request):
        return render(request, 'profile/settings_notifications.html')
