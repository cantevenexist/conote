import os
from django.shortcuts import render, redirect
from rest_framework.views import APIView
from rest_framework.response import Response
from django.http import HttpResponseRedirect, Http404

from django.views.generic import ListView, CreateView, UpdateView, DeleteView
from django.urls import reverse_lazy
from .models import News
from .forms import NewsForm

def custom_404(request, exception):
    return render(request, '404.html', status=404)

class NewsListView(ListView):
    model = News
    template_name = 'news/index.html'
    context_object_name = 'news'

class NewsCreateView(CreateView):
    model = News
    form_class = NewsForm
    template_name = 'news/news_form.html'
    success_url = reverse_lazy('news_list')

class NewsUpdateView(UpdateView):
    model = News
    form_class = NewsForm
    template_name = 'news/news_form.html'
    success_url = reverse_lazy('news_list')

class NewsDeleteView(DeleteView):
    model = News
    template_name = 'news/news_confirm_delete.html'
    success_url = reverse_lazy('news_list')
    
    def post(self, request, *args, **kwargs):
        # Обрабатываем запрос на удаление
        self.object = self.get_object()
        image_path = self.object.image.path if self.object.image else None
        self.object.delete()  # Удаляем новость
        # Удаляем изображение, если оно существует
        if image_path and os.path.isfile(image_path):
            os.remove(image_path)
        return HttpResponseRedirect(self.success_url)