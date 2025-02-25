from django.urls import path, include
from . import views
from allauth.account.views import LoginView, LogoutView, SignupView

urlpatterns = [
    path('profile/<str:username>/', views.ProfileView.as_view(), name='profile'),
    path('account/settings/', views.SettingsView.as_view(), name='settings'),
    path('account/settings/edit_profile/', views.ProfileEditView.as_view(), name='edit_profile'),
    path('account/settings/privacy/', views.SettingsPrivacyView.as_view(), name='settings_privacy'),
    path('account/settings/notifications/', views.SettingsNotificationsView.as_view(), name='settings_notifications'),
    path('account/settings/delete/', views.SettingsView.as_view(), name='delete_account'),
    path('profile/<str:username>/subscribe/', views.SubscribeView.as_view(), name='subscribe'),
    path('profile/<str:username>/unsubscribe/', views.UnsubscribeView.as_view(), name='unsubscribe'),
    path('account/login/', LoginView.as_view(), name='account_login'),
    path('account/logout/', LogoutView.as_view(), name='account_logout'),
    path('account/signup/', SignupView.as_view(), name='account_signup'),
]
