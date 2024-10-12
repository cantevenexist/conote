import os
from django.shortcuts import render, redirect, get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from django.http import HttpResponseRedirect, Http404, JsonResponse

from django.contrib.auth.mixins import LoginRequiredMixin
from django.views.generic import ListView, DetailView, CreateView, UpdateView, DeleteView
from django.urls import reverse_lazy
from .models import News, Comment
from .forms import NewsForm, CommentForm

def custom_404(request, exception):
    return render(request, '404.html', status=404)

class NewsListView(ListView):
    model = News
    template_name = 'news/index.html'
    context_object_name = 'news'

    def get_queryset(self):
        # Сортируем по дате создания (например, поле created_at) в порядке убывания
        return News.objects.order_by('-created_at')

class NewsDetailView(DetailView):
    model = News
    template_name = 'news/detail.html'
    context_object_name = 'news'

    def get_object(self):
        slug = self.kwargs.get('slug')
        return get_object_or_404(News, slug=slug)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['form'] = CommentForm()
        context['comments'] = self.object.comments.all().order_by('-created_at')  # Получаем все комментарии для текущей новости от новых к старым
        return context

    def post(self, request, *args, **kwargs):
        self.object = self.get_object()
        form = CommentForm(request.POST)

        if form.is_valid():
            comment = form.save(commit=False)
            comment.news = self.object
            comment.author = request.user  # Используем request.user для получения текущего пользователя
            comment.save()

        context = self.get_context_data(object=self.object, form=form)
        return self.render_to_response(context)

class NewsCreateView(LoginRequiredMixin, CreateView):
    model = News
    form_class = NewsForm
    template_name = 'news/news_form.html'
    success_url = reverse_lazy('news_list')

    def form_valid(self, form):
        # Устанавливаем автора новости на текущего авторизованного пользователя
        form.instance.author = self.request.user
        return super().form_valid(form)
        
class NewsUpdateView(LoginRequiredMixin, UpdateView):
    model = News
    form_class = NewsForm
    template_name = 'news/news_form.html'
    success_url = reverse_lazy('news_list')

    def get_object(self):
        slug = self.kwargs.get('slug')
        return get_object_or_404(News, slug=slug)

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
        return HttpResponseRedirect(self.success_url)