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
from django.db.models import Case, When, Value, IntegerField, Q, Exists, OuterRef
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
import hashlib
import uuid
from datetime import datetime
from django.http import HttpResponse, HttpResponseNotFound


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
        fav_exists = Exists(
            Board.favorites.through.objects.filter(
                board_id=OuterRef('pk'),
                user_id=user.pk
            )
        )

        boards_qs = (
            Board.objects
            .filter(Q(user=user) | Q(access_users=user))
            .annotate(
                is_fav=Case(
                    When(fav_exists, then=Value(0)),
                    default=Value(1),
                    output_field=IntegerField(),
                ),
                fav=fav_exists
            )
            .order_by('is_fav', '-updated_at')
            .values('name', 'url_hash', 'updated_at', 'user__username', 'fav')
        )
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
                     data-favorites="false"
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

        await database_sync_to_async(board.favorites.clear)()

        await Trash.objects.acreate(
            user=board.user,
            name=board.name,
            created_at=board.created_at,
            updated_at=board.updated_at,
            board_value=board.board_value,
            url_hash=board.url_hash,
        )
        await board.adelete()

        return JsonResponse({'status': 'success'})

    async def patch(self, request, url_hash):
        user = await get_request_user(request)

        board = await async_get_object_or_404(
            Board.objects.select_related('user').prefetch_related('access_users', 'favorites'),
            url_hash=url_hash,
        )

        if board.user != user:
            has_access = await board.access_users.filter(pk=user.pk).aexists()
            if not has_access:
                raise Http404('При добавлении доски в избранное возникла ошибка: "Нет доступа к доске"')

        if await board.favorites.filter(pk=user.pk).aexists():
            await database_sync_to_async(board.favorites.remove)(user)
            is_fav = False
        else:
            await database_sync_to_async(board.favorites.add)(user)
            is_fav = True

        return JsonResponse({'status': 'success', 'favorites': is_fav})

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
        boards_qs = (
            Trash.objects
            .filter(user=user)
            .order_by('-deleted_at', '-updated_at').values('name', 'url_hash', 'deleted_at', 'updated_at',)
        )
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
        board = await async_get_object_or_404(Board.objects.select_related('user').prefetch_related('access_users'),
                                              url_hash=url_hash
                                              )

        if user == board.user or await sync_to_async(board.access_users.filter(pk=user.pk).exists)():
            path = reverse('invite_users', kwargs={'url_hash': board.url_hash})
            invite_url = request.build_absolute_uri(path)

            context = {
                'board': board,
                'invite_url': invite_url,
            }

            return await render_sync(request, 'boards/board_test.html', context)
        else:
            raise Http404('При входе на доску возникла ошибка: "Нет доступа"')


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
            Invitation.objects.select_related('board__user', 'invited_user'),
            token=token
        )

        user = await get_request_user(request)
        if invitation.used:
            raise Http404('При принятии приглашения возникла ошибка: "Приглашение уже было использовано"')
        if user == invitation.invited_user:
            target = invitation.invited_user
        elif user == invitation.board.user:
            target = invitation.invited_user
        else:
            raise Http404('При принятии приглашения возникла ошибка: "Нет доступа к приглашению"')

        await database_sync_to_async(invitation.board.access_users.add)(target)
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
            Invitation.objects.select_related('board__user', 'invited_user', 'sender'),
            token=token
        )

        user = await get_request_user(request)
        if invitation.used:
            raise Http404('При отмене приглашения возникла ошибка: "Приглашение уже было использовано"')
        if user == invitation.invited_user:
            notify_to = invitation.board.user
            text = (
                f'❌ <b>{invitation.invited_user.username}</b> отклонил ваше приглашение '
                f'на доску "<i>{invitation.board.name}</i>".'
            )
        elif user == invitation.board.user:
            notify_to = invitation.invited_user
            text = (
                f'❌ Владелец доски "<i>{invitation.board.name}</i>" отклонил ваш запрос '
                f'на присоединение.'
            )
        else:
            raise Http404('При отмене приглашения возникла ошибка: "Нет доступа к приглашению"')

        await database_sync_to_async(invitation.mark_used)()

        notif = await Notification.objects.acreate(
            user=notify_to, message=text, level='info'
        )
        send_push_notification.delay([notif.id])

        try:
            notif_id = int(request.GET.get('notif_id'))
        except (ValueError, KeyError, json.JSONDecodeError):
            raise Http404('При отмене приглашения возникла ошибка: "Неправильный формат запроса"')
        if notif_id:
            await database_sync_to_async(_remove_buttons_for_notification)(notif_id)

        return JsonResponse({'status': 'ok'})


class AsyncInviteLinkView(AsyncLoginRequiredMixin, View):
    async def get(self, request, url_hash, *args, **kwargs):
        visitor = await get_request_user(request)

        board = await async_get_object_or_404(Board.objects.select_related('user').prefetch_related('access_users'),
                                              url_hash=url_hash
                                              )

        if visitor == board.user or await sync_to_async(board.access_users.filter(pk=visitor.pk).exists)():
            return redirect('board_view', url_hash=board.url_hash)

        cache_key = f'invite_link_cooldown:{visitor.id}:{board.id}'
        last = cache.get(cache_key)
        if last:
            retry_after = int(60 - (timezone.now() - last).total_seconds())
            return JsonResponse({
                'status': 'error',
                'message': f'Пожалуйста, подождите ещё {retry_after} сек. перед повторной отправкой'
            }, status=429)
        cache.set(cache_key, timezone.now(), 60)

        message = (
            f'🔗 Пользователь <b>{visitor.username}</b> хочет присоединиться к вашей доске '
            f'<i>"{board.name}"</i>.'
        )
        notif = await Notification.objects.acreate(
            user=board.user,
            message=message,
            level='warning',
        )

        invitation = await Invitation.objects.acreate(
            board=board,
            invited_user=visitor,
            sender=visitor
        )

        accept_url = request.build_absolute_uri(
            reverse('invite_accept', kwargs={'token': invitation.token})
            + f'?notif_id={notif.id}'
        )
        decline_url = request.build_absolute_uri(
            reverse('invite_decline', kwargs={'token': invitation.token})
            + f'?notif_id={notif.id}'
        )

        notif_html = (
            f'{message}<br>'
            f'<button class="notif-accept" data-url="{accept_url}">Принять</button> '
            f'<button class="notif-decline" data-url="{decline_url}">Отменить</button>'
        )
        notif.message = notif_html
        await sync_to_async(notif.save)(update_fields=['message'])

        send_push_notification.delay([notif.id])

        return redirect('/workspace')


class GenerateIdView(AsyncLoginRequiredMixin, View):
    async def post(self, request):
        try:
            data = json.loads(request.body)
            url_hash = data.get('url_hash')
            object_type = data.get('object_type')

            if not url_hash or not object_type:
                return JsonResponse({'error': 'url_hash and object_type are required'}, status=400)

            timestamp = datetime.now().isoformat()
            unique_id = str(uuid.uuid4())

            hash_input = f"{url_hash}{object_type}{timestamp}{unique_id}".encode('utf-8')
            generated_id = hashlib.sha256(hash_input).hexdigest()

            return JsonResponse({'id': generated_id})

        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON format'}, status=400)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)


class BoardDataView(View):
    def get(self, request, url_hash):
        try:
            board = Board.objects.get(url_hash=url_hash)
            if not board.board_value:
                return HttpResponseNotFound()

            # Check permissions
            user = request.user
            if user != board.user and user not in board.access_users.all():
                return HttpResponse(status=403)

            response = HttpResponse(board.board_value, content_type='application/json')
            response['Content-Disposition'] = f'attachment; filename="{url_hash}.json"'
            return response
        except Board.DoesNotExist:
            return HttpResponseNotFound()
