from celery import shared_task
from django.core.mail import get_connection
from django.conf import settings
from django.contrib.auth import get_user_model
from .models import Notification
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import json
import asyncio
from django.utils.timezone import now
from asgiref.sync import sync_to_async


CHUNK_SIZE = 100


# @shared_task()
# def async_send_messages_with_smtp(email_messages):
#     conn = get_connection(backend=settings.EMAIL_BACKEND)
#
#     if not email_messages:
#         return 0
#
#     with conn._lock:
#         new_conn_created = conn.open()
#         if not conn.connection or new_conn_created is None:
#             return 0
#
#         num_sent = 0
#         for message in email_messages:
#             sent = conn._send(message)
#             if sent:
#                 num_sent += 1
#
#         if new_conn_created:
#             conn.close()
#
#     return num_sent


async def async_send_push_notification(notification_ids):
    channel_layer = get_channel_layer()

    notifications = [
        n async for n in Notification.objects.filter(id__in=notification_ids).select_related("user").aiterator()
    ]

    for notification in notifications:
        user = notification.user

        if not user:
            continue

        group_name = f"notifications_{user.username}_{user.id}"
        await channel_layer.group_send(
            group_name,
            {
                "type": "notification.push",
                "message": json.dumps({
                    "id": notification.id,
                    "message": notification.message,
                    "is_read": notification.is_read,
                    "level": notification.level,
                    "created_at": notification.created_at.isoformat(),
                })
            }
        )


@shared_task
def send_push_notification(notification_ids):
    asyncio.run(async_send_push_notification(notification_ids))


async def async_send_push_notification_all(notif_ids):
    channel_layer = get_channel_layer()

    notifications = [
        notification async for notification in Notification.objects.filter(
            id__in=notif_ids, user__isnull=True
        ).aiterator()
    ]

    User = get_user_model()

    user_ids = [
        user_id async for user_id in User.objects.values_list("id", flat=True).aiterator()
    ]

    for i in range(0, len(user_ids), CHUNK_SIZE):
        chunk_ids = user_ids[i:i + CHUNK_SIZE]

        users_chunk = [
            user async for user in User.objects.filter(id__in=chunk_ids).aiterator()
        ]

        for user in users_chunk:
            for notification in notifications:
                new_notification = await Notification.objects.acreate(
                    user=user,
                    message=notification.message,
                    level=notification.level,
                    is_read=False,
                    created_at=now(),
                )

                group_name = f"notifications_{user.username}_{user.id}"

                await channel_layer.group_send(
                    group_name,
                    {
                        "type": "notification_push",
                        "message": json.dumps({
                            "id": new_notification.id,
                            "message": new_notification.message,
                            "is_read": new_notification.is_read,
                            "level": new_notification.level,
                            "created_at": new_notification.created_at.isoformat(),
                        })
                    }
                )


@shared_task
def send_push_notification_all(notification_ids):
    asyncio.run(async_send_push_notification_all(notification_ids))
