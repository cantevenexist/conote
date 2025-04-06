import os
import random
from django.shortcuts import render, redirect, get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from django.http import HttpResponseRedirect, Http404, JsonResponse, HttpResponse
from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from django.urls import reverse_lazy
from .models import News, Comment
from .forms import NewsForm, CommentForm
from django.db.models import Count
from asgiref.sync import sync_to_async
from django.contrib.auth.mixins import AccessMixin
from django.contrib.auth.views import redirect_to_login
from django.views import View
from channels.db import database_sync_to_async


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


class NewsListView(View):
    async def get(self, request):
        news_list = await sync_to_async(lambda: list(News.objects.annotate(comment_count=Count('comments')).order_by('-created_at')))()
        context = {'news': news_list}

        return await render_sync(request, 'news/index.html', context)


class NewsDetailView(View):
    async def get(self, request, slug):
        news_item = await async_get_object_or_404(News, slug=slug)
        comments = await sync_to_async(lambda: list(news_item.comments.all().order_by('-created_at')))()
        form = CommentForm()

        no_comments_messages = [
            "Пока тишина, не стесняйтесь быть первым!",
            "Ожидаем ваших мыслей — оставьте первый комментарий!",
            "Комментов нет, но ваш может стать первым!",
            "Комментов не наблюдается. Может, ваш будет первооткрывателем!",
            "Пока пусто — напишите, что думаете!",
            "Никто не написал... Возможно, вы станете первым!",
            "Здесь пока нет обсуждения, добавьте свой комментарий!",
            "Пока что пусто, но ваша мысль может всё изменить!",
            "Здесь ещё нет комментариев — начинайте разговор!",
            "Все молчат… Может, это ваш шанс высказаться?"
        ]
        random_message = random.choice(no_comments_messages)

        context = {'news': news_item, 'form': form, 'comments': comments, 'random_message': random_message}
        
        return await render_sync(request, 'news/detail.html', context)

    async def post(self, request, slug):
        user = await get_request_user(request)
        news_obj = await async_get_object_or_404(News, slug=slug)

        if request.POST.get('comment_id'):
            return await self.delete_comment(request, news_obj)

        form = CommentForm(request.POST)
        if form.is_valid():
            comment = form.save(commit=False)
            comment.news = news_obj
            comment.author = user
            await database_sync_to_async(comment.save)()

            comments = await sync_to_async(lambda: list(news_obj.comments.select_related("author").all().order_by('-created_at')))()
            return JsonResponse({
                'success': True,
                'comments': [
                    {
                        'id': comment.id,
                        'content': comment.content,
                        'author': comment.author.username,
                        'created_at': comment.created_at.strftime('%d.%m.%Y, %H:%M'),
                    }
                    for comment in comments
                ],
            })

        return JsonResponse({'success': False, 'errors': form.errors}, status=400)

    async def delete_comment(self, request, news_obj):
        user = await get_request_user(request)
        comment_id = request.POST.get('comment_id')

        try:
            comment = await news_obj.comments.select_related("author").aget(id=comment_id)
            if comment.author != user:

                return JsonResponse({
                    'success': False,
                    'error': 'У вас нет прав для удаления этого комментария'
                }, status=403)

            await comment.adelete()

            return JsonResponse({'success': True})

        except Comment.DoesNotExist:

            return JsonResponse({'success': False, 'error': 'Комментарий не найден'}, status=404)


class NewsCreateView(AsyncLoginRequiredMixin, View):
    async def get(self, request):
        form = NewsForm()
        context = {'form': form}

        return await render_sync(request, 'news/news_form.html', context)

    async def post(self, request):
        user = await get_request_user(request)

        data = getattr(request, 'data', None)
        if data is None:
            data = request.POST.copy()
            data.update(request.FILES)

        form = NewsForm(data, request.FILES)
        if form.is_valid():
            news_obj = form.save(commit=False)
            news_obj.author = user
            await database_sync_to_async(news_obj.save)()

            return HttpResponseRedirect(reverse_lazy('news_list'))
        else:
            context = {'form': form}

            return await render_sync(request, 'news/news_form.html', context)


class NewsUpdateView(AsyncLoginRequiredMixin, View):
    async def get(self, request, slug):
        news_obj = await async_get_object_or_404(News, slug=slug)
        form = NewsForm(instance=news_obj)
        context = {'form': form, 'news': news_obj}

        return await render_sync(request, 'news/news_form.html', context)

    async def post(self, request, slug):
        news_obj = await async_get_object_or_404(News, slug=slug)

        data = getattr(request, 'data', None)
        if data is None:
            data = request.POST.copy()
            data.update(request.FILES)

        form = NewsForm(data, request.FILES, instance=news_obj)

        if form.is_valid():
            news_obj = form.save(commit=False)
            await database_sync_to_async(news_obj.save)()

            return HttpResponseRedirect(reverse_lazy('news_list'))
        else:
            context = {'form': form, 'news': news_obj}

            return await render_sync(request, 'news/news_form.html', context)


class NewsDeleteView(AsyncLoginRequiredMixin, View):
    async def get(self, request, slug):
        news_obj = await async_get_object_or_404(News, slug=slug)
        context = {'news': news_obj}

        return await render_sync(request, 'news/news_confirm_delete.html', context)

    async def post(self, request, slug):
        news_obj = await async_get_object_or_404(News, slug=slug)
        if news_obj.image:
            await database_sync_to_async(news_obj.image.delete)(save=False)

        await database_sync_to_async(news_obj.delete)()

        return HttpResponseRedirect(reverse_lazy('news_list'))
