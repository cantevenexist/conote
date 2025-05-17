from celery import shared_task
from datetime import timedelta
from django.utils.timezone import now
from .models import Trash
import asyncio
from celery import shared_task
import redis
import json
from django.core.files.base import ContentFile
from .models import Board


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


@shared_task
def process_board_commands(url_hash):
    r = redis.Redis()
    key = f"board_commands:{url_hash}"

    commands = r.lrange(key, 0, 99)
    if not commands:
        return

    try:
        board = Board.objects.get(url_hash=url_hash)
    except Board.DoesNotExist:
        return

    current_data = {}
    if board.board_value:
        current_data = json.loads(board.board_value.read().decode('utf-8'))

    for command_bytes in commands:
        try:
            command = json.loads(command_bytes.decode('utf-8'))
            process_command(current_data, command)
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            print(f"Error processing command: {e}")
            continue

    json_content = json.dumps(current_data).encode('utf-8')
    board.board_value.save(
        f"{url_hash}.json",
        ContentFile(json_content),
        save=False
    )
    board.save()

    r.ltrim(key, len(commands), -1)


def process_command(data, command):
    if command['type'] == 'create':
        handle_create(data, command)
    elif command['type'] == 'update':
        handle_update(data, command)
    elif command['type'] == 'delete':
        handle_delete(data, command)


def handle_create(data, command):
    obj_type = command['objectType']
    obj_id = command.get('id')
    obj_data = command['data']

    if obj_type not in data:
        data[obj_type] = {}

    if obj_id in data[obj_type]:
        raise ValueError(f"{obj_type} with id {obj_id} already exists")

    data[obj_type][obj_id] = obj_data


def handle_update(data, command):
    obj_type = command['objectType']
    obj_id = command['id']
    obj_data = command['data']

    if obj_type not in data or obj_id not in data[obj_type]:
        raise ValueError(f"{obj_type} with id {obj_id} not found")

    data[obj_type][obj_id].update(obj_data)


def handle_delete(data, command):
    obj_type = command['objectType']
    obj_id = command['id']

    if obj_type in data and obj_id in data[obj_type]:
        del data[obj_type][obj_id]
