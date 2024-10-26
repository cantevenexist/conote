from django.urls import path, include
from . import views
from allauth.account.views import EmailView, PasswordChangeView

urlpatterns = [
    # path('profile/<str:username>/', views.ProfileView.as_view(), name='profile'),
    path('settings/', views.SettingsView.as_view(), name='settings'),
    path('settings/edit_profile/', views.ProfileEditView.as_view(), name='edit_profile'),
    path('settings/security/', PasswordChangeView.as_view(), name='security'),
    path('settings/notifications/', views.SettingsNotificationsView.as_view(), name='settings_notifications'),
    path('settings/emails/', EmailView.as_view(), name='emails'),
    # path('settings/delete/', views.SettingsView.as_view(), name='delete_account'),
]
