from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth.models import User
from .models import Board, Trash, Invitation
from django.http import Http404
from django.shortcuts import render, redirect, get_object_or_404
from django.utils.decorators import method_decorator
from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from asgiref.sync import sync_to_async
from django.views import View
from django.contrib.auth.views import redirect_to_login
from django.contrib.auth.mixins import AccessMixin
from django.urls import reverse_lazy
from django.db.models import Case, When, Value, IntegerField, Q
from django.http import JsonResponse, HttpResponseBadRequest
from django.template.loader import render_to_string
from django.db import transaction
import json
from user_profiles.models import Subscription, UserProfile, Notification
from user_profiles.tasks import send_push_notification
from django.core.cache import cache
from django.utils import timezone
from channels.db import database_sync_to_async
from django.urls import reverse
from django.db import models
import re


@sync_to_async
def render_sync(request, template, context):
    return render(request, template, context)


@sync_to_async
def render_to_string_sync(template, context, request=None):
    return render_to_string(template, context, request=request)


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
    queryset = model_or_queryset if hasattr(model_or_queryset, 'filter') else model_or_queryset._default_manager.filter()
    queryset = queryset.filter(*args, **kwargs)

    try:
        obj = await queryset.aget()

    except queryset.model.DoesNotExist:
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
    queryset = model_or_queryset if hasattr(model_or_queryset, 'filter') else model_or_queryset._default_manager.filter()
    queryset = queryset.filter(*args, **kwargs)

    try:
        obj = await queryset.aget()
        return obj

    except queryset.model.DoesNotExist:
        create_data = {}
        if defaults:
            create_data.update(defaults)
        create_data.update(kwargs)

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


class BoardsView(AsyncLoginRequiredMixin, View):
    async def get(self, request):
        user = await get_request_user(request)
        boards_qs = Board.objects.filter(Q(user=user) | Q(access_users=user)).annotate(
            fav_order=Case(
                When(favorites=True, then=Value(0)),
                default=Value(1),
                output_field=IntegerField()
            )
        ).order_by('fav_order', '-updated_at').values('name', 'url_hash', 'updated_at', 'user__username', 'favorites')
        boards = [board async for board in boards_qs]

        context = {
            'boards': boards,
        }
        return await render_sync(request, 'boards/boards.html', context)

    async def post(self, request):
        user = await get_request_user(request)
        board = await Board.objects.acreate(user=user)

        updated_at_str = board.updated_at.strftime('%Y-%m-%dT%H:%M:%S')
        hidden_updated_at_str = board.updated_at.strftime('%Y-%m-%d %H:%M:%S')

        html = f'''
                <div class="board_item"
                     data-favorites="{board.favorites}"
                     data-updated="{hidden_updated_at_str}">
                    <a href="/workspace/{board.url_hash}/" class="board_link"></a>
                    <button class="popup-btn">☰</button>
                    <div class="popup">
                        <button class="favorite-btn" data-url_hash="{board.url_hash}">Добавить в избранное</button>
                        <button class="delete-btn" data-url_hash="{board.url_hash}">Удалить</button>
                    </div>
                    <div class="board_{board.name}">
                        <input type="text" class="board-name-input" data-url_hash="{board.url_hash}" value="{board.name}" data-original="{board.name}">
                        <h3>Владелец: {board.user.username}</h3>
                        <p class="date time" data-time="{updated_at_str}"></p>
                    </div>
                </div>
                '''
        return JsonResponse({'html': html})

    async def delete(self, request, url_hash):
        user = await get_request_user(request)

        board = await async_get_object_or_404(Board.objects.select_related('user'), url_hash=url_hash, user=user)

        await Trash.objects.acreate(
            user=board.user,
            name=board.name,
            created_at=board.created_at,
            updated_at=board.updated_at,
            board_value=board.board_value,
            url_hash=board.url_hash,
            favorites=board.favorites,
        )
        await board.adelete()

        return JsonResponse({'status': 'success'})

    async def patch(self, request, url_hash):
        user = await get_request_user(request)

        board = await async_get_object_or_404(Board.objects.select_related('user'), url_hash=url_hash, user=user)

        board.favorites = not board.favorites
        await board.asave()

        return JsonResponse({'status': 'success', 'favorites': board.favorites})

    async def put(self, request, url_hash):
        user = await get_request_user(request)

        board = await async_get_object_or_404(Board.objects.select_related('user'), url_hash=url_hash, user=user)

        data = json.loads(request.body)
        new_name = data.get('name')
        if new_name:
            board.name = new_name
            await board.asave()
            return JsonResponse({'status': 'success', 'name': board.name})
        return JsonResponse({'status': 'error', 'message': 'Имя не передано'}, status=400)


class TrashView(AsyncLoginRequiredMixin, View):
    async def get(self, request):
        user = await get_request_user(request)
        boards_qs = Trash.objects.filter(user=user).annotate(
            fav_order=Case(
                When(favorites=True, then=Value(0)),
                default=Value(1),
                output_field=IntegerField()
            )
        ).order_by('fav_order', '-updated_at').values('name', 'url_hash', 'updated_at', 'user__username', 'deleted_at', 'favorites')
        boards = [board async for board in boards_qs]

        context = {
            'boards': boards,
        }
        return await render_sync(request, 'boards/trash.html', context)

    async def delete(self, request, url_hash):
        user = await get_request_user(request)

        board = await async_get_object_or_404(Trash.objects.select_related('user'), url_hash=url_hash, user=user)

        await board.adelete()

        return JsonResponse({'status': 'success'})

    async def post(self, request, url_hash):
        user = await get_request_user(request)

        board = await async_get_object_or_404(Trash.objects.select_related('user'), url_hash=url_hash, user=user)

        await Board.objects.acreate(
            user=board.user,
            name=board.name,
            created_at=board.created_at,
            updated_at=board.updated_at,
            board_value=board.board_value,
            url_hash=board.url_hash,
            favorites=board.favorites,
        )
        await board.adelete()

        return JsonResponse({'status': 'success'})


class TrashDeleteAllView(AsyncLoginRequiredMixin, View):
    async def delete(self, request):
        user = await get_request_user(request)
        await Trash.objects.filter(user=user).adelete()

        return JsonResponse({'status': 'success'})


class TrashRestoreAllView(AsyncLoginRequiredMixin, View):
    async def post(self, request):
        user = await get_request_user(request)

        async for trash_item in Trash.objects.filter(user=user).select_related('user'):
            await Board.objects.acreate(
                user=trash_item.user,
                name=trash_item.name,
                created_at=trash_item.created_at,
                updated_at=trash_item.updated_at,
                board_value=trash_item.board_value,
                url_hash=trash_item.url_hash,
                favorites=trash_item.favorites,
            )
            await trash_item.adelete()

        return JsonResponse({'status': 'success'})


class BoardView(AsyncLoginRequiredMixin, View):
    async def get(self, request, url_hash):
        user = await get_request_user(request)
        board = await async_get_object_or_404(Board, user=user, url_hash=url_hash)

        context = {
            'board': board,
        }

        return await render_sync(request, 'boards/board_test.html', context)


class AsyncShareView(AsyncLoginRequiredMixin, View):
    async def get(self, request):
        user = await get_request_user(request)

        try:
            offset = int(request.GET.get('offset', 0))
        except ValueError:
            offset = 0
        try:
            limit = int(request.GET.get('limit', 10))
        except ValueError:
            limit = 10

        list_type = request.GET.get('type')
        search = request.GET.get('search', '').strip()

        if search:
            base_qs = User.objects.filter(username__icontains=search).exclude(pk=user.pk)
        else:
            sub_obj = await async_get_or_create_object(Subscription, user=user)
            if list_type == 'subscriptions':
                base_qs = sub_obj.subscriptions.all()
            else:
                base_qs = sub_obj.subscribers.all()

        qs = base_qs.order_by('username')[offset:offset+limit]

        result = []
        async for user_i in qs.aiterator():
            profile = await async_get_or_create_object(UserProfile, user=user_i)
            avatar = profile.avatar.url if profile and profile.avatar else None
            result.append({
                'id': user_i.id,
                'username': user_i.username,
                'avatar': avatar,
            })

        has_more = await base_qs.order_by('username')[offset + limit:offset + limit + 1].aexists()

        return JsonResponse({'results': result, 'has_more': has_more, }, safe=False)


class AsyncInviteView(AsyncLoginRequiredMixin, View):
    async def post(self, request, url_hash, *args, **kwargs):
        sender = await get_request_user(request)
        board = await async_get_object_or_404(Board, user=sender, url_hash=url_hash)

        try:
            data = json.loads(request.body)
            to_user_id = int(data['user_id'])
            to_username = data['user'].strip()
        except (ValueError, KeyError, json.JSONDecodeError):
            raise Http404('При приглашении другого пользователя возникла ошибка: "Неправильный формат запроса"')

        to_user = await async_get_object_or_404(User, pk=to_user_id, username=to_username)

        cache_key = f'invite_cooldown:{sender.id}:{to_user.id}:{board.id}'
        last = cache.get(cache_key)
        if last:
            retry_after = int(60 - (timezone.now() - last).total_seconds())
            return JsonResponse({
                'status': 'error',
                'retry_after': retry_after,
                'message': f'Подождите еще {retry_after} сек. перед повторным приглашением'
            })

        cache.set(cache_key, timezone.now(), 60)

        message = (
            f'📝 Пользователь <b>{sender.username}</b> приглашает вас присоединиться к доске '
            f'<i>"{board.name}"</i>.'
        )
        notif = await Notification.objects.acreate(
            user=to_user,
            message=message,
            level='warning',
        )

        invitation = await Invitation.objects.acreate(board=board, invited_user=to_user, sender=sender)
        accept_url = request.build_absolute_uri(
            reverse('invite_accept', kwargs={'token': invitation.token}) + f'?notif_id={notif.id}'
        )
        decline_url = request.build_absolute_uri(
            reverse('invite_decline', kwargs={'token': invitation.token}) + f'?notif_id={notif.id}'
        )
        notif_html = (
            f'{message}<br>'
            f'<button class="notif-accept" data-url="{accept_url}">Принять</button> '
            f'<button class="notif-decline" data-url="{decline_url}">Отменить</button>'
        )
        notif.message = notif_html
        await database_sync_to_async(notif.save)(update_fields=['message'])

        send_push_notification.delay([notif.id])

        return JsonResponse({
            'status': 'ok',
            'notification_id': notif.id,
            'message': 'Приглашение отправлено',
            'cooldown': 60
        })


def _remove_buttons_for_notification(notif_id):
    try:
        notif = Notification.objects.get(pk=notif_id)
    except Notification.DoesNotExist:
        return
    clean_msg = re.sub(r'<button[^>]*>.*?</button>', '', notif.message, flags=re.S)
    notif.message = clean_msg
    notif.save(update_fields=['message'])


class InvitationAcceptView(AsyncLoginRequiredMixin, View):
    async def get(self, request, token):
        invitation = await async_get_object_or_404(
            Invitation.objects.select_related('board', 'invited_user'),
            token=token
        )

        user = await get_request_user(request)
        if invitation.used or user != invitation.invited_user:
            raise Http404()

        await database_sync_to_async(invitation.board.access_users.add)(user)
        await database_sync_to_async(invitation.mark_used)()

        try:
            notif_id = int(request.GET.get('notif_id'))
        except (ValueError, KeyError, json.JSONDecodeError):
            raise Http404('При принятии приглашения возникла ошибка: "Неправильный формат запроса"')
        if notif_id:
            await database_sync_to_async(_remove_buttons_for_notification)(notif_id)

        return redirect('board_view', url_hash=invitation.board.url_hash)


class InvitationDeclineView(AsyncLoginRequiredMixin, View):
    async def post(self, request, token):
        invitation = await async_get_object_or_404(
            Invitation.objects.select_related('board', 'invited_user', 'sender'),
            token=token
        )

        user = await get_request_user(request)
        if invitation.used or user != invitation.invited_user:
            raise Http404()

        await database_sync_to_async(invitation.mark_used)()

        text = (
            f'❌ <b>{user.username}</b> отклонил приглашение на доску '
            f'"{invitation.board.name}".'
        )
        notif = await Notification.objects.acreate(
            user=invitation.sender, message=text, level='info'
        )
        send_push_notification.delay([notif.id])

        try:
            notif_id = int(request.GET.get('notif_id'))
        except (ValueError, KeyError, json.JSONDecodeError):
            raise Http404('При отмене приглашения возникла ошибка: "Неправильный формат запроса"')
        if notif_id:
            await database_sync_to_async(_remove_buttons_for_notification)(notif_id)

        return JsonResponse({'status': 'ok'})
