from django.urls import path
from .views import NewsCreateView, NewsUpdateView, NewsListView, NewsDeleteView

urlpatterns = [
    path('', NewsListView.as_view(), name='list_news'),
    path('create/', NewsCreateView.as_view(), name='create_news'),
    path('edit/<int:pk>/', NewsUpdateView.as_view(), name='edit_news'),
    path('delete/<int:pk>/', NewsDeleteView.as_view(), name='delete_news'),
]
