from django.contrib import admin
from django.contrib.auth.models import User, Group
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.core.exceptions import PermissionDenied
from django.contrib import messages
from .models import Notification, EmailMessage, TelegramMessage
from .tasks import send_push_notification, send_push_notification_all, send_email_user, send_email_to_all_users, send_telegram_message_to_user, send_telegram_message_to_all_users


class RestrictedUserAdmin(BaseUserAdmin):
    def get_readonly_fields(self, request, obj=None):
        readonly_fields = list(super().get_readonly_fields(request, obj))

        if not request.user.is_superuser:
            readonly_fields.extend([
                'username', 'first_name', 'last_name', 'email',
                'is_superuser', 'is_active',
                'date_joined', 'last_login', 'user_permissions',
            ])
        return readonly_fields

    def save_model(self, request, obj, form, change):
        if change:
            try:
                admin_group = Group.objects.get(name='администраторы')
            except Group.DoesNotExist:
                admin_group = None

            if admin_group and 'администраторы' in [g.name for g in form.cleaned_data.get('groups', [])]:
                if not request.user.is_superuser:
                    messages.error(
                        request,
                        "У вас нет прав на добавление пользователя в группу администраторов."
                    )
                    raise PermissionDenied("Недостаточно прав для добавления в группу администраторов.")
        super().save_model(request, obj, form, change)


admin.site.unregister(User)
admin.site.register(User, RestrictedUserAdmin)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'message', 'level', 'is_read', 'created_at')
    list_filter = ('is_read', 'level', 'created_at')
    search_fields = ('message', 'user__username')

    actions = ['send_notification_to_user', 'send_notification_to_all']

    @admin.action(description="Отправить push-уведомление указанному пользователю")
    def send_notification_to_user(self, request, queryset):
        notif_ids = list(queryset.values_list('id', flat=True))
        send_push_notification.delay(notif_ids)
        self.message_user(request, "Push‑уведомления добавлены в очередь для отправки", messages.SUCCESS)

    @admin.action(description="Отправить push-уведомление всем пользователям")
    def send_notification_to_all(self, request, queryset):
        notif_ids = list(queryset.values_list('id', flat=True))
        send_push_notification_all.delay(notif_ids)
        self.message_user(request, "Push‑уведомления добавлены в очередь для отправки", messages.SUCCESS)


@admin.register(EmailMessage)
class EmailMessageAdmin(admin.ModelAdmin):
    list_display = ('user', 'subject', 'body', 'created_at')
    search_fields = ('message', 'user__username')

    actions = ['send_email_to_user', 'send_email_to_all_users']

    @admin.action(description="Отправить email-сообщение указанному пользователю")
    def send_email_to_user(self, request, queryset):
        message_ids = list(queryset.values_list('id', flat=True))
        send_email_user.delay(message_ids)
        self.message_user(request, "Email-сообщения добавлены в очередь для отправки", messages.SUCCESS)

    @admin.action(description="Отправить email-сообщение всем пользователям")
    def send_email_to_all_users(self, request, queryset):
        message_ids = list(queryset.values_list('id', flat=True))
        send_email_to_all_users.delay(message_ids)
        self.message_user(request, "Email-сообщения добавлены в очередь для отправки", messages.SUCCESS)


@admin.register(TelegramMessage)
class TelegramMessageAdmin(admin.ModelAdmin):
    list_display = ('user', 'text', 'created_at')
    actions = ['send_telegram_message_to_user', 'send_telegram_message_to_all_users']

    @admin.action(description="Отправить telegram-сообщение указанному пользователю")
    def send_telegram_message_to_user(self, request, queryset):
        message_ids = list(queryset.values_list('id', flat=True))
        send_telegram_message_to_user.delay(message_ids)
        self.message_user(request, "Telegram-сообщения добавлены в очередь для отправки", messages.SUCCESS)

    @admin.action(description="Отправить telegram-сообщение всем пользователям")
    def send_telegram_message_to_all_users(self, request, queryset):
        message_ids = list(queryset.values_list('id', flat=True))
        send_telegram_message_to_all_users.delay(message_ids)
        self.message_user(request, "Telegram-сообщения добавлены в очередь для отправки", messages.SUCCESS)
