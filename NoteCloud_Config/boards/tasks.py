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
from django.conf import settings


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
    r = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD
        )
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
    obj_id = command['data']['id']
    obj_data = command['data']

    if obj_type not in data:
        data[obj_type] = {}

    if obj_id in data[obj_type]:
        raise ValueError(f"{obj_type} с id {obj_id} уже существует")

    data[obj_type][obj_id] = obj_data


def handle_update(data, command):
    obj_type = command['objectType']
    obj_id = command['id']
    obj_data = command['data']

    if obj_type not in data or obj_id not in data[obj_type]:
        raise ValueError(f"{obj_type} с id {obj_id} не найден")

    data[obj_type][obj_id].update(obj_data)


def handle_delete(data, command):
    obj_type = command['objectType']
    obj_id = command['id']

    if obj_type == 'board':
        if obj_id in data.get('board', {}):
            columns_to_delete = [col_id for col_id, col_data in data.get('column', {}).items()
                                 if col_data['boardId'] == obj_id]
            for col_id in columns_to_delete:
                cards_to_delete = [card_id for card_id, card_data in data.get('card', {}).items()
                                   if card_data['columnId'] == col_id]
                for card_id in cards_to_delete:
                    del data['card'][card_id]
                del data['column'][col_id]
            del data['board'][obj_id]
    elif obj_type == 'column':
        if obj_id in data.get('column', {}):
            cards_to_delete = [card_id for card_id, card_data in data.get('card', {}).items()
                               if card_data['columnId'] == obj_id]
            for card_id in cards_to_delete:
                del data['card'][card_id]
            del data['column'][obj_id]
    elif obj_type == 'card':
        if obj_id in data.get('card', {}):
            del data['card'][obj_id]
