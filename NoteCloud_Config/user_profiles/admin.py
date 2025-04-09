from django.contrib import admin
from django.contrib.auth.models import User, Group
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.core.exceptions import PermissionDenied
from django.contrib import messages


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
