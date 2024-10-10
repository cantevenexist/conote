from django.urls import path
from .views import NewsListView, NewsDetailView, NewsCreateView, NewsUpdateView, NewsDeleteView

urlpatterns = [
    path('', NewsListView.as_view(), name='news_list'),
    path('view/<slug:slug>/', NewsDetailView.as_view(), name='news_detail'),
    path('create/', NewsCreateView.as_view(), name='news_create'),
    path('edit/<slug:slug>/', NewsUpdateView.as_view(), name='news_edit'),
    path('delete/<slug:slug>/', NewsDeleteView.as_view(), name='news_delete'),
]
