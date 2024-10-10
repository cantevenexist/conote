from django.urls import path
from . import views

urlpatterns = [
    path('', views.IndexView.as_view()),
    path('news/', views.NewsView.as_view(), name='news_by_page'),
    path('news/<int:news_id>/', views.ContentView.as_view()),
]
