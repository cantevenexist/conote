from django.urls import path, re_path
from . import views
from . import api_views

urlpatterns = [
    path('', views.BoardsView.as_view(), name='boards_view'),
    path('trash/', views.TrashView.as_view(), name='trash_view'),
    path('trash/<str:url_hash>/delete/', views.TrashView.as_view(), name='trash_delete_board'),
    path('trash/delete_all/', views.TrashDeleteAllView.as_view(), name='trash_delete_boards_all'),
    path('trash/<str:url_hash>/restore/', views.TrashView.as_view(), name='trash_restore_board'),
    path('trash/restore_all/', views.TrashRestoreAllView.as_view(), name='trash_restore_boards_all'),
    path('api/sub_and_users/', views.AsyncShareView.as_view(), name='api_sub_and_users'),
    path('api/invite/<str:url_hash>/', views.AsyncInviteView.as_view(), name='api_invite'),
    path('invite/accept/<uuid:token>/', views.InvitationAcceptView.as_view(), name='invite_accept'),
    path('invite/decline/<uuid:token>/', views.InvitationDeclineView.as_view(), name='invite_decline'),
    path('invite_users/<str:url_hash>/', views.AsyncInviteLinkView.as_view(), name='invite_users'),
    path('board_data/<str:url_hash>/', views.BoardDataView.as_view(), name='board_data'),
    path('generate_id/', views.GenerateIdView.as_view(), name='generate_id'),
    path('<str:url_hash>/', views.BoardView.as_view(), name='board_view'),
    path('<str:url_hash>/delete/', views.BoardsView.as_view(), name='delete_board'),
    path('<str:url_hash>/favorite/', views.BoardsView.as_view(), name='favorite_board'),
    path('<str:url_hash>/rename/', views.BoardsView.as_view(), name='rename_board'),
    
    # API для расширения
    path('api/extension/auth/', api_views.ExtensionAuthView.as_view(), name='extension_auth'),
    path('api/extension/logout/', api_views.ExtensionLogoutView.as_view(), name='extension_logout'),
    path('api/extension/user/', api_views.ExtensionUserStatusView.as_view(), name='extension_user'),
    path('api/extension/workspaces/<str:workspace_hash>/raw/', api_views.ExtensionRawWorkspaceDataView.as_view(), name='extension_raw_workspace_data'),
    
    # Рабочие пространства (Workspaces) - ОБЯЗАТЕЛЬНО ДОБАВИТЬ
    path('api/extension/workspaces/', api_views.ExtensionWorkspacesView.as_view(), name='extension_workspaces'),
    path('api/extension/workspaces/<int:workspace_id>/', api_views.ExtensionWorkspacesView.as_view(), name='extension_workspace_detail'),
    
    # Канбан-доски внутри рабочего пространства
    path('api/extension/workspaces/<str:workspace_hash>/boards/', api_views.ExtensionKanbanBoardsView.as_view(), name='extension_kanban_boards'),
    path('api/extension/workspaces/<str:workspace_hash>/boards/<str:board_id>/', api_views.ExtensionKanbanBoardsView.as_view(), name='extension_kanban_board_detail'),
    
    # Вспомогательные
    path('api/extension/generate_id/', api_views.ExtensionGenerateIdView.as_view(), name='extension_generate_id'),
]