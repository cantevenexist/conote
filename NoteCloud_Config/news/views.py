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


class NewsListView(ListView):
    model = News
    template_name = 'news/index.html'  # Полный шаблон
    context_object_name = 'news'

    def get_queryset(self):
        return News.objects.order_by('-created_at')

    def render_to_response(self, context, **response_kwargs):
        if self.request.headers.get('HX-Request'):
            # Возвращаем только контент для HTMX
            return render(self.request, 'news/partials/index.html', context)
        # Возвращаем полную страницу
        return super().render_to_response(context, **response_kwargs)


class NewsDetailView(DetailView):
    model = News
    template_name = 'news/detail.html'  # Полный шаблон
    context_object_name = 'news'

    def get_object(self):
        slug = self.kwargs.get('slug')
        return get_object_or_404(News, slug=slug)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['form'] = CommentForm()
        context['comments'] = self.object.comments.all().order_by('-created_at')  # Получаем все комментарии для текущей новости от новых к старым
        
        # Список сообщений для случая, если комментариев нет
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
        
        # Если комментариев нет, выбираем случайное сообщение
        if not context['comments']:
            context['random_message'] = random.choice(no_comments_messages)

        return context

    def post(self, request, *args, **kwargs):
        self.object = self.get_object()
        if request.POST.get('comment_id'):  # Проверяем, был ли отправлен ID комментария для удаления
            return self.delete_comment(request)
        
        form = CommentForm(request.POST)

        if form.is_valid():
            comment = form.save(commit=False)
            comment.news = self.object
            comment.author = request.user  # Используем request.user для получения текущего пользователя
            comment.save()

            # Возвращаем JSON-ответ
            comments = self.object.comments.all().order_by('-created_at')  # Обновляем список комментариев
            return JsonResponse({
                'success': True,
                'comments': [
                    {
                        'id': comment.id,  # Добавляем ID комментария для удаления
                        'content': comment.content,
                        'author': comment.author.username,
                        'created_at': comment.created_at.strftime('%d.%m.%Y, %H:%M'),
                    }
                    for comment in comments
                ],
            })

        return JsonResponse({'success': False, 'errors': form.errors}, status=400)

    def delete_comment(self, request):
        comment_id = request.POST.get('comment_id')
        try:
            comment = self.object.comments.get(id=comment_id)
            comment.delete()
            return JsonResponse({'success': True})
        except Comment.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Комментарий не найден'}, status=404)

    def render_to_response(self, context, **response_kwargs):
        if self.request.headers.get('HX-Request'):
            # Возвращаем только контент для HTMX
            return render(self.request, 'news/partials/detail.html', context)
        # Возвращаем полную страницу
        return super().render_to_response(context, **response_kwargs)


class NewsCreateView(LoginRequiredMixin, CreateView):
    model = News
    form_class = NewsForm
    template_name = 'news/news_form.html'
    success_url = reverse_lazy('news_list')

    def form_valid(self, form):
        # Устанавливаем автора новости на текущего авторизованного пользователя
        form.instance.author = self.request.user
        response = super().form_valid(form)

        # Проверяем, был ли запрос сделан через htmx
        if self.request.headers.get('HX-Request'):
            # Возвращаем только контент для HTMX (например, обновленный список новостей)
            return render(self.request, 'news/partials/news_list.html', {'news_list': News.objects.all()})
        
        # Возвращаем полную страницу
        return response

    def render_to_response(self, context, **response_kwargs):
        if self.request.headers.get('HX-Request'):
            # Возвращаем только контент для HTMX
            return render(self.request, 'news/partials/news_form.html', context)
        # Возвращаем полную страницу
        return super().render_to_response(context, **response_kwargs)



class NewsUpdateView(LoginRequiredMixin, UpdateView):
    model = News
    form_class = NewsForm
    template_name = 'news/news_form.html'
    success_url = reverse_lazy('news_list')

    def get_object(self):
        slug = self.kwargs.get('slug')
        return get_object_or_404(News, slug=slug)

    def render_to_response(self, context, **response_kwargs):
        if self.request.headers.get('HX-Request'):
            # Возвращаем только контент для HTMX
            return render(self.request, 'news/partials/news_form.html', context)
        # Возвращаем полную страницу
        return super().render_to_response(context, **response_kwargs)


class NewsDeleteView(LoginRequiredMixin, DeleteView):
    model = News
    template_name = 'news/news_confirm_delete.html'
    success_url = reverse_lazy('news_list')

    def get_object(self):
        slug = self.kwargs.get('slug')
        return get_object_or_404(News, slug=slug)

    def post(self, request, *args, **kwargs):
        self.object = self.get_object()
        image_path = self.object.image.path if self.object.image else None
        self.object.delete()  # Удаляем новость
        # Удаляем изображение, если оно существует
        if image_path and os.path.isfile(image_path):
            os.remove(image_path)
        if request.headers.get('HX-Request'):
            # Возвращаем ответ для HTMX
            return HttpResponse('Success', status=204)  # 204 No Content
        return HttpResponseRedirect(self.success_url)

    def render_to_response(self, context, **response_kwargs):
        if self.request.headers.get('HX-Request'):
            # Возвращаем только контент для HTMX
            return render(self.request, 'news/partials/news_confirm_delete.html', context)
        # Возвращаем полную страницу
        return super().render_to_response(context, **response_kwargs)