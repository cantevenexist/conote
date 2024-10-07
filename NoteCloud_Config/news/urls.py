from django.urls import path
from .views import NewsListView, NewsCreateView, NewsUpdateView, NewsDeleteView

urlpatterns = [
    path('', NewsListView.as_view(), name='news_list'),
    path('create/', NewsCreateView.as_view(), name='news_create'),
    path('edit/<int:pk>/', NewsUpdateView.as_view(), name='news_edit'),
    path('delete/<int:pk>/', NewsDeleteView.as_view(), name='news_delete'),
]
