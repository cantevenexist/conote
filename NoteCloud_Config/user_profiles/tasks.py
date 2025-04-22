from celery import shared_task
from django.core.mail import get_connection
from django.conf import settings
from django.contrib.auth import get_user_model
from .models import Notification
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import json


@shared_task()
def async_send_messages_with_smtp(email_messages):
    conn = get_connection(backend=settings.EMAIL_BACKEND)

    if not email_messages:
        return 0

    with conn._lock:
        new_conn_created = conn.open()
        if not conn.connection or new_conn_created is None:
            return 0

        num_sent = 0
        for message in email_messages:
            sent = conn._send(message)
            if sent:
                num_sent += 1

        if new_conn_created:
            conn.close()

    return num_sent


@shared_task
def send_push_notification(notification_ids):
    """
    Отправляет push-уведомления для списка уведомлений.
    """
    channel_layer = get_channel_layer()
    notifications = Notification.objects.filter(id__in=notification_ids)
    for notif in notifications:
        group_name = f"user_{notif.user.id}"
        async_to_sync(channel_layer.group_send)(
            group_name,
            {
                "type": "notification.push",
                "message": json.dumps({
                    "id": notif.id,
                    "message": notif.message,
                    "is_read": notif.is_read,
                    "level": notif.level,
                    "created_at": notif.created_at.isoformat(),
                })
            }
        )


@shared_task
def send_push_notification_all():
    """
    Отправляет push-уведомление всем пользователям,
    для каждого пользователя выбирается последнее созданное уведомление.
    """
    channel_layer = get_channel_layer()
    User = get_user_model()
    users = User.objects.all()
    for user in users:
        notif = user.notifications.first()  # выбираем самое свежее уведомление
        if notif:
            group_name = f"user_{user.id}"
            async_to_sync(channel_layer.group_send)(
                group_name,
                {
                    "type": "notification.push",
                    "message": json.dumps({
                        "id": notif.id,
                        "message": notif.message,
                        "is_read": notif.is_read,
                        "level": notif.level,
                        "created_at": notif.created_at.isoformat(),
                    })
                }
            )
