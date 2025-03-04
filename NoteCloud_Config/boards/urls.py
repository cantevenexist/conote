from django.urls import path, re_path
from . import views

urlpatterns = [
    path('', views.BoardsView.as_view(), name='boards_view'),
]
