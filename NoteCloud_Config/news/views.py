from django.shortcuts import render, redirect
from rest_framework.views import APIView
from rest_framework.response import Response

from django.views.generic import CreateView, UpdateView, ListView, DeleteView
from django.urls import reverse_lazy
from .models import News
from .forms import NewsForm

def custom_404(request, exception):
    return render(request, '404.html', status=404)

class NewsCreateView(CreateView):
    model = News
    form_class = NewsForm
    template_name = 'news/news_form.html'
    success_url = reverse_lazy('list_news')

    def form_valid(self, form):
        return super().form_valid(form)

class NewsUpdateView(UpdateView):
    model = News
    form_class = NewsForm
    template_name = 'news/news_form.html'
    success_url = reverse_lazy('list_news')

class NewsDeleteView(DeleteView):
    model = News
    template_name = 'news/news_confirm_delete.html'
    success_url = reverse_lazy('list_news') 

class NewsListView(ListView):
    model = News
    template_name = 'news/index.html'
    context_object_name = 'news'  # Устанавливаем имя для доступного контекста