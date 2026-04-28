import json
from django.http import JsonResponse
from django.views import View
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.core.files.base import ContentFile
from .models import Board
import hashlib
import uuid
import time
from rest_framework.authtoken.models import Token


@method_decorator(csrf_exempt, name='dispatch')
class ExtensionAuthView(View):
    def post(self, request):
        try:
            data = json.loads(request.body.decode('utf-8'))
            login_field = data.get('username') or data.get('email')
            password = data.get('password')
            
            if not login_field or not password:
                return JsonResponse({
                    'success': False,
                    'error': 'Введите username/email и пароль'
                }, status=400)
            
            user = None
            try:
                user = User.objects.get(username=login_field)
            except User.DoesNotExist:
                try:
                    user = User.objects.get(email=login_field)
                except User.DoesNotExist:
                    pass
            
            if not user:
                return JsonResponse({
                    'success': False,
                    'error': f'Пользователь "{login_field}" не найден'
                }, status=400)
            
            if not user.check_password(password):
                return JsonResponse({
                    'success': False,
                    'error': 'Неверный пароль'
                }, status=400)
            
            token, created = Token.objects.get_or_create(user=user)
            
            return JsonResponse({
                'success': True,
                'token': token.key,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'is_premium': False
                }
            })
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=500)


@method_decorator(csrf_exempt, name='dispatch')
class ExtensionLogoutView(View):
    def post(self, request):
        auth_header = request.headers.get('Authorization', '')
        token_key = auth_header.replace('Token ', '')
        
        if token_key:
            try:
                token = Token.objects.get(key=token_key)
                token.delete()
            except Token.DoesNotExist:
                pass
        
        return JsonResponse({'success': True})


@method_decorator(csrf_exempt, name='dispatch')
class ExtensionUserStatusView(View):
    def get(self, request):
        auth_header = request.headers.get('Authorization', '')
        token_key = auth_header.replace('Token ', '')
        
        if token_key:
            try:
                token = Token.objects.get(key=token_key)
                user = token.user
                return JsonResponse({
                    'authenticated': True,
                    'user': {
                        'id': user.id,
                        'username': user.username,
                        'email': user.email,
                        'is_premium': False
                    }
                })
            except Token.DoesNotExist:
                pass
        
        return JsonResponse({'authenticated': False})


@method_decorator(csrf_exempt, name='dispatch')
class ExtensionWorkspacesView(View):
    """Рабочие пространства (Board модели)"""
    
    def _get_user(self, request):
        auth_header = request.headers.get('Authorization', '')
        token_key = auth_header.replace('Token ', '')
        if not token_key:
            return None
        try:
            token = Token.objects.get(key=token_key)
            return token.user
        except Token.DoesNotExist:
            return None
    
    def get(self, request):
        user = self._get_user(request)
        if not user:
            return JsonResponse({'error': 'Unauthorized'}, status=401)
        
        workspaces = []
        for board in Board.objects.filter(user=user):
            workspaces.append({
                'id': board.id,
                'url_hash': board.url_hash,
                'name': board.name,
                'created_at': board.created_at.isoformat(),
                'updated_at': board.updated_at.isoformat(),
                'is_owner': True,
                'access_users': list(board.access_users.values('id', 'username'))
            })
        
        for board in Board.objects.filter(access_users=user):
            if board.user != user:
                workspaces.append({
                    'id': board.id,
                    'url_hash': board.url_hash,
                    'name': board.name,
                    'created_at': board.created_at.isoformat(),
                    'updated_at': board.updated_at.isoformat(),
                    'is_owner': False,
                    'owner': board.user.username,
                    'access_users': list(board.access_users.values('id', 'username'))
                })
        
        return JsonResponse({'workspaces': workspaces})
    
    def post(self, request):
        user = self._get_user(request)
        if not user:
            return JsonResponse({'error': 'Unauthorized'}, status=401)
        
        try:
            data = json.loads(request.body.decode('utf-8'))
            name = data.get('name', 'Новое пространство')
            
            workspace = Board.objects.create(
                user=user,
                name=name
            )
            
            empty_data = {}
            json_content = json.dumps(empty_data).encode('utf-8')
            workspace.board_value.save(
                f"{workspace.url_hash}.json",
                ContentFile(json_content),
                save=False
            )
            workspace.save(update_fields=['board_value'])
            
            return JsonResponse({
                'success': True,
                'workspace': {
                    'id': workspace.id,
                    'url_hash': workspace.url_hash,
                    'name': workspace.name,
                    'created_at': workspace.created_at.isoformat(),
                    'updated_at': workspace.updated_at.isoformat()
                }
            })
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=500)
    
    def put(self, request, workspace_id):
        user = self._get_user(request)
        if not user:
            return JsonResponse({'error': 'Unauthorized'}, status=401)
        
        try:
            data = json.loads(request.body.decode('utf-8'))
            workspace = Board.objects.get(id=workspace_id, user=user)
            
            if 'name' in data:
                workspace.name = data['name']
                workspace.save()
            
            return JsonResponse({'success': True})
        except Board.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Пространство не найдено'}, status=404)
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=500)
    
    def delete(self, request, workspace_id):
        user = self._get_user(request)
        if not user:
            return JsonResponse({'error': 'Unauthorized'}, status=401)
        
        try:
            workspace = Board.objects.get(id=workspace_id, user=user)
            workspace.delete()
            return JsonResponse({'success': True})
        except Board.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Пространство не найдено'}, status=404)
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=500)


@method_decorator(csrf_exempt, name='dispatch')
class ExtensionKanbanBoardsView(View):
    """Канбан-доски внутри рабочего пространства"""
    
    def _get_user(self, request):
        auth_header = request.headers.get('Authorization', '')
        token_key = auth_header.replace('Token ', '')
        if not token_key:
            return None
        try:
            token = Token.objects.get(key=token_key)
            return token.user
        except Token.DoesNotExist:
            return None
    
    def get(self, request, workspace_hash):
        user = self._get_user(request)
        if not user:
            return JsonResponse({'error': 'Unauthorized'}, status=401)
        
        try:
            workspace = Board.objects.get(url_hash=workspace_hash)
            
            if workspace.user != user and not workspace.access_users.filter(pk=user.pk).exists():
                return JsonResponse({'error': 'Access denied'}, status=403)
            
            board_data = {}
            if workspace.board_value:
                raw = workspace.board_value.read()
                if raw:
                    board_data = json.loads(raw.decode('utf-8'))
            
            boards_dict = board_data.get('board', {})
            columns_dict = board_data.get('column', {})
            cards_dict = board_data.get('card', {})
            
            kanban_boards = []
            for board_id, board_info in boards_dict.items():
                # Получаем колонки для этой доски
                board_columns = []
                for col_id, col_info in columns_dict.items():
                    if col_info.get('boardId') == board_id:
                        # Добавляем index, если его нет - ставим 0
                        if 'index' not in col_info:
                            col_info['index'] = 0
                        board_columns.append(col_info)
                
                # Сортируем по index
                board_columns.sort(key=lambda x: x.get('index', 0))
                
                columns = []
                for col_info in board_columns:
                    col_id = col_info['id']
                    cards = []
                    for card_id, card_info in cards_dict.items():
                        if card_info.get('columnId') == col_id:
                            cards.append({
                                'id': card_id,
                                'title': card_info.get('title', ''),
                                'content': card_info.get('content', ''),
                                'columnId': card_info.get('columnId'),
                                'index': card_info.get('index', 0)
                            })
                    cards.sort(key=lambda x: x.get('index', 0))
                    
                    columns.append({
                        'id': col_id,
                        'title': col_info.get('title', ''),
                        'boardId': col_info.get('boardId'),
                        'index': col_info.get('index', 0),
                        'cards': cards
                    })
                
                kanban_boards.append({
                    'id': board_id,
                    'title': board_info.get('title', 'Без названия'),
                    'x': board_info.get('x', 0),
                    'y': board_info.get('y', 0),
                    'columns': columns
                })
            
            return JsonResponse({
                'workspace': {
                    'id': workspace.id,
                    'name': workspace.name,
                    'url_hash': workspace.url_hash
                },
                'kanban_boards': kanban_boards
            })
        except Board.DoesNotExist:
            return JsonResponse({'error': 'Workspace not found'}, status=404)
    
    def post(self, request, workspace_hash):
        user = self._get_user(request)
        if not user:
            return JsonResponse({'error': 'Unauthorized'}, status=401)
        
        try:
            workspace = Board.objects.get(url_hash=workspace_hash)
            
            if workspace.user != user:
                return JsonResponse({'error': 'Only owner can modify'}, status=403)
            
            data = json.loads(request.body.decode('utf-8'))
            title = data.get('title', 'Новая доска')
            
            x = 0
            y = 0
            
            board_data = {}
            if workspace.board_value:
                raw = workspace.board_value.read()
                if raw:
                    board_data = json.loads(raw.decode('utf-8'))
            
            if 'board' not in board_data:
                board_data['board'] = {}
            
            if 'column' not in board_data:
                board_data['column'] = {}
            
            if 'card' not in board_data:
                board_data['card'] = {}
            
            board_id = hashlib.sha256(
                f"{workspace_hash}{title}{time.time()}{user.id}".encode('utf-8')
            ).hexdigest()
            
            board_data['board'][board_id] = {
                'id': board_id,
                'title': title,
                'x': x,
                'y': y
            }
            
            # Создаем колонку по умолчанию с index = 0
            column_id = hashlib.sha256(
                f"{workspace_hash}{board_id}default_column{time.time()}{user.id}".encode('utf-8')
            ).hexdigest()[:16]
            
            board_data['column'][column_id] = {
                'id': column_id,
                'title': 'Новые задачи',
                'boardId': board_id,
                'index': 0
            }
            
            json_content = json.dumps(board_data).encode('utf-8')
            
            if workspace.board_value:
                workspace.board_value.delete(save=False)
            
            workspace.board_value.save(
                f"{workspace.url_hash}.json",
                ContentFile(json_content),
                save=False
            )
            workspace.save(update_fields=['board_value'])
            
            return JsonResponse({
                'success': True,
                'board': {
                    'id': board_id,
                    'title': title,
                    'x': x,
                    'y': y,
                    'columns': [{
                        'id': column_id,
                        'title': 'Новые задачи',
                        'boardId': board_id,
                        'index': 0,
                        'cards': []
                    }]
                }
            })
        except Board.DoesNotExist:
            return JsonResponse({'error': 'Workspace not found'}, status=404)
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=500)
    
    def delete(self, request, workspace_hash, board_id):
        user = self._get_user(request)
        if not user:
            return JsonResponse({'error': 'Unauthorized'}, status=401)
        
        try:
            workspace = Board.objects.get(url_hash=workspace_hash)
            
            if workspace.user != user:
                return JsonResponse({'error': 'Only owner can modify'}, status=403)
            
            board_data = {}
            if workspace.board_value:
                raw = workspace.board_value.read()
                if raw:
                    board_data = json.loads(raw.decode('utf-8'))
            
            if 'board' in board_data and board_id in board_data['board']:
                del board_data['board'][board_id]
            
            if 'column' in board_data:
                columns_to_delete = []
                for col_id, col in board_data['column'].items():
                    if col.get('boardId') == board_id:
                        columns_to_delete.append(col_id)
                
                for col_id in columns_to_delete:
                    del board_data['column'][col_id]
                    
                    if 'card' in board_data:
                        cards_to_delete = []
                        for card_id, card in board_data['card'].items():
                            if card.get('columnId') == col_id:
                                cards_to_delete.append(card_id)
                        
                        for card_id in cards_to_delete:
                            del board_data['card'][card_id]
            
            json_content = json.dumps(board_data).encode('utf-8')
            
            if workspace.board_value:
                workspace.board_value.delete(save=False)
            
            workspace.board_value.save(
                f"{workspace.url_hash}.json",
                ContentFile(json_content),
                save=False
            )
            workspace.save(update_fields=['board_value'])
            
            return JsonResponse({'success': True})
        except Board.DoesNotExist:
            return JsonResponse({'error': 'Workspace not found'}, status=404)
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=500)


@method_decorator(csrf_exempt, name='dispatch')
class ExtensionGenerateIdView(View):
    def post(self, request):
        user = self._get_user(request)
        if not user:
            return JsonResponse({'error': 'Unauthorized'}, status=401)
        
        try:
            data = json.loads(request.body.decode('utf-8'))
            workspace_hash = data.get('workspace_hash', 'temp')
            object_type = data.get('object_type', 'unknown')
            
            timestamp = time.time()
            unique_id = str(uuid.uuid4())
            user_id = user.id
            
            hash_input = f"{workspace_hash}{object_type}{timestamp}{unique_id}{user_id}".encode('utf-8')
            generated_id = hashlib.sha256(hash_input).hexdigest()[:16]
            
            return JsonResponse({'id': generated_id})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    def _get_user(self, request):
        auth_header = request.headers.get('Authorization', '')
        token_key = auth_header.replace('Token ', '')
        if not token_key:
            return None
        try:
            token = Token.objects.get(key=token_key)
            return token.user
        except Token.DoesNotExist:
            return None


@method_decorator(csrf_exempt, name='dispatch')
class ExtensionRawWorkspaceDataView(View):
    """Получение и сохранение сырых данных рабочего пространства"""
    
    def _get_user(self, request):
        auth_header = request.headers.get('Authorization', '')
        token_key = auth_header.replace('Token ', '')
        if not token_key:
            return None
        try:
            token = Token.objects.get(key=token_key)
            return token.user
        except Token.DoesNotExist:
            return None
    
    def get(self, request, workspace_hash):
        user = self._get_user(request)
        if not user:
            return JsonResponse({'error': 'Unauthorized'}, status=401)
        
        try:
            workspace = Board.objects.get(url_hash=workspace_hash)
            
            if workspace.user != user and not workspace.access_users.filter(pk=user.pk).exists():
                return JsonResponse({'error': 'Access denied'}, status=403)
            
            board_data = {}
            if workspace.board_value:
                raw = workspace.board_value.read()
                if raw:
                    board_data = json.loads(raw.decode('utf-8'))
            
            return JsonResponse({'board_data': board_data})
        except Board.DoesNotExist:
            return JsonResponse({'error': 'Workspace not found'}, status=404)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=500)
    
    def post(self, request, workspace_hash):
        user = self._get_user(request)
        if not user:
            return JsonResponse({'error': 'Unauthorized'}, status=401)
        
        try:
            workspace = Board.objects.get(url_hash=workspace_hash)
            
            if workspace.user != user:
                return JsonResponse({'error': 'Only owner can modify'}, status=403)
            
            data = json.loads(request.body.decode('utf-8'))
            
            clean_data = {}
            
            if 'board' in data and data['board'] and len(data['board']) > 0:
                clean_data['board'] = data['board']
            elif 'boards' in data and data['boards'] and len(data['boards']) > 0:
                clean_data['board'] = data['boards']
            
            if 'column' in data and data['column'] and len(data['column']) > 0:
                clean_data['column'] = data['column']
            elif 'columns' in data and data['columns'] and len(data['columns']) > 0:
                clean_data['column'] = data['columns']
            
            if 'card' in data and data['card'] and len(data['card']) > 0:
                clean_data['card'] = data['card']
            elif 'cards' in data and data['cards'] and len(data['cards']) > 0:
                clean_data['card'] = data['cards']
            
            json_content = json.dumps(clean_data).encode('utf-8')
            
            if workspace.board_value:
                workspace.board_value.delete(save=False)
            
            workspace.board_value.save(
                f"{workspace.url_hash}.json",
                ContentFile(json_content),
                save=False
            )
            workspace.save(update_fields=['board_value'])
            
            return JsonResponse({'success': True})
        except Board.DoesNotExist:
            return JsonResponse({'error': 'Workspace not found'}, status=404)
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=500)