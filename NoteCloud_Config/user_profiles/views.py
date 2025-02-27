from django.shortcuts import render, redirect, get_object_or_404
from rest_framework.views import APIView
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from .models import UserProfile
from .serializers import UserProfileSerializer
from .forms import ProfileForm
from django.contrib.auth.models import User
from .models import Subscription, SettingsPrivacy, SettingsNotifications
from rest_framework.response import Response
from django.urls import reverse


class ProfileView(APIView):
    def get(self, request, username):
        user = get_object_or_404(User, username=username)
        user_profile = get_object_or_404(UserProfile, user=user)
        form = ProfileForm(instance=user_profile)
        settings_privacy = get_object_or_404(SettingsPrivacy, user=user)

        if settings_privacy.disable_profile_view and not request.user.is_authenticated:
            return redirect(f'{reverse("account_login")}?next={request.path}')

        subscription = get_object_or_404(Subscription, user=user)

        current_user = request.user
        is_owner = current_user == user
        is_subscribed = False
        is_subscribed = current_user in subscription.subscriptions.all()

        subscribers_count = subscription.subscriptions.count()
        if settings_privacy.disable_subscribers_view and request.user.username != user.username:
            subscribers_info = []
            flag_display_moreBtn_subscribers = False
        else:
            subscribers_info = subscription.get_subscriptions_info()
            flag_display_moreBtn_subscribers = True

        subscriptions_count = subscription.subscribers.count()
        if settings_privacy.disable_subscriptions_view and request.user.username != user.username:
            subscriptions_info = []
            flag_display_moreBtn_subscriptions = False
        else:
            subscriptions_info = subscription.get_subscribers_info()
            flag_display_moreBtn_subscriptions = True

        return render(request, 'profile/profile.html', {'form': form, 'username': user_profile.user.username,
                                                        'is_owner': is_owner, 'is_subscribed': is_subscribed, 'user_id': user_profile.user.id,
                                                        'subscribers_count': subscribers_count, 'subscribers_info': subscribers_info,
                                                        'subscriptions_count': subscriptions_count, 'subscriptions_info':subscriptions_info,
                                                        'flag_display_moreBtn_subscribers': flag_display_moreBtn_subscribers,
                                                        'flag_display_moreBtn_subscriptions': flag_display_moreBtn_subscriptions
                                                        })


class SettingsView(APIView):
    @method_decorator(login_required)
    def get(self, request):
        return render(request, 'profile/layout_settings.html')


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


class SettingsPrivacyView(APIView):
    @method_decorator(login_required)
    def get(self, request):
        user_settings_privacy = get_object_or_404(SettingsPrivacy, user=request.user)

        return render(request, 'profile/settings_privacy.html',
                      {'disable_subscribers_view': user_settings_privacy.disable_subscribers_view,
                       'disable_subscriptions_view': user_settings_privacy.disable_subscriptions_view,
                       'disable_profile_view': user_settings_privacy.disable_profile_view
                       })

    @method_decorator(login_required)
    def post(self, request):
        disable_subscribers_view = request.POST.get('disable_subscribers_view') == 'on'
        disable_subscriptions_view = request.POST.get('disable_subscriptions_view') == 'on'
        disable_profile_view = request.POST.get('disable_profile_view') == 'on'

        user_settings_privacy = get_object_or_404(SettingsPrivacy, user=request.user)
        user_settings_privacy.disable_subscribers_view = disable_subscribers_view
        user_settings_privacy.disable_subscriptions_view = disable_subscriptions_view
        user_settings_privacy.disable_profile_view = disable_profile_view
        user_settings_privacy.save()

        return redirect('settings_privacy')


class SettingsNotificationsView(APIView):
    @method_decorator(login_required)
    def get(self, request):
        user_settings_notifications = get_object_or_404(SettingsNotifications, user=request.user)

        return render(request, 'profile/settings_notifications.html',
                      {'disable_notifications': user_settings_notifications.disable_notifications,
                       })

    @method_decorator(login_required)
    def post(self, request):
        disable_notifications = request.POST.get('disable_notifications') == 'on'
        disabling_news_messages = request.POST.get('disabling_news_messages') == 'on'

        user_settings_notifications = get_object_or_404(SettingsNotifications, user=request.user)
        user_settings_notifications.disable_notifications = disable_notifications
        user_settings_notifications.disabling_news_messages = disabling_news_messages
        user_settings_notifications.save()

        return redirect('settings_notifications')


class SubscribeView(APIView):
    @method_decorator(login_required)
    def post(self, request, username):
        user_to_subscribe = get_object_or_404(User, username=username)
        subscription = get_object_or_404(Subscription, user=user_to_subscribe)

        subscribing_user = request.user

        if subscribing_user in subscription.subscriptions.all():
            return Response({'success': False, 'error': 'Вы уже подписаны на этого пользователя.'})

        subscription.subscribe(subscribing_user)

        return Response({'success': True, 'current_user': subscribing_user.username})


class UnsubscribeView(APIView):
    @method_decorator(login_required)
    def post(self, request, username):
        user_to_unsubscribe = get_object_or_404(User, username=username)
        subscription = get_object_or_404(Subscription, user=user_to_unsubscribe)

        subscribing_user = request.user

        if subscribing_user not in subscription.subscriptions.all():
            return Response({'success': False, 'error': 'Вы не подписаны на этого пользователя.'})

        subscription.unsubscribe(subscribing_user)

        return Response({'success': True, 'current_user': subscribing_user.username})
