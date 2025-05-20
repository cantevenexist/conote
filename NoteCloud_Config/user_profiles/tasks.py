from celery import shared_task
from django.core.mail import get_connection
from django.conf import settings
from django.contrib.auth import get_user_model
from .models import Notification, EmailMessage, TelegramMessage
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import json
import asyncio
from django.utils.timezone import now
from asgiref.sync import sync_to_async
import json
from django.contrib.sites.models import Site
from django.template.loader import render_to_string
from django.template import Template, Context
from django.core.mail import EmailMessage as DjangoEmail
from telegram_bot import send_message_to_users, send_message_to_users_handler, get_all_user_ids
from allauth.socialaccount.models import SocialAccount
import os
from aiogram import Bot


CHUNK_SIZE = 100


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


async def async_send_push_notification_all(notification_ids,
                                           filter_kwargs: list[dict] = None, exclude_kwargs: list[dict] = None):
    channel_layer = get_channel_layer()
    User = get_user_model()

    templates = [
        tpl async for tpl in Notification.objects
            .filter(id__in=notification_ids, user__isnull=True)
            .aiterator()
    ]

    users_qs = User.objects.all()
    for kw in filter_kwargs or []:
        users_qs = users_qs.filter(**kw)
    for kw in exclude_kwargs or []:
        users_qs = users_qs.exclude(**kw)
    users_qs = users_qs.distinct()

    all_user_ids = [uid async for uid in users_qs.values_list("id", flat=True).aiterator()]

    for i in range(0, len(all_user_ids), CHUNK_SIZE):
        chunk = all_user_ids[i : i + CHUNK_SIZE]
        users = [
            u async for u in User.objects.filter(id__in=chunk).aiterator()
        ]

        for user in users:
            group_name = f"notifications_{user.username}_{user.id}"

            for tpl in templates:
                new_notif = await Notification.objects.acreate(
                    user=user,
                    message=tpl.message,
                    level=tpl.level,
                    is_read=False,
                    created_at=now(),
                    content_type_id=tpl.content_type_id,
                    object_id=tpl.object_id,
                )

                await channel_layer.group_send(
                    group_name,
                    {
                        "type": "notification_push",
                        "message": json.dumps({
                            "id": new_notif.id,
                            "message": new_notif.message,
                            "is_read": new_notif.is_read,
                            "level": new_notif.level,
                            "created_at": new_notif.created_at.isoformat(),
                        }),
                    }
                )


@shared_task
def send_push_notification_all(notification_ids, filter_kwargs: list[dict] = None, exclude_kwargs: list[dict] = None):
    asyncio.run(
        async_send_push_notification_all(
            notification_ids,
            filter_kwargs=filter_kwargs or [],
            exclude_kwargs=exclude_kwargs or [],
        )
    )


def render_with_body(body, current_site):
    wrapper = "{% extends 'account/email/base_message.txt' %}{% block content %}{{ body }}{% endblock %}"
    return Template(wrapper).render(Context({'body': body, 'current_site': current_site}))


async def async_send_email_to_user(email_message_ids):
    from .backends import AsyncSmtpEmailBackend

    smtp_backend = AsyncSmtpEmailBackend()

    email_messages = [
        n async for n in EmailMessage.objects.filter(id__in=email_message_ids).select_related("user").aiterator()
    ]

    email_messages_send = []
    current_site = await sync_to_async(Site.objects.get_current, thread_sensitive=True)()
    for email_message in email_messages:
        user = email_message.user

        if not user or not user.email:
            continue

        body_txt = await sync_to_async(render_with_body, thread_sensitive=True)(email_message.body, current_site)
        email = DjangoEmail(
            subject=f'[{current_site}] ' + email_message.subject,
            body=body_txt,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[user.email],
        )
        serialized = smtp_backend.serialize_message(email)
        if serialized:
            email_messages_send.append(serialized)

    if email_messages_send:
        async_send_messages_with_smtp.delay(email_messages_send)


@shared_task
def send_email_user(email_message_ids):
    return asyncio.run(async_send_email_to_user(email_message_ids))


async def async_send_email_to_all_users(email_message_ids, filter_kwargs=None, exclude_kwargs=None):
    from .backends import AsyncSmtpEmailBackend

    smtp_backend = AsyncSmtpEmailBackend()

    User = get_user_model()

    templates = [
        tpl async for tpl in EmailMessage.objects
        .filter(id__in=email_message_ids, user__isnull=True)
        .aiterator()
    ]

    users_qs = User.objects.filter(is_active=True)
    for kw in filter_kwargs or []:
        users_qs = users_qs.filter(**kw)
    for kw in exclude_kwargs or []:
        users_qs = users_qs.exclude(**kw)
    users_qs = users_qs.distinct()

    all_user_ids = [uid async for uid in users_qs.values_list("id", flat=True).aiterator()]

    for i in range(0, len(all_user_ids), CHUNK_SIZE):
        chunk = all_user_ids[i:i + CHUNK_SIZE]
        users = [u async for u in User.objects.filter(id__in=chunk).aiterator()]

        email_messages_send = []
        current_site = await sync_to_async(Site.objects.get_current, thread_sensitive=True)()
        for user in users:
            if not user.email:
                continue

            for tpl in templates:
                body_txt = await sync_to_async(render_with_body, thread_sensitive=True)(tpl.body, current_site)
                email = DjangoEmail(
                    subject=f'[{current_site}] ' + tpl.subject,
                    body=body_txt,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    to=[user.email],
                )
                serialized = smtp_backend.serialize_message(email)
                if serialized:
                    email_messages_send.append(serialized)

        if email_messages_send:
            async_send_messages_with_smtp.delay(email_messages_send)


@shared_task
def send_email_to_all_users(email_message_ids, filter_kwargs=None, exclude_kwargs=None):
    return asyncio.run(async_send_email_to_all_users(email_message_ids, filter_kwargs or [], exclude_kwargs or []))


async def async_send_telegram_message_to_user(telegram_message_ids, disable_notification=False):
    bot = Bot(token=os.environ.get("TELEGRAM_SECRET"))

    try:
        qs = TelegramMessage.objects.filter(id__in=telegram_message_ids).select_related('user')
        async for msg in qs.aiterator():
            user = msg.user
            if not user:
                continue

            sa = await SocialAccount.objects.filter(user_id=user.id, provider='telegram').aget()
            if not sa:
                continue

            telegram_id = int(sa.uid)
            await send_message_to_users_handler(bot, telegram_id, msg.text, disable_notification=disable_notification)

    finally:
        await bot.session.close()


async def async_send_telegram_message_to_all_users(telegram_message_ids, filter_kwargs=None, exclude_kwargs=None):
    bot = Bot(token=os.environ.get("TELEGRAM_SECRET"))

    try:
        templates = [
            text async for text in
            TelegramMessage.objects
                .filter(id__in=telegram_message_ids, user__isnull=True)
                .values_list('text', flat=True)
                .aiterator()
        ]
        if not templates:
            return

        User = get_user_model()
        qs = User.objects.filter(is_active=True)
        for kw in filter_kwargs or []:
            qs = qs.filter(**kw)
        for kw in exclude_kwargs or []:
            qs = qs.exclude(**kw)
        qs = qs.distinct()

        social_qs = SocialAccount.objects.filter(
            user__in=qs,
            provider='telegram'
        ).values_list('uid', flat=True)
        telegram_ids = [int(uid) async for uid in social_qs.aiterator()]

        for text in templates:
            await send_message_to_users(bot, text, telegram_ids)

    finally:
        await bot.session.close()


@shared_task
def send_telegram_message_to_user(telegram_message_ids, disable_notification=False):
    loop = asyncio.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(
            async_send_telegram_message_to_user(
                telegram_message_ids,
                disable_notification=disable_notification
            )
        )
    finally:
        loop.close()


@shared_task
def send_telegram_message_to_all_users(telegram_message_ids, filter_kwargs=None, exclude_kwargs=None):
    loop = asyncio.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(
            async_send_telegram_message_to_all_users(
                telegram_message_ids,
                filter_kwargs or [],
                exclude_kwargs or []
            )
        )
    finally:
        loop.close()
