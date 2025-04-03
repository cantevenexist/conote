from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth.models import User
from .models import Board, Trash
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
from django.http import JsonResponse
from django.template.loader import render_to_string
from django.db import transaction
import json


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

        context = {
        }

        return await render_sync(request, 'boards/board.html', context)


# class BoardView(APIView):
#     async def get(self, request, username, board_name):
#         user = await async_get_object_or_404(User, username=username)
#         board = await async_get_object_or_404(Board, user=user, name=board_name)
#
#         access_users_count = await board.access_users.acount()
#         sync_mode = 'direct' if access_users_count == 0 else 'shared'
#
#         return Response({
#             'board_id': board.id,
#             'board_value': board.board_value,
#             'sync_mode': sync_mode
#         })
#
#     async def post(self, request, username, board_name):
#         user = await async_get_object_or_404(User, username=username)
#         board = await async_get_object_or_404(Board, user=user, name=board_name)
#
#         board_state = request.data.get('board_value')
#         board.board_value = board_state
#         # Асинхронное сохранение состояния доски (Django 5 поддерживает asave)
#         await board.asave()
#
#         return Response({'status': 'Доска успешно обновлена'})
