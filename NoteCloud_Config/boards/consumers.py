# import json
# from channels.generic.websocket import AsyncWebsocketConsumer
#
#
# class BoardConsumer(AsyncWebsocketConsumer):
#     async def connect(self):
#         self.group_name = 'board_group'
#         await self.channel_layer.group_add(
#             self.group_name,
#             self.channel_name
#         )
#         await self.accept()
#
#     async def disconnect(self, close_code):
#         await self.channel_layer.group_discard(
#             self.group_name,
#             self.channel_name
#         )
#
#     async def receive(self, text_data):
#         data = json.loads(text_data)
#         board_state = data.get('board_state')
#         if board_state:
#             await self.channel_layer.group_send(
#                 self.group_name,
#                 {
#                     'type': 'board_state_message',
#                     'board_state': board_state
#                 }
#             )
#
#     async def board_state_message(self, event):
#         board_state = event['board_state']
#         await self.send(text_data=json.dumps({
#             'board_state': board_state
#         }))
