// background.js
const API_BASE_URL = 'http://localhost:8000';

// При запуске сервис-воркера восстанавливаем сессию
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension started');
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message:', request.type);
  
  if (request.type === 'CHECK_AUTH') {
    checkAuth().then(sendResponse);
    return true;
  }
  
  if (request.type === 'LOGIN') {
    login(request.credentials).then(sendResponse);
    return true;
  }
  
  if (request.type === 'LOGOUT') {
    logout().then(sendResponse);
    return true;
  }
  
  if (request.type === 'GET_WORKSPACES') {
    getWorkspaces().then(sendResponse);
    return true;
  }
  
  if (request.type === 'CREATE_WORKSPACE') {
    createWorkspace(request.data).then(sendResponse);
    return true;
  }
  
  if (request.type === 'UPDATE_WORKSPACE') {
    updateWorkspace(request.workspaceId, request.data).then(sendResponse);
    return true;
  }
  
  if (request.type === 'DELETE_WORKSPACE') {
    deleteWorkspace(request.workspaceId).then(sendResponse);
    return true;
  }
  
  if (request.type === 'GET_KANBAN_BOARDS') {
    getKanbanBoards(request.workspaceHash).then(sendResponse);
    return true;
  }
  
  if (request.type === 'CREATE_KANBAN_BOARD') {
    createKanbanBoard(request.workspaceHash, request.data).then(sendResponse);
    return true;
  }
  
  if (request.type === 'UPDATE_KANBAN_BOARD') {
    updateKanbanBoard(request.workspaceHash, request.boardId, request.data).then(sendResponse);
    return true;
  }
  
  if (request.type === 'DELETE_KANBAN_BOARD') {
    deleteKanbanBoard(request.workspaceHash, request.boardId).then(sendResponse);
    return true;
  }
  
  if (request.type === 'GET_RAW_WORKSPACE_DATA') {
    getRawWorkspaceData(request.workspaceHash).then(sendResponse);
    return true;
  }
  
  if (request.type === 'SAVE_RAW_WORKSPACE_DATA') {
    saveRawWorkspaceData(request.workspaceHash, request.data).then(sendResponse);
    return true;
  }
  
  if (request.type === 'GENERATE_ID') {
    generateId(request.workspaceHash, request.objectType).then(sendResponse);
    return true;
  }
  
  return true;
});

// Получить токен из storage
async function getToken() {
  const result = await chrome.storage.local.get(['auth_token']);
  return result.auth_token || null;
}

// Проверка авторизации
async function checkAuth() {
  try {
    const token = await getToken();
    console.log('CheckAuth - token exists:', !!token);
    
    if (!token) {
      return { authenticated: false };
    }
    
    const response = await fetch(`${API_BASE_URL}/workspace/api/extension/user/`, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Token ${token}`
      }
    });
    
    console.log('CheckAuth - response status:', response.status);
    
    if (!response.ok) {
      // Токен невалидный - удаляем
      await chrome.storage.local.remove(['auth_token', 'user']);
      return { authenticated: false };
    }
    
    const data = await response.json();
    console.log('CheckAuth - data:', data);
    
    if (data.authenticated && data.user) {
      await chrome.storage.local.set({ user: data.user });
      return { authenticated: true, user: data.user };
    }
    
    return { authenticated: false };
  } catch (error) {
    console.error('Auth check error:', error);
    return { authenticated: false };
  }
}

// Логин
async function login(credentials) {
  try {
    console.log('Login attempt for:', credentials.username);
    
    const response = await fetch(`${API_BASE_URL}/workspace/api/extension/auth/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: credentials.username,
        password: credentials.password
      })
    });
    
    const data = await response.json();
    console.log('Login response:', data);
    
    if (data.success) {
      // Сохраняем токен и пользователя
      await chrome.storage.local.set({ 
        auth_token: data.token,
        user: data.user 
      });
      console.log('Token saved:', data.token);
      return { success: true, user: data.user };
    }
    
    return data;
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: error.message };
  }
}

// Логаут
async function logout() {
  try {
    const token = await getToken();
    console.log('Logout - token exists:', !!token);
    
    if (token) {
      await fetch(`${API_BASE_URL}/workspace/api/extension/logout/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Token ${token}`
        }
      });
    }
    
    await chrome.storage.local.remove(['auth_token', 'user', 'workspaces', 'currentWorkspace']);
    console.log('Logout - storage cleared');
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false };
  }
}

// Универсальная функция запросов с токеном
async function authFetch(url, options = {}) {
  const token = await getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Token ${token}`;
  }
  
  const response = await fetch(url, {
    ...options,
    headers
  });
  
  // Если 401 - чистим токен
  if (response.status === 401) {
    await chrome.storage.local.remove(['auth_token', 'user']);
  }
  
  return response;
}

// Рабочие пространства
async function getWorkspaces() {
  try {
    const response = await authFetch(`${API_BASE_URL}/workspace/api/extension/workspaces/`);
    
    if (!response.ok) {
      return { workspaces: [] };
    }
    
    const data = await response.json();
    await chrome.storage.local.set({ workspaces: data.workspaces });
    return data;
  } catch (error) {
    console.error('Get workspaces error:', error);
    return { workspaces: [] };
  }
}

async function createWorkspace(data) {
  try {
    const response = await authFetch(`${API_BASE_URL}/workspace/api/extension/workspaces/`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    
    return await response.json();
  } catch (error) {
    console.error('Create workspace error:', error);
    return { success: false, error: error.message };
  }
}

async function updateWorkspace(workspaceId, data) {
  try {
    const response = await authFetch(`${API_BASE_URL}/workspace/api/extension/workspaces/${workspaceId}/`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    
    return await response.json();
  } catch (error) {
    console.error('Update workspace error:', error);
    return { success: false };
  }
}

async function deleteWorkspace(workspaceId) {
  try {
    const response = await authFetch(`${API_BASE_URL}/workspace/api/extension/workspaces/${workspaceId}/`, {
      method: 'DELETE'
    });
    
    return await response.json();
  } catch (error) {
    console.error('Delete workspace error:', error);
    return { success: false };
  }
}

// Канбан доски
async function getKanbanBoards(workspaceHash) {
  try {
    const response = await authFetch(`${API_BASE_URL}/workspace/api/extension/workspaces/${workspaceHash}/boards/`);
    
    if (!response.ok) {
      return { kanban_boards: [] };
    }
    
    return await response.json();
  } catch (error) {
    console.error('Get kanban boards error:', error);
    return { kanban_boards: [] };
  }
}

async function createKanbanBoard(workspaceHash, data) {
  try {
    const response = await authFetch(`${API_BASE_URL}/workspace/api/extension/workspaces/${workspaceHash}/boards/`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    
    const text = await response.text();
    if (!text) {
      return { success: false, error: 'Сервер вернул пустой ответ' };
    }
    
    return JSON.parse(text);
  } catch (error) {
    console.error('Create kanban board error:', error);
    return { success: false, error: error.message };
  }
}

async function updateKanbanBoard(workspaceHash, boardId, data) {
  try {
    const response = await authFetch(`${API_BASE_URL}/workspace/api/extension/workspaces/${workspaceHash}/boards/${boardId}/`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    
    return await response.json();
  } catch (error) {
    console.error('Update kanban board error:', error);
    return { success: false };
  }
}

async function deleteKanbanBoard(workspaceHash, boardId) {
  try {
    const response = await authFetch(`${API_BASE_URL}/workspace/api/extension/workspaces/${workspaceHash}/boards/${boardId}/`, {
      method: 'DELETE'
    });
    
    return await response.json();
  } catch (error) {
    console.error('Delete kanban board error:', error);
    return { success: false };
  }
}

// RAW данные
async function getRawWorkspaceData(workspaceHash) {
  try {
    const response = await authFetch(`${API_BASE_URL}/workspace/api/extension/workspaces/${workspaceHash}/raw/`);
    
    if (!response.ok) {
      return { board_data: {} };
    }
    
    return await response.json();
  } catch (error) {
    console.error('Get raw workspace data error:', error);
    return { board_data: {} };
  }
}

async function saveRawWorkspaceData(workspaceHash, boardData) {
  try {
    const response = await authFetch(`${API_BASE_URL}/workspace/api/extension/workspaces/${workspaceHash}/raw/`, {
      method: 'POST',
      body: JSON.stringify(boardData)
    });
    
    return await response.json();
  } catch (error) {
    console.error('Save raw workspace data error:', error);
    return { success: false, error: error.message };
  }
}

async function generateId(workspaceHash, objectType) {
  try {
    const response = await authFetch(`${API_BASE_URL}/workspace/api/extension/generate_id/`, {
      method: 'POST',
      body: JSON.stringify({ 
        workspace_hash: workspaceHash, 
        object_type: objectType 
      })
    });
    
    const data = await response.json();
    return { id: data.id };
  } catch (error) {
    console.error('Generate ID error:', error);
    return { id: null };
  }
}