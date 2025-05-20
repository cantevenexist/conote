from django.dispatch import receiver
from django.db.models.signals import m2m_changed
from .models import Board
from django.contrib.auth import get_user_model

User = get_user_model()


@receiver(m2m_changed, sender=Board.access_users.through)
def remove_favorite_on_access_remove(sender, instance, action, pk_set, **kwargs):
    if action == 'pre_remove':
        users_removed = User.objects.filter(pk__in=pk_set)
        instance.favorites.remove(*users_removed)
