from celery import shared_task
from datetime import timedelta
from django.utils.timezone import now
from .models import Trash
import asyncio


CHUNK_SIZE = 100


async def async_delete_old_trash(seconds: int):
    threshold_time = now() - timedelta(seconds=seconds)

    while True:
        objects = [obj async for obj in Trash.objects.filter(deleted_at__lt=threshold_time).values_list('id', flat=True).aiterator()][:CHUNK_SIZE]

        if not objects:
            break

        await Trash.objects.filter(id__in=objects).adelete()

    return f"Deleted old trash items stored more than {seconds} seconds."


@shared_task
def delete_old_trash():
    asyncio.run(async_delete_old_trash(30 * 24 * 60 * 60))
