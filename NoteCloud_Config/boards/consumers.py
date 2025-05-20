import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from .models import Board
import redis
from django.conf import settings
from .tasks import process_board_commands


class BoardConsumer(AsyncWebsocketConsumer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.redis = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            password=settings.REDIS_PASSWORD
        )
        self.room_group_name = None
        self.url_hash = None

    async def connect(self):
        self.url_hash = self.scope['url_route']['kwargs']['url_hash']
        self.room_group_name = f'board_{self.url_hash}'

        user = self.scope['user']

        if isinstance(user, AnonymousUser):
            await self.close()
            return

        if not await self.check_board_access(user):
            await self.close()
            return

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await database_sync_to_async(self.redis.sadd)(
            f"board_users:{self.url_hash}",
            self.channel_name
        )

        await self.accept()

        await self.send_initial_commands()

    @database_sync_to_async
    def check_board_access(self, user):
        try:
            board = Board.objects.get(url_hash=self.url_hash)
            return user == board.user or user in board.access_users.all()
        except Board.DoesNotExist:
            return False

    async def send_initial_commands(self):
        commands = await database_sync_to_async(self.redis.lrange)(
            f"board_commands:{self.url_hash}", 0, -1
        )
        for command in commands:
            await self.send(text_data=command.decode('utf-8'))

    async def disconnect(self, close_code):
        if self.room_group_name:
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

            await database_sync_to_async(self.redis.srem)(
                f"board_users:{self.url_hash}",
                self.channel_name
            )

            remaining = await database_sync_to_async(self.redis.scard)(
                f"board_users:{self.url_hash}"
            )
            if remaining == 0:
                process_board_commands.delay(self.url_hash, True)

    async def receive(self, text_data=None, bytes_data=None):
        if text_data:
            try:
                await database_sync_to_async(self.redis.rpush)(
                    f"board_commands:{self.url_hash}",
                    text_data
                )

                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'board_command',
                        'message': text_data,
                        'sender_channel': self.channel_name
                    }
                )

                command_count = await database_sync_to_async(self.redis.llen)(
                    f"board_commands:{self.url_hash}"
                )
                if command_count >= 100:
                    process_board_commands.delay(self.url_hash)

            except Exception as e:
                print(f"Error processing command: {e}")

    async def board_command(self, event):
        if event.get('sender_channel') == self.channel_name:
            return
        await self.send(text_data=event['message'])
