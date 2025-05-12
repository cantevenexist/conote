from django.urls import path, re_path
from . import views

urlpatterns = [
    path('', views.BoardsView.as_view(), name='boards_view'),
    path('<str:url_hash>/delete/', views.BoardsView.as_view(), name='delete_board'),
    path('<str:url_hash>/favorite/', views.BoardsView.as_view(), name='favorite_board'),
    path('<str:url_hash>/rename/', views.BoardsView.as_view(), name='rename_board'),
    path('trash/', views.TrashView.as_view(), name='trash_view'),
    path('trash/<str:url_hash>/delete/', views.TrashView.as_view(), name='trash_delete_board'),
    path('trash/delete_all/', views.TrashDeleteAllView.as_view(), name='trash_delete_boards_all'),
    path('trash/<str:url_hash>/restore/', views.TrashView.as_view(), name='trash_restore_board'),
    path('trash/restore_all/', views.TrashRestoreAllView.as_view(), name='trash_restore_boards_all'),
    path('<str:url_hash>/', views.BoardView.as_view(), name='board_view'),
    path('api/sub_and_users/', views.AsyncShareView.as_view(), name='api_sub_and_users'),
    path('api/invite/<str:url_hash>/', views.AsyncInviteView.as_view(), name='api_invite'),
    path('invite/accept/<uuid:token>/', views.InvitationAcceptView.as_view(), name='invite_accept'),
    path('invite/decline/<uuid:token>/', views.InvitationDeclineView.as_view(), name='invite_decline'),
]
