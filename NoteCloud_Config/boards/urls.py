from django.urls import path, re_path
from . import views

urlpatterns = [
    path('', views.BoardsView.as_view(), name='boards_view'),
    path('<str:url_hash>/delete/', views.BoardsView.as_view(), name='delete_board'),
    path('trash/', views.TrashView.as_view(), name='trash_view'),
    path('trash/<str:url_hash>/delete/', views.TrashView.as_view(), name='trash_delete_board'),
]
