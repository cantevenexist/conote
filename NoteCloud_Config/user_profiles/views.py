from django.shortcuts import render, redirect, get_object_or_404
from rest_framework.views import APIView
from django.contrib.auth.decorators import login_required
from django.utils.decorators import method_decorator
from .models import UserProfile
from .serializers import UserProfileSerializer
from .forms import ProfileForm
from django.contrib.auth.models import User
from .models import Subscription, SettingsPrivacy, SettingsNotifications, Notification
from rest_framework.response import Response
from django.urls import reverse
from asgiref.sync import sync_to_async
from django.http import Http404
from django.contrib.auth.mixins import AccessMixin
from django.urls import reverse_lazy
from django.contrib.auth.views import redirect_to_login
from django.views import View
from django.http import JsonResponse, HttpResponseBadRequest
from channels.db import database_sync_to_async
from django.core.paginator import Paginator
from django.db.models import Q
from django.views.decorators.http import require_POST


@sync_to_async
def render_sync(request, template, context):
    return render(request, template, context)


@sync_to_async
def get_request_user(request):
    user = request.user
    _ = user.pk
    return user


async def async_get_object_or_404(model_or_queryset, *args, **kwargs):
    """
    Асинхронная версия функции get_object_or_404.
    Пытается получить объект из переданного queryset или модели,
    используя указанные параметры фильтрации.
    Если объект не найден, выбрасывает Http404.

    :param model_or_queryset: Модель или QuerySet, из которого нужно получить объект.
    :param args: Позиционные аргументы для фильтрации.
    :param kwargs: Именованные аргументы для фильтрации.
    :return: Найденный объект.
    """
    # Если klass является QuerySet-ом, используем его, иначе получаем менеджер модели.
    queryset = model_or_queryset if hasattr(model_or_queryset, 'filter') else model_or_queryset._default_manager.filter()
    queryset = queryset.filter(*args, **kwargs)

    try:
        # Асинхронно получаем объект.
        obj = await queryset.aget()
    except queryset.model.DoesNotExist:
        # return redirect('404')
        raise Http404(f'No {queryset.model._meta.object_name} matches the given query.')

    return obj


async def async_get_or_create_object(model_or_queryset, *args, defaults=None, **kwargs):
    """
    Асинхронная версия get_object_or_create, которая при отсутствии объекта создаёт его.

    :param model_or_queryset: Модель или QuerySet, в котором производится поиск.
    :param args: Позиционные аргументы для фильтрации.
    :param defaults: Словарь значений по умолчанию для создания объекта, если его нет.
    :param kwargs: Именованные аргументы для фильтрации.
    :return: Найденный или созданный объект.
    :raises Http404: Если объект не найден и создать его не удалось.
    """
    # Если передан QuerySet, используем его, иначе получаем менеджер модели
    queryset = model_or_queryset if hasattr(model_or_queryset, 'filter') else model_or_queryset._default_manager.filter()
    queryset = queryset.filter(*args, **kwargs)

    try:
        # Пытаемся асинхронно получить объект
        obj = await queryset.aget()
        return obj
    except queryset.model.DoesNotExist:
        # Подготавливаем данные для создания объекта
        create_data = {}
        if defaults:
            create_data.update(defaults)
        create_data.update(kwargs)
        # Создаём объект асинхронно
        obj = await model_or_queryset._default_manager.acreate(**create_data)
        return obj


class AsyncLoginRequiredMixin(AccessMixin):
    login_url = reverse_lazy('account_login')

    async def dispatch(self, request, *args, **kwargs):
        user = await request.auser()
        if not user.is_authenticated:
            return await self.handle_no_permission()
        return await super().dispatch(request, *args, **kwargs)

    async def handle_no_permission(self):
        return redirect_to_login(
            self.request.get_full_path(),
            self.get_login_url(),
            self.get_redirect_field_name()
        )


class ProfileView(View):
    async def get(self, request, username):
        user = await async_get_object_or_404(User, username=username)
        user_profile = await async_get_object_or_404(
            UserProfile.objects.select_related('user'),
            user=user
        )
        form = ProfileForm(instance=user_profile)
        settings_privacy = await async_get_object_or_404(SettingsPrivacy, user=user)

        current_user = await get_request_user(request)

        if settings_privacy.disable_profile_view and not current_user.is_authenticated:
            return redirect(f'{reverse("account_login")}?next={request.path}')

        subscription = await async_get_object_or_404(Subscription, user=user)

        is_owner = current_user == user
        is_subscribed = False
        is_subscribed = await subscription.subscriptions.filter(pk=current_user.pk).aexists()

        subscribers_count = await subscription.subscriptions.acount()
        if settings_privacy.disable_subscribers_view and current_user.username != user.username:
            subscribers_info = []
            flag_display_moreBtn_subscribers = False
        else:
            subscribers_info = await subscription.get_subscriptions_info()
            flag_display_moreBtn_subscribers = True

        subscriptions_count = await subscription.subscribers.acount()
        if settings_privacy.disable_subscriptions_view and current_user.username != user.username:
            subscriptions_info = []
            flag_display_moreBtn_subscriptions = False
        else:
            subscriptions_info = await subscription.get_subscribers_info()
            flag_display_moreBtn_subscriptions = True

        return await render_sync(request, 'profile/profile.html', {'form': form, 'username': user_profile.user.username,
                                                        'is_owner': is_owner, 'is_subscribed': is_subscribed, 'user_id': user_profile.user.id,
                                                        'subscribers_count': subscribers_count, 'subscribers_info': subscribers_info,
                                                        'subscriptions_count': subscriptions_count, 'subscriptions_info':subscriptions_info,
                                                        'flag_display_moreBtn_subscribers': flag_display_moreBtn_subscribers,
                                                        'flag_display_moreBtn_subscriptions': flag_display_moreBtn_subscriptions
                                                        })


class ProfileEditView(AsyncLoginRequiredMixin, View):
    async def get(self, request):
        user = await get_request_user(request)
        user_profile = await async_get_or_create_object(UserProfile, user=user)

        return await render_sync(request, 'profile/edit_profile.html', {'user_profile': user_profile})

    async def post(self, request):
        user = await get_request_user(request)
        user_profile = await async_get_or_create_object(UserProfile, user=user)

        if 'delete_avatar' in request.POST:
            await database_sync_to_async(user_profile.avatar.delete)(save=False)
            user_profile.avatar = None
            await database_sync_to_async(user_profile.save)()
            return redirect('edit_profile')

        data = getattr(request, 'data', None)
        if data is None:
            data = request.POST.copy()
            data.update(request.FILES)
        serializer = UserProfileSerializer(user_profile, data=data, partial=True)

        if serializer.is_valid():
            await database_sync_to_async(serializer.save)()
            return redirect('edit_profile')

        return await render_sync(request, 'profile/edit_profile.html', {'user_profile': user_profile, 'errors': serializer.errors})


class SettingsPrivacyView(AsyncLoginRequiredMixin, View):
    async def get(self, request):
        user = await get_request_user(request)
        user_settings_privacy = await async_get_or_create_object(
            SettingsPrivacy,
            user=user,
            defaults={
                'disable_subscribers_view': False,
                'disable_subscriptions_view': False,
                'disable_profile_view': False
            }
        )

        return await render_sync(request, 'profile/settings_privacy.html', {
            'disable_subscribers_view': user_settings_privacy.disable_subscribers_view,
            'disable_subscriptions_view': user_settings_privacy.disable_subscriptions_view,
            'disable_profile_view': user_settings_privacy.disable_profile_view,
        })

    async def post(self, request):
        disable_subscribers_view = request.POST.get('disable_subscribers_view') == 'on'
        disable_subscriptions_view = request.POST.get('disable_subscriptions_view') == 'on'
        disable_profile_view = request.POST.get('disable_profile_view') == 'on'

        user = await get_request_user(request)
        user_settings_privacy = await async_get_or_create_object(
            SettingsPrivacy,
            user=user,
            defaults={
                'disable_subscribers_view': disable_subscribers_view,
                'disable_subscriptions_view': disable_subscriptions_view,
                'disable_profile_view': disable_profile_view
            }
        )
        user_settings_privacy.disable_subscribers_view = disable_subscribers_view
        user_settings_privacy.disable_subscriptions_view = disable_subscriptions_view
        user_settings_privacy.disable_profile_view = disable_profile_view
        await database_sync_to_async(user_settings_privacy.save)()

        return await render_sync(request, 'profile/settings_privacy.html', {
            'disable_subscribers_view': user_settings_privacy.disable_subscribers_view,
            'disable_subscriptions_view': user_settings_privacy.disable_subscriptions_view,
            'disable_profile_view': user_settings_privacy.disable_profile_view,
        })


class SettingsNotificationsView(AsyncLoginRequiredMixin, View):
    async def get(self, request):
        user = await get_request_user(request)
        user_settings_notifications = await async_get_or_create_object(
            SettingsNotifications,
            user=user,
            defaults={
                'disabling_news_notifications': False,
            }
        )

        return await render_sync(request, 'profile/settings_notifications.html', {
            'disabling_news_notifications': user_settings_notifications.disabling_news_notifications,
        })

    async def post(self, request):
        disabling_news_notifications = request.POST.get('disabling_news_notifications') == 'on'

        user = await get_request_user(request)
        user_settings_notifications = await async_get_or_create_object(
            SettingsNotifications,
            user=user,
            defaults={
                'disabling_news_notifications': disabling_news_notifications,
            }
        )
        user_settings_notifications.disabling_news_notifications = disabling_news_notifications
        await sync_to_async(user_settings_notifications.save)()

        return await render_sync(request, 'profile/settings_notifications.html', {
            'disabling_news_notifications': user_settings_notifications.disabling_news_notifications,
        })


class SubscribeView(AsyncLoginRequiredMixin, View):
    async def post(self, request, username):
        user_to_subscribe = await async_get_object_or_404(User, username=username)
        subscription = await async_get_object_or_404(Subscription, user=user_to_subscribe)

        subscribing_user = await get_request_user(request)

        already_subscribed = await subscription.subscriptions.filter(pk=subscribing_user.pk).aexists()
        if already_subscribed:
            return Response({'success': False, 'error': 'Вы уже подписаны на этого пользователя.'})

        await sync_to_async(subscription.subscribe)(subscribing_user)

        return JsonResponse({'success': True, 'current_user': subscribing_user.username})


class UnsubscribeView(AsyncLoginRequiredMixin, View):
    async def post(self, request, username):
        user_to_unsubscribe = await async_get_object_or_404(User, username=username)
        subscription = await async_get_object_or_404(Subscription, user=user_to_unsubscribe)

        unsubscribing_user = await get_request_user(request)

        is_subscribed = await subscription.subscriptions.filter(pk=unsubscribing_user.pk).aexists()
        if not is_subscribed:
            return Response({'success': False, 'error': 'Вы не подписаны на этого пользователя.'})

        await sync_to_async(subscription.unsubscribe)(unsubscribing_user)

        return JsonResponse({'success': True, 'current_user': unsubscribing_user.username})


class AsyncNotificationsView(AsyncLoginRequiredMixin, View):
    async def get(self, request, *args, **kwargs):
        user = await get_request_user(request)

        try:
            offset = int(request.GET.get('offset', 0))
        except ValueError:
            offset = 0
        try:
            limit = int(request.GET.get('limit', 10))
        except ValueError:
            limit = 10

        is_read_param = request.GET.get('is_read')
        level = request.GET.get('level')

        filters = Q(user=user)
        if is_read_param in ['true', 'false']:
            filters &= Q(is_read=(is_read_param == 'true'))
        if level in ['info', 'warning', 'error', 'critical']:
            filters &= Q(level=level)

        qs = Notification.objects.filter(filters).order_by('-created_at')[offset:offset+limit]
        notifications_list = []

        async for notif in qs:
            notifications_list.append({
                'id': notif.id,
                'message': notif.message,
                'is_read': notif.is_read,
                'level': notif.level,
                'created_at': notif.created_at.isoformat(),
            })

        return JsonResponse(notifications_list, safe=False)


class MarkReadNotificationView(AsyncLoginRequiredMixin, View):
    async def post(self, request, pk, *args, **kwargs):
        user = await get_request_user(request)

        try:
            notification = await Notification.objects.aget(pk=pk, user=user)
        except Notification.DoesNotExist:
            return JsonResponse({'status': 'error', 'error': 'not found'}, status=404)

        notification.is_read = True
        await database_sync_to_async(notification.save)()

        return JsonResponse({'status': 'ok'})


class UnreadCountView(AsyncLoginRequiredMixin, View):
    async def get(self, request, *args, **kwargs):
        user = await get_request_user(request)
        count = await Notification.objects.filter(user=user, is_read=False).acount()

        return JsonResponse({'count': count})
