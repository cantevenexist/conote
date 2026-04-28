// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let workspaces = [];
let currentWorkspace = null;
let currentKanbanBoard = null;
let currentEditColumn = null;
let currentEditCard = null;
let isAuthenticated = false;
let currentUser = null;

// Переменные для drag & drop
let draggedCard = null;
let draggedColumn = null;

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup opened - checking auth...');
  
  setupEventListeners();
  
  try {
    const authResult = await checkAuthStatus();
    console.log('Auth result:', authResult);
    
    if (isAuthenticated && currentUser) {
      console.log('User authenticated:', currentUser.username);
      await loadWorkspacesFromServer();
      renderWorkspacesList();
      updateUserInfo();
      showScreen('profile-screen');
    } else {
      console.log('User not authenticated');
      showScreen('login-screen');
    }
  } catch (error) {
    console.error('Initialization error:', error);
    showScreen('login-screen');
  }
});

// ==================== АВТОРИЗАЦИЯ ====================
async function checkAuthStatus() {
  try {
    const storage = await chrome.storage.local.get(['user', 'auth_token']);
    
    if (storage.auth_token && storage.user) {
      console.log('Found token in storage, verifying with server...');
      const response = await chrome.runtime.sendMessage({ type: 'CHECK_AUTH' });
      console.log('CHECK_AUTH response:', response);
      
      if (response && response.authenticated === true && response.user) {
        isAuthenticated = true;
        currentUser = response.user;
        return true;
      }
    }
    
    isAuthenticated = false;
    currentUser = null;
    await chrome.storage.local.remove(['user', 'workspaces', 'currentWorkspace', 'auth_token']);
    return false;
  } catch (error) {
    console.error('Check auth status error:', error);
    isAuthenticated = false;
    currentUser = null;
    return false;
  }
}

async function handleLogin() {
  const username = document.getElementById('login-username')?.value || '';
  const password = document.getElementById('login-password')?.value || '';
  
  if (!username || !password) {
    alert('Введите username и пароль');
    return;
  }
  
  const loginBtn = document.getElementById('login-btn');
  const originalText = loginBtn?.textContent || 'Войти';
  if (loginBtn) {
    loginBtn.textContent = '⏳ Вход...';
    loginBtn.disabled = true;
  }
  
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'LOGIN',
      credentials: { 
        username: username,
        password: password 
      }
    });
    
    console.log('Login response:', response);
    
    if (response && response.success) {
      isAuthenticated = true;
      currentUser = response.user;
      await loadWorkspacesFromServer();
      renderWorkspacesList();
      updateUserInfo();
      showScreen('profile-screen');
    } else {
      alert('Ошибка входа: ' + (response?.error || 'Неверные данные'));
    }
  } catch (error) {
    console.error('Login error:', error);
    alert('Ошибка соединения: ' + error.message);
  } finally {
    if (loginBtn) {
      loginBtn.textContent = originalText;
      loginBtn.disabled = false;
    }
  }
}

async function handleSignup() {
  const username = document.getElementById('signup-username')?.value || '';
  const email = document.getElementById('signup-email')?.value || '';
  const password = document.getElementById('signup-password')?.value || '';
  const password2 = document.getElementById('signup-password2')?.value || '';
  
  if (!username || !email || !password || !password2) {
    alert('Заполните все поля');
    return;
  }
  
  if (password !== password2) {
    alert('Пароли не совпадают');
    return;
  }
  
  const signupBtn = document.getElementById('signup-btn');
  const originalText = signupBtn?.textContent || 'Зарегистрироваться';
  if (signupBtn) {
    signupBtn.textContent = '⏳ Регистрация...';
    signupBtn.disabled = true;
  }
  
  try {
    const response = await fetch('http://localhost:8000/account/signup/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        username: username,
        email: email,
        password1: password,
        password2: password2
      })
    });
    
    if (response.ok || response.status === 302) {
      alert('Регистрация успешна! Теперь войдите.');
      showScreen('login-screen');
      const loginUsername = document.getElementById('login-username');
      if (loginUsername) loginUsername.value = username;
      const loginPassword = document.getElementById('login-password');
      if (loginPassword) loginPassword.value = '';
    } else {
      let errorText = 'Ошибка регистрации. Попробуйте другой username или email.';
      try {
        const text = await response.text();
        if (text.includes('already exists')) errorText = 'Пользователь с таким именем уже существует';
        if (text.includes('email')) errorText = 'Пользователь с таким email уже существует';
      } catch(e) {}
      alert(errorText);
    }
  } catch (error) {
    console.error('Signup error:', error);
    alert('Ошибка соединения с сервером');
  } finally {
    if (signupBtn) {
      signupBtn.textContent = originalText;
      signupBtn.disabled = false;
    }
  }
}

async function handleLogout() {
  if (confirm('Вы уверены, что хотите выйти?')) {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'LOGOUT' });
      console.log('Logout response:', response);
      
      if (response && response.success) {
        isAuthenticated = false;
        currentUser = null;
        workspaces = [];
        currentWorkspace = null;
        currentKanbanBoard = null;
        showScreen('login-screen');
        
        const loginUsername = document.getElementById('login-username');
        const loginPassword = document.getElementById('login-password');
        if (loginUsername) loginUsername.value = '';
        if (loginPassword) loginPassword.value = '';
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
}

function updateUserInfo() {
  if (!currentUser) return;
  
  const userName = document.getElementById('user-name');
  const userEmail = document.getElementById('user-email');
  const premiumBadge = document.getElementById('premium-badge');
  const userInfo = document.getElementById('user-info');
  const profileUsername = document.getElementById('profile-username');
  const profileEmail = document.getElementById('profile-email');
  const profilePremium = document.getElementById('profile-premium');
  
  if (userName) userName.textContent = currentUser.username || '';
  if (userEmail) userEmail.textContent = currentUser.email || '';
  if (premiumBadge && currentUser.is_premium) premiumBadge.style.display = 'inline-block';
  if (userInfo) userInfo.style.display = 'flex';
  if (profileUsername) profileUsername.textContent = currentUser.username || '';
  if (profileEmail) profileEmail.textContent = currentUser.email || '';
  if (profilePremium) profilePremium.textContent = currentUser.is_premium ? 'Premium' : 'Обычный';
}

// ==================== РАБОТА С РАБОЧИМИ ПРОСТРАНСТВАМИ ====================
async function loadWorkspacesFromServer() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_WORKSPACES' });
    workspaces = (response && response.workspaces) ? response.workspaces : [];
    await saveWorkspacesToLocal();
    return workspaces;
  } catch (error) {
    console.error('Load workspaces error:', error);
    workspaces = [];
    return [];
  }
}

async function saveWorkspacesToLocal() {
  try {
    await chrome.storage.local.set({ workspaces: workspaces });
  } catch (error) {
    console.error('Save workspaces error:', error);
  }
}

async function createWorkspaceOnServer(name) {
  const response = await chrome.runtime.sendMessage({
    type: 'CREATE_WORKSPACE',
    data: { name: name }
  });
  
  if (response && response.success) {
    await loadWorkspacesFromServer();
    return response.workspace;
  }
  throw new Error(response?.error || 'Не удалось создать рабочее пространство');
}

async function updateWorkspaceOnServer(workspaceId, workspaceData) {
  return await chrome.runtime.sendMessage({
    type: 'UPDATE_WORKSPACE',
    workspaceId: workspaceId,
    data: workspaceData
  });
}

async function deleteWorkspaceOnServer(workspaceId) {
  return await chrome.runtime.sendMessage({
    type: 'DELETE_WORKSPACE',
    workspaceId: workspaceId
  });
}

// ==================== РАБОТА С RAW ДАННЫМИ ====================
async function getRawWorkspaceData(workspaceHash) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_RAW_WORKSPACE_DATA',
      workspaceHash: workspaceHash
    });
    return response || { board_data: {} };
  } catch (error) {
    console.error('Get raw workspace data error:', error);
    return { board_data: {} };
  }
}

async function saveRawWorkspaceData(workspaceHash, boardData) {
  const response = await chrome.runtime.sendMessage({
    type: 'SAVE_RAW_WORKSPACE_DATA',
    workspaceHash: workspaceHash,
    data: boardData
  });
  return response || { success: false, error: 'No response' };
}

// ==================== РАБОТА С КАНБАН-ДОСКАМИ ====================
async function loadKanbanBoardsFromServer(workspaceHash) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GET_KANBAN_BOARDS',
      workspaceHash: workspaceHash
    });
    return response || { kanban_boards: [] };
  } catch (error) {
    console.error('Load kanban boards error:', error);
    return { kanban_boards: [] };
  }
}

async function createKanbanBoardOnServer(workspaceHash, boardData) {
  const response = await chrome.runtime.sendMessage({
    type: 'CREATE_KANBAN_BOARD',
    workspaceHash: workspaceHash,
    data: boardData
  });
  
  if (response && response.success) {
    return response.board;
  }
  throw new Error(response?.error || 'Не удалось создать доску');
}

async function updateKanbanBoardOnServer(workspaceHash, boardId, boardData) {
  return await chrome.runtime.sendMessage({
    type: 'UPDATE_KANBAN_BOARD',
    workspaceHash: workspaceHash,
    boardId: boardId,
    data: boardData
  });
}

async function deleteKanbanBoardOnServer(workspaceHash, boardId) {
  return await chrome.runtime.sendMessage({
    type: 'DELETE_KANBAN_BOARD',
    workspaceHash: workspaceHash,
    boardId: boardId
  });
}

async function generateIdOnServer(workspaceHash, objectType) {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_ID',
      workspaceHash: workspaceHash,
      objectType: objectType
    });
    return response?.id || Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  } catch (error) {
    console.error('Generate ID error:', error);
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }
}

// ==================== DRAG & DROP ДЛЯ КАРТОЧЕК ====================
function setupCardDragAndDrop() {
  const cards = document.querySelectorAll('.card');
  cards.forEach(card => {
    card.setAttribute('draggable', 'true');
    card.removeEventListener('dragstart', handleCardDragStart);
    card.removeEventListener('dragend', handleCardDragEnd);
    card.addEventListener('dragstart', handleCardDragStart);
    card.addEventListener('dragend', handleCardDragEnd);
  });
  
  const columnsCards = document.querySelectorAll('.column-cards');
  columnsCards.forEach(columnCards => {
    columnCards.removeEventListener('dragover', handleDragOver);
    columnCards.removeEventListener('drop', handleCardDrop);
    columnCards.addEventListener('dragover', handleDragOver);
    columnCards.addEventListener('drop', handleCardDrop);
  });
}

function handleCardDragStart(e) {
  const card = e.target.closest('.card');
  if (!card) {
    e.preventDefault();
    return false;
  }
  draggedCard = {
    id: card.dataset.cardId,
    columnId: card.dataset.columnId
  };
  e.dataTransfer.setData('text/plain', JSON.stringify(draggedCard));
  card.style.opacity = '0.5';
  e.stopPropagation();
}

function handleCardDragEnd(e) {
  const card = e.target.closest('.card');
  if (card) {
    card.style.opacity = '';
  }
  draggedCard = null;
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

// Функция для определения позиции вставки
function getDropIndex(container, mouseY) {
  const cards = Array.from(container.querySelectorAll('.card'));
  
  for (let i = 0; i < cards.length; i++) {
    const rect = cards[i].getBoundingClientRect();
    const cardMiddle = rect.top + rect.height / 2;
    if (mouseY < cardMiddle) {
      return i;
    }
  }
  return cards.length;
}

async function handleCardDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  
  const targetColumnCards = e.target.closest('.column-cards');
  if (!targetColumnCards) return;
  
  const targetColumnId = targetColumnCards.dataset.columnId;
  let draggedData;
  try {
    draggedData = JSON.parse(e.dataTransfer.getData('text/plain'));
  } catch (err) {
    return;
  }
  
  if (!draggedData || !draggedData.id) return;
  
  // Определяем позицию вставки
  const dropIndex = getDropIndex(targetColumnCards, e.clientY);
  
  if (draggedData.columnId === targetColumnId) {
    await reorderCardsInSameColumn(draggedData.id, targetColumnId, dropIndex);
  } else {
    await moveCardToAnotherColumn(draggedData.id, draggedData.columnId, targetColumnId, dropIndex);
  }
}

async function reorderCardsInSameColumn(cardId, columnId, targetIndex) {
  try {
    const rawData = await getRawWorkspaceData(currentWorkspace.url_hash);
    let boardData = rawData.board_data || {};
    
    if (!boardData.card) boardData.card = {};
    
    const columnCards = Object.values(boardData.card).filter(c => c.columnId === columnId);
    columnCards.sort((a, b) => (a.index || 0) - (b.index || 0));
    
    const draggedIndex = columnCards.findIndex(c => c.id === cardId);
    if (draggedIndex === -1 || draggedIndex === targetIndex) return;
    
    const [movedCard] = columnCards.splice(draggedIndex, 1);
    // Корректируем targetIndex если элемент перемещается вперед
    const adjustedTarget = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
    columnCards.splice(adjustedTarget, 0, movedCard);
    
    columnCards.forEach((card, idx) => {
      if (boardData.card[card.id]) {
        boardData.card[card.id].index = idx;
      }
    });
    
    const saveResponse = await saveRawWorkspaceData(currentWorkspace.url_hash, boardData);
    
    if (saveResponse.success) {
      await renderKanban();
    }
  } catch (error) {
    console.error('Reorder cards error:', error);
  }
}

async function moveCardToAnotherColumn(cardId, fromColumnId, toColumnId, targetIndex) {
  try {
    const rawData = await getRawWorkspaceData(currentWorkspace.url_hash);
    let boardData = rawData.board_data || {};
    
    if (!boardData.card) boardData.card = {};
    
    // Обновляем колонку карточки
    if (boardData.card[cardId]) {
      boardData.card[cardId].columnId = toColumnId;
    }
    
    // Получаем карточки в целевой колонке
    let targetCards = Object.values(boardData.card).filter(c => c.columnId === toColumnId);
    targetCards.sort((a, b) => (a.index || 0) - (b.index || 0));
    
    // Находим карточку которую перемещаем
    const movedCard = boardData.card[cardId];
    
    // Удаляем карточку из исходной колонки
    let sourceCards = Object.values(boardData.card).filter(c => c.columnId === fromColumnId && c.id !== cardId);
    sourceCards.sort((a, b) => (a.index || 0) - (b.index || 0));
    
    // Вставляем карточку на нужную позицию в целевой колонке
    targetCards.splice(targetIndex, 0, movedCard);
    
    // Обновляем индексы в целевой колонке
    targetCards.forEach((card, idx) => {
      if (boardData.card[card.id]) {
        boardData.card[card.id].index = idx;
      }
    });
    
    // Обновляем индексы в исходной колонке
    sourceCards.forEach((card, idx) => {
      if (boardData.card[card.id]) {
        boardData.card[card.id].index = idx;
      }
    });
    
    const saveResponse = await saveRawWorkspaceData(currentWorkspace.url_hash, boardData);
    
    if (saveResponse.success) {
      await renderKanban();
    }
  } catch (error) {
    console.error('Move card error:', error);
  }
}

// ==================== DRAG & DROP ДЛЯ КОЛОНОК ====================
function setupColumnDragAndDrop() {
  const columnHeaders = document.querySelectorAll('.column-header');
  columnHeaders.forEach(header => {
    header.setAttribute('draggable', 'true');
    header.removeEventListener('dragstart', handleColumnDragStart);
    header.removeEventListener('dragend', handleColumnDragEnd);
    header.addEventListener('dragstart', handleColumnDragStart);
    header.addEventListener('dragend', handleColumnDragEnd);
  });
  
  const columnsWrapper = document.getElementById('columns-wrapper');
  if (columnsWrapper) {
    columnsWrapper.removeEventListener('dragover', handleColumnDragOver);
    columnsWrapper.removeEventListener('drop', handleColumnDrop);
    columnsWrapper.addEventListener('dragover', handleColumnDragOver);
    columnsWrapper.addEventListener('drop', handleColumnDrop);
  }
}

function handleColumnDragStart(e) {
  const column = e.target.closest('.column');
  if (!column) {
    e.preventDefault();
    return false;
  }
  draggedColumn = {
    id: column.dataset.columnId
  };
  e.dataTransfer.setData('text/plain', JSON.stringify(draggedColumn));
  e.target.style.opacity = '0.5';
  e.stopPropagation();
}

function handleColumnDragEnd(e) {
  if (e.target) {
    e.target.style.opacity = '';
  }
  draggedColumn = null;
}

function handleColumnDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

// Функция для определения позиции вставки колонки
function getColumnDropIndex(container, mouseX) {
  const columns = Array.from(container.querySelectorAll('.column'));
  
  for (let i = 0; i < columns.length; i++) {
    const rect = columns[i].getBoundingClientRect();
    const columnMiddle = rect.left + rect.width / 2;
    if (mouseX < columnMiddle) {
      return i;
    }
  }
  return columns.length;
}

async function handleColumnDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  
  const targetColumn = e.target.closest('.column');
  if (!targetColumn) return;
  
  const targetColumnId = targetColumn.dataset.columnId;
  let draggedData;
  try {
    draggedData = JSON.parse(e.dataTransfer.getData('text/plain'));
  } catch (err) {
    return;
  }
  
  if (!draggedData || draggedData.id === targetColumnId) return;
  
  const columnsWrapper = document.getElementById('columns-wrapper');
  const dropIndex = getColumnDropIndex(columnsWrapper, e.clientX);
  
  await reorderColumns(draggedData.id, dropIndex);
}

async function reorderColumns(draggedColumnId, targetIndex) {
  try {
    const rawData = await getRawWorkspaceData(currentWorkspace.url_hash);
    let boardData = rawData.board_data || {};
    
    if (!boardData.column) boardData.column = {};
    
    const columns = Object.values(boardData.column).filter(c => c.boardId === currentKanbanBoard.id);
    columns.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    const draggedIndex = columns.findIndex(c => c.id === draggedColumnId);
    if (draggedIndex === -1 || draggedIndex === targetIndex) return;
    
    const [movedColumn] = columns.splice(draggedIndex, 1);
    const adjustedTarget = draggedIndex < targetIndex ? targetIndex - 1 : targetIndex;
    columns.splice(adjustedTarget, 0, movedColumn);
    
    columns.forEach((col, idx) => {
      if (boardData.column[col.id]) {
        boardData.column[col.id].order = idx;
      }
    });
    
    const saveResponse = await saveRawWorkspaceData(currentWorkspace.url_hash, boardData);
    
    if (saveResponse.success) {
      await renderKanban();
    }
  } catch (error) {
    console.error('Reorder columns error:', error);
  }
}

// ==================== НАСТРОЙКИ ДОСКИ (МОДАЛЬНОЕ ОКНО) ====================
function showBoardEditModal() {
  if (!currentKanbanBoard) return;
  
  const nameInput = document.getElementById('kanban-board-edit-name-input');
  if (nameInput) nameInput.value = currentKanbanBoard.title;
  
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('kanban-board-edit-modal');
  if (overlay) overlay.classList.add('show');
  if (modal) modal.classList.add('show');
}

function closeBoardEditModalFunc() {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('kanban-board-edit-modal');
  if (overlay) overlay.classList.remove('show');
  if (modal) modal.classList.remove('show');
}

async function saveBoardEdit() {
  if (!currentKanbanBoard) return;
  
  const newTitle = document.getElementById('kanban-board-edit-name-input')?.value?.trim() || '';
  if (!newTitle) {
    alert('Введите название доски');
    return;
  }
  
  try {
    const rawData = await getRawWorkspaceData(currentWorkspace.url_hash);
    let boardData = rawData.board_data || {};
    
    if (!boardData.board) boardData.board = {};
    
    if (boardData.board[currentKanbanBoard.id]) {
      boardData.board[currentKanbanBoard.id].title = newTitle;
    }
    
    const saveResponse = await saveRawWorkspaceData(currentWorkspace.url_hash, boardData);
    
    if (saveResponse.success) {
      currentKanbanBoard.title = newTitle;
      await renderKanban();
      updateKanbanCarouselInfo();
      
      if (currentWorkspace.kanban_boards) {
        const boardIndex = currentWorkspace.kanban_boards.findIndex(b => b.id === currentKanbanBoard.id);
        if (boardIndex !== -1) {
          currentWorkspace.kanban_boards[boardIndex].title = newTitle;
        }
      }
      
      closeBoardEditModalFunc();
    } else {
      alert('Ошибка при обновлении названия');
    }
  } catch (error) {
    console.error('Update board title error:', error);
    alert('Ошибка при обновлении названия: ' + error.message);
  }
}

async function deleteBoardFromModal() {
  if (!currentKanbanBoard) return;
  
  if (confirm(`Удалить доску "${currentKanbanBoard.title}"? Все колонки и карточки будут удалены.`)) {
    await deleteKanbanBoardOnServer(currentWorkspace.url_hash, currentKanbanBoard.id);
    await loadKanbanBoardsIntoWorkspace();
    renderKanbanBoardsList();
    closeBoardEditModalFunc();
    showScreen('workspace-screen');
  }
}

// ==================== ОБРАБОТЧИКИ СОБЫТИЙ ====================
function setupEventListeners() {
  // Авторизация
  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) loginBtn.addEventListener('click', handleLogin);
  
  const showSignup = document.getElementById('show-signup');
  if (showSignup) showSignup.addEventListener('click', () => showScreen('signup-screen'));
  
  const backToLogin = document.getElementById('back-to-login');
  if (backToLogin) backToLogin.addEventListener('click', () => showScreen('login-screen'));
  
  const signupBtn = document.getElementById('signup-btn');
  if (signupBtn) signupBtn.addEventListener('click', handleSignup);
  
  const logoutFromProfile = document.getElementById('logout-from-profile');
  if (logoutFromProfile) logoutFromProfile.addEventListener('click', handleLogout);
  
  const logoutFromModal = document.getElementById('logout-from-modal');
  if (logoutFromModal) logoutFromModal.addEventListener('click', () => {
    const closeBtn = document.getElementById('close-profile-modal');
    if (closeBtn) closeBtn.click();
    handleLogout();
  });
  
  // Рабочие пространства
  const createWorkspaceBtn = document.getElementById('create-workspace-btn');
  if (createWorkspaceBtn) createWorkspaceBtn.addEventListener('click', () => showScreen('create-workspace-screen'));
  
  const backToWorkspaces = document.getElementById('back-to-workspaces');
  if (backToWorkspaces) backToWorkspaces.addEventListener('click', () => showScreen('profile-screen'));
  
  const confirmCreateWorkspace = document.getElementById('confirm-create-workspace');
  if (confirmCreateWorkspace) confirmCreateWorkspace.addEventListener('click', createNewWorkspace);
  
  const backToWorkspacesList = document.getElementById('back-to-workspaces-list');
  if (backToWorkspacesList) backToWorkspacesList.addEventListener('click', () => {
    showScreen('profile-screen');
    renderWorkspacesList();
  });
  
  // Канбан-доски
  const createKanbanBoardBtn = document.getElementById('create-kanban-board-btn');
  if (createKanbanBoardBtn) createKanbanBoardBtn.addEventListener('click', showCreateKanbanBoardModal);
  
  const confirmCreateKanbanBoard = document.getElementById('confirm-create-kanban-board');
  if (confirmCreateKanbanBoard) confirmCreateKanbanBoard.addEventListener('click', createNewKanbanBoard);
  
  const closeKanbanBoardModal = document.getElementById('close-kanban-board-modal');
  if (closeKanbanBoardModal) closeKanbanBoardModal.addEventListener('click', closeKanbanBoardModalFunc);
  
  // Редактирование доски (модальное окно)
  const workspaceSettingsFromBoard = document.getElementById('workspace-settings-from-board');
  if (workspaceSettingsFromBoard) workspaceSettingsFromBoard.addEventListener('click', showBoardEditModal);
  
  const closeBoardEditModal = document.getElementById('close-kanban-board-edit-modal');
  if (closeBoardEditModal) closeBoardEditModal.addEventListener('click', closeBoardEditModalFunc);
  
  const saveBoardEditBtn = document.getElementById('save-kanban-board-edit-btn');
  if (saveBoardEditBtn) saveBoardEditBtn.addEventListener('click', saveBoardEdit);
  
  const deleteBoardEditBtn = document.getElementById('delete-kanban-board-edit-btn');
  if (deleteBoardEditBtn) deleteBoardEditBtn.addEventListener('click', deleteBoardFromModal);
  
  // Канбан элементы
  const addColumnBtn = document.getElementById('add-column-btn');
  if (addColumnBtn) addColumnBtn.addEventListener('click', showCreateColumnModal);
  
  const workspaceSettingsBtn = document.getElementById('workspace-settings-btn');
  if (workspaceSettingsBtn) workspaceSettingsBtn.addEventListener('click', showWorkspaceSettings);
  
  const syncBoardBtn = document.getElementById('sync-board-btn');
  if (syncBoardBtn) syncBoardBtn.addEventListener('click', syncCurrentKanbanBoard);
  
  // Настройки рабочего пространства
  const saveWorkspaceSettingsBtn = document.getElementById('save-workspace-settings-btn');
  if (saveWorkspaceSettingsBtn) saveWorkspaceSettingsBtn.addEventListener('click', saveWorkspaceSettings);
  
  const deleteWorkspaceBtn = document.getElementById('delete-workspace-btn');
  if (deleteWorkspaceBtn) deleteWorkspaceBtn.addEventListener('click', deleteCurrentWorkspace);
  
  const closeWorkspaceSettingsModal = document.getElementById('close-workspace-settings-modal');
  if (closeWorkspaceSettingsModal) closeWorkspaceSettingsModal.addEventListener('click', closeWorkspaceSettingsModalFunc);
  
  // Карусель досок
  const prevKanbanBoard = document.getElementById('prev-kanban-board');
  if (prevKanbanBoard) prevKanbanBoard.addEventListener('click', prevKanbanBoardFunc);
  
  const nextKanbanBoard = document.getElementById('next-kanban-board');
  if (nextKanbanBoard) nextKanbanBoard.addEventListener('click', nextKanbanBoardFunc);
  
  // Кнопка назад из канбан-доски
  const backToWorkspace = document.getElementById('back-to-workspace');
  if (backToWorkspace) backToWorkspace.addEventListener('click', () => {
    showScreen('workspace-screen');
    renderKanbanBoardsList();
  });
  
  // Модальные окна колонок
  const closeColumnModal = document.getElementById('close-column-modal');
  if (closeColumnModal) closeColumnModal.addEventListener('click', closeColumnModalFunc);
  
  const saveColumnBtn = document.getElementById('save-column-btn');
  if (saveColumnBtn) saveColumnBtn.addEventListener('click', saveColumnFunc);
  
  const deleteColumnBtn = document.getElementById('delete-column-btn');
  if (deleteColumnBtn) deleteColumnBtn.addEventListener('click', deleteColumnFunc);
  
  // Модальные окна карточек
  const closeCardModal = document.getElementById('close-card-modal');
  if (closeCardModal) closeCardModal.addEventListener('click', closeCardModalFunc);
  
  const saveCardBtn = document.getElementById('save-card-btn');
  if (saveCardBtn) saveCardBtn.addEventListener('click', saveCardFunc);
  
  const deleteCardBtn = document.getElementById('delete-card-btn');
  if (deleteCardBtn) deleteCardBtn.addEventListener('click', deleteCardFunc);
  
  // Профиль
  const closeProfileModal = document.getElementById('close-profile-modal');
  if (closeProfileModal) closeProfileModal.addEventListener('click', closeProfileModalFunc);
  
  const userMenuBtn = document.getElementById('user-menu-btn');
  if (userMenuBtn) userMenuBtn.addEventListener('click', showProfileModalFunc);
  
  // Оверлей
  const modalOverlay = document.getElementById('modal-overlay');
  if (modalOverlay) modalOverlay.addEventListener('click', () => {
    closeColumnModalFunc();
    closeCardModalFunc();
    closeWorkspaceSettingsModalFunc();
    closeProfileModalFunc();
    closeKanbanBoardModalFunc();
    closeBoardEditModalFunc();
  });
}

// ==================== ЭКРАНЫ ====================
function showScreen(screenId) {
  const screens = document.querySelectorAll('.screen');
  screens.forEach(screen => {
    screen.classList.remove('active');
  });
  const screen = document.getElementById(screenId);
  if (screen) {
    screen.classList.add('active');
  }
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ СОБЫТИЙ ====================
function closeKanbanBoardModalFunc() {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('kanban-board-modal');
  if (overlay) overlay.classList.remove('show');
  if (modal) modal.classList.remove('show');
}

function closeColumnModalFunc() {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('column-modal');
  if (overlay) overlay.classList.remove('show');
  if (modal) modal.classList.remove('show');
  currentEditColumn = null;
}

function closeCardModalFunc() {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('card-modal');
  if (overlay) overlay.classList.remove('show');
  if (modal) modal.classList.remove('show');
  currentEditCard = null;
}

function closeWorkspaceSettingsModalFunc() {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('workspace-settings-modal');
  if (overlay) overlay.classList.remove('show');
  if (modal) modal.classList.remove('show');
}

function closeProfileModalFunc() {
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('profile-modal');
  if (overlay) overlay.classList.remove('show');
  if (modal) modal.classList.remove('show');
}

function showProfileModalFunc() {
  updateUserInfo();
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('profile-modal');
  if (overlay) overlay.classList.add('show');
  if (modal) modal.classList.add('show');
}

function saveColumnFunc() {
  saveColumn();
}

function deleteColumnFunc() {
  deleteColumn();
}

function saveCardFunc() {
  saveCard();
}

function deleteCardFunc() {
  deleteCard();
}

function prevKanbanBoardFunc() {
  prevKanbanBoard();
}

function nextKanbanBoardFunc() {
  nextKanbanBoard();
}

// ==================== СПИСОК РАБОЧИХ ПРОСТРАНСТВ ====================
function renderWorkspacesList() {
  const container = document.getElementById('workspaces-list');
  if (!container) return;
  
  if (!workspaces || workspaces.length === 0) {
    container.innerHTML = '<div class="empty-state">Нет рабочих пространств. Нажмите + чтобы создать</div>';
    return;
  }
  
  container.innerHTML = workspaces.map(workspace => `
    <div class="workspace-card" data-workspace-id="${workspace.id}" data-workspace-hash="${workspace.url_hash}">
      <div class="workspace-card-title">📁 ${escapeHtml(workspace.name)}</div>
      <div class="workspace-card-info">
        ${workspace.is_owner ? '👑 Владелец' : `👤 Доступ от ${escapeHtml(workspace.owner)}`}
        ${workspace.access_users?.length ? ` | 👥 ${workspace.access_users.length}` : ''}
      </div>
      <div class="workspace-card-date">${new Date(workspace.updated_at).toLocaleDateString()}</div>
    </div>
  `).join('');
  
  document.querySelectorAll('.workspace-card').forEach(card => {
    card.addEventListener('click', async () => {
      const workspaceId = parseInt(card.dataset.workspaceId);
      currentWorkspace = workspaces.find(w => w.id === workspaceId);
      if (currentWorkspace) {
        await loadKanbanBoardsIntoWorkspace();
        renderKanbanBoardsList();
        showScreen('workspace-screen');
      }
    });
  });
}

// ==================== СОЗДАНИЕ РАБОЧЕГО ПРОСТРАНСТВА ====================
async function createNewWorkspace() {
  const nameInput = document.getElementById('new-workspace-name');
  const title = nameInput?.value?.trim() || '';
  
  if (!title) {
    alert('Введите название рабочего пространства');
    return;
  }
  
  try {
    const result = await createWorkspaceOnServer(title);
    
    if (result) {
      if (nameInput) nameInput.value = '';
      await loadWorkspacesFromServer();
      renderWorkspacesList();
      showScreen('profile-screen');
    }
  } catch (error) {
    alert('Ошибка создания: ' + error.message);
  }
}

// ==================== КАНБАН-ДОСКИ ВНУТРИ ПРОСТРАНСТВА ====================
async function loadKanbanBoardsIntoWorkspace() {
  if (!currentWorkspace) return;
  
  try {
    const data = await loadKanbanBoardsFromServer(currentWorkspace.url_hash);
    currentWorkspace.kanban_boards = (data && data.kanban_boards) ? data.kanban_boards : [];
    await chrome.storage.local.set({ currentWorkspace: currentWorkspace });
  } catch (error) {
    console.error('Load kanban boards error:', error);
    currentWorkspace.kanban_boards = [];
  }
}

function renderKanbanBoardsList() {
  const container = document.getElementById('kanban-boards-list');
  const titleElement = document.getElementById('current-workspace-title');
  
  if (titleElement && currentWorkspace) {
    titleElement.textContent = currentWorkspace.name;
  }
  
  if (!container) return;
  
  const boards = (currentWorkspace && currentWorkspace.kanban_boards) ? currentWorkspace.kanban_boards : [];
  
  if (boards.length === 0) {
    container.innerHTML = '<div class="empty-state">Нет канбан-досок. Нажмите "+ Создать доску"</div>';
    return;
  }
  
  container.innerHTML = boards.map(board => `
    <div class="kanban-board-card" data-board-id="${board.id}">
      <div class="kanban-board-card-title">📋 ${escapeHtml(board.title)}</div>
      <div class="kanban-board-card-info">
        Колонок: ${(board.columns && board.columns.length) || 0}
      </div>
      <button class="delete-kanban-board-btn" data-board-id="${board.id}" title="Удалить доску">🗑️</button>
    </div>
  `).join('');
  
  document.querySelectorAll('.kanban-board-card').forEach(card => {
    card.addEventListener('click', async (e) => {
      if (e.target.classList.contains('delete-kanban-board-btn')) return;
      
      const boardId = card.dataset.boardId;
      currentKanbanBoard = boards.find(b => b.id === boardId);
      if (currentKanbanBoard) {
        await renderKanban();
        updateKanbanCarouselInfo();
        showScreen('kanban-screen');
      }
    });
  });
  
  document.querySelectorAll('.delete-kanban-board-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const boardId = btn.dataset.boardId;
      if (confirm('Удалить эту канбан-доску? Все данные будут потеряны.')) {
        await deleteKanbanBoardOnServer(currentWorkspace.url_hash, boardId);
        await loadKanbanBoardsIntoWorkspace();
        renderKanbanBoardsList();
      }
    });
  });
}

function showCreateKanbanBoardModal() {
  const nameInput = document.getElementById('kanban-board-name-input');
  if (nameInput) nameInput.value = '';
  
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('kanban-board-modal');
  if (overlay) overlay.classList.add('show');
  if (modal) modal.classList.add('show');
}

async function createNewKanbanBoard() {
  const title = document.getElementById('kanban-board-name-input')?.value?.trim() || '';
  
  if (!title) {
    alert('Введите название доски');
    return;
  }
  
  try {
    const result = await createKanbanBoardOnServer(currentWorkspace.url_hash, {
      title: title,
      x: 0,
      y: 0
    });
    
    if (result) {
      await loadKanbanBoardsIntoWorkspace();
      renderKanbanBoardsList();
      closeKanbanBoardModalFunc();
    }
  } catch (error) {
    alert('Ошибка создания: ' + error.message);
  }
}

// ==================== КАНБАН-ДОСКА (ВИЗУАЛИЗАЦИЯ) ====================
async function renderKanban() {
  if (!currentKanbanBoard) return;
  
  const titleElement = document.getElementById('current-kanban-board-title');
  if (titleElement) titleElement.textContent = currentKanbanBoard.title || 'Доска';
  
  try {
    const rawData = await getRawWorkspaceData(currentWorkspace.url_hash);
    const boardData = rawData.board_data || {};
    
    const boardsData = boardData.board || {};
    const columnsData = boardData.column || {};
    const cardsData = boardData.card || {};
    
    let filteredColumns = Object.values(columnsData).filter(col => col.boardId === currentKanbanBoard.id);
    filteredColumns.sort((a, b) => (a.order || 0) - (b.order || 0));
    
    const columns = filteredColumns.map(col => ({
      id: col.id,
      title: col.title,
      boardId: col.boardId,
      order: col.order || 0,
      cards: Object.values(cardsData)
        .filter(card => card.columnId === col.id)
        .map(card => ({
          id: card.id,
          title: card.title,
          content: card.content || '',
          columnId: card.columnId,
          index: card.index || 0
        }))
        .sort((a, b) => (a.index || 0) - (b.index || 0))
    }));
    
    currentKanbanBoard.columns = columns;
    
    if (currentWorkspace.kanban_boards) {
      const boardIndex = currentWorkspace.kanban_boards.findIndex(b => b.id === currentKanbanBoard.id);
      if (boardIndex !== -1) {
        currentWorkspace.kanban_boards[boardIndex].columns = columns;
      }
    }
    
  } catch (error) {
    console.error('Load board data error:', error);
  }
  
  const columns = currentKanbanBoard.columns || [];
  const wrapper = document.getElementById('columns-wrapper');
  
  if (!wrapper) return;
  
  if (columns.length === 0) {
    wrapper.innerHTML = '<div class="empty-state">Нет колонок. Нажмите "+ Добавить колонку"</div>';
    return;
  }
  
  wrapper.innerHTML = columns.map(column => `
    <div class="column" data-column-id="${column.id}">
      <div class="column-header" draggable="true" data-column-id="${column.id}">
        <span class="column-title">${escapeHtml(column.title)}</span>
        <button class="column-menu-btn" data-column-id="${column.id}">⋮</button>
      </div>
      <div class="column-cards" data-column-id="${column.id}">
        ${renderCards(column.cards || [], column.id)}
      </div>
      <button class="add-card-btn" data-column-id="${column.id}">+ Добавить карточку</button>
    </div>
  `).join('');
  
  setupCardDragAndDrop();
  setupColumnDragAndDrop();
  
  document.querySelectorAll('.column-menu-btn').forEach(btn => {
    btn.removeEventListener('click', handleColumnMenuClick);
    btn.addEventListener('click', handleColumnMenuClick);
  });
  
  document.querySelectorAll('.add-card-btn').forEach(btn => {
    btn.removeEventListener('click', handleAddCardClick);
    btn.addEventListener('click', handleAddCardClick);
  });
}

function handleColumnMenuClick(e) {
  e.stopPropagation();
  const columnId = e.currentTarget.dataset.columnId;
  const columns = currentKanbanBoard.columns || [];
  const column = columns.find(c => c.id === columnId);
  if (column) showColumnModal(column);
}

function handleAddCardClick(e) {
  e.stopPropagation();
  const columnId = e.currentTarget.dataset.columnId;
  showCreateNoteModal(columnId);
}

function renderCards(cards, columnId) {
  if (!cards || cards.length === 0) {
    return '<div class="empty-cards">Нет карточек</div>';
  }
  
  const sortedCards = [...cards].sort((a, b) => (a.index || 0) - (b.index || 0));
  
  return sortedCards.map(card => `
    <div class="card" draggable="true" data-card-id="${card.id}" data-column-id="${columnId}">
      <div class="card-title">${escapeHtml(card.title || 'Без названия')}</div>
      <div class="card-content">${escapeHtml((card.content || '').substring(0, 80))}${(card.content || '').length > 80 ? '...' : ''}</div>
    </div>
  `).join('');
}

function updateKanbanCarouselInfo() {
  if (!currentWorkspace || !currentKanbanBoard) return;
  
  const boards = currentWorkspace.kanban_boards || [];
  const currentIndex = boards.findIndex(b => b.id === currentKanbanBoard.id);
  const carouselName = document.getElementById('kanban-carousel-name');
  
  if (carouselName && boards.length > 0) {
    carouselName.textContent = `${currentIndex + 1} / ${boards.length} • ${currentKanbanBoard.title}`;
  }
}

function prevKanbanBoard() {
  if (!currentWorkspace || !currentKanbanBoard) return;
  
  const boards = currentWorkspace.kanban_boards || [];
  const currentIndex = boards.findIndex(b => b.id === currentKanbanBoard.id);
  
  if (currentIndex > 0) {
    currentKanbanBoard = boards[currentIndex - 1];
    renderKanban();
    updateKanbanCarouselInfo();
  }
}

function nextKanbanBoard() {
  if (!currentWorkspace || !currentKanbanBoard) return;
  
  const boards = currentWorkspace.kanban_boards || [];
  const currentIndex = boards.findIndex(b => b.id === currentKanbanBoard.id);
  
  if (currentIndex < boards.length - 1) {
    currentKanbanBoard = boards[currentIndex + 1];
    renderKanban();
    updateKanbanCarouselInfo();
  }
}

async function syncCurrentKanbanBoard() {
  if (!currentWorkspace || !currentKanbanBoard) return;
  
  const syncBtn = document.getElementById('sync-board-btn');
  if (!syncBtn) return;
  
  const originalText = syncBtn.textContent;
  syncBtn.textContent = '⏳ Синхронизация...';
  syncBtn.disabled = true;
  
  try {
    await loadKanbanBoardsIntoWorkspace();
    const updatedBoard = currentWorkspace.kanban_boards.find(b => b.id === currentKanbanBoard.id);
    if (updatedBoard) {
      currentKanbanBoard = updatedBoard;
      renderKanban();
      alert('Доска синхронизирована');
    }
  } catch (error) {
    alert('Ошибка синхронизации');
  } finally {
    syncBtn.textContent = originalText;
    syncBtn.disabled = false;
  }
}

// ==================== НАСТРОЙКИ РАБОЧЕГО ПРОСТРАНСТВА ====================
function showWorkspaceSettings() {
  const nameInput = document.getElementById('workspace-settings-name');
  if (nameInput && currentWorkspace) nameInput.value = currentWorkspace.name;
  
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('workspace-settings-modal');
  if (overlay) overlay.classList.add('show');
  if (modal) modal.classList.add('show');
}

async function saveWorkspaceSettings() {
  const newName = document.getElementById('workspace-settings-name')?.value?.trim() || '';
  if (newName) {
    await updateWorkspaceOnServer(currentWorkspace.id, { name: newName });
    await loadWorkspacesFromServer();
    currentWorkspace = workspaces.find(w => w.id === currentWorkspace.id);
    const titleElement = document.getElementById('current-workspace-title');
    if (titleElement) titleElement.textContent = currentWorkspace.name;
    renderKanbanBoardsList();
    closeWorkspaceSettingsModalFunc();
  }
}

async function deleteCurrentWorkspace() {
  if (confirm(`Удалить рабочее пространство "${currentWorkspace.name}"? Все доски внутри будут удалены.`)) {
    await deleteWorkspaceOnServer(currentWorkspace.id);
    await loadWorkspacesFromServer();
    
    if (workspaces.length > 0) {
      currentWorkspace = workspaces[0];
      await loadKanbanBoardsIntoWorkspace();
      renderKanbanBoardsList();
    } else {
      showScreen('profile-screen');
      renderWorkspacesList();
      currentWorkspace = null;
    }
    closeWorkspaceSettingsModalFunc();
  }
}

// ==================== КОЛОНКИ ====================
function showCreateColumnModal() {
  currentEditColumn = null;
  const titleElem = document.getElementById('column-modal-title');
  const nameInput = document.getElementById('column-name-input');
  const deleteBtn = document.getElementById('delete-column-btn');
  
  if (titleElem) titleElem.textContent = 'Новая колонка';
  if (nameInput) nameInput.value = '';
  if (deleteBtn) deleteBtn.style.display = 'none';
  
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('column-modal');
  if (overlay) overlay.classList.add('show');
  if (modal) modal.classList.add('show');
}

function showColumnModal(column) {
  currentEditColumn = column;
  const titleElem = document.getElementById('column-modal-title');
  const nameInput = document.getElementById('column-name-input');
  const deleteBtn = document.getElementById('delete-column-btn');
  
  if (titleElem) titleElem.textContent = 'Редактирование колонки';
  if (nameInput) nameInput.value = column.title;
  if (deleteBtn) deleteBtn.style.display = 'block';
  
  const overlay = document.getElementById('modal-overlay');
  const modal = document.getElementById('column-modal');
  if (overlay) overlay.classList.add('show');
  if (modal) modal.classList.add('show');
}

async function saveColumn() {
  const name = document.getElementById('column-name-input')?.value?.trim() || '';
  if (!name) {
    alert('Введите название колонки');
    return;
  }
  
  if (!currentWorkspace || !currentKanbanBoard) {
    alert('Ошибка: не выбрано рабочее пространство или доска');
    return;
  }
  
  try {
    const rawData = await getRawWorkspaceData(currentWorkspace.url_hash);
    let boardData = rawData.board_data || {};
    
    if (!boardData.board) boardData.board = {};
    if (!boardData.column) boardData.column = {};
    if (!boardData.card) boardData.card = {};
    
    if (currentEditColumn) {
      if (boardData.column[currentEditColumn.id]) {
        boardData.column[currentEditColumn.id].title = name;
      }
    } else {
      const columnId = await generateIdOnServer(currentWorkspace.url_hash, 'column');
      
      const existingColumns = Object.values(boardData.column).filter(c => c.boardId === currentKanbanBoard.id);
      const maxOrder = existingColumns.length;
      
      boardData.column[columnId] = {
        id: columnId,
        title: name,
        boardId: currentKanbanBoard.id,
        order: maxOrder
      };
    }
    
    const saveResponse = await saveRawWorkspaceData(currentWorkspace.url_hash, boardData);
    
    if (saveResponse.success) {
      await renderKanban();
      closeColumnModalFunc();
    } else {
      alert('Ошибка при сохранении колонки: ' + (saveResponse.error || 'Неизвестная ошибка'));
    }
  } catch (error) {
    console.error('Save column error:', error);
    alert('Ошибка при сохранении колонки: ' + error.message);
  }
}

async function deleteColumn() {
  if (!currentEditColumn) return;
  
  if (confirm(`Удалить колонку "${currentEditColumn.title}"? Все карточки в ней будут удалены.`)) {
    if (!currentWorkspace || !currentKanbanBoard) {
      alert('Ошибка: не выбрано рабочее пространство или доска');
      return;
    }
    
    try {
      const rawData = await getRawWorkspaceData(currentWorkspace.url_hash);
      let boardData = rawData.board_data || {};
      
      if (!boardData.column) boardData.column = {};
      if (!boardData.card) boardData.card = {};
      
      const cardsToDelete = Object.keys(boardData.card).filter(cardId => 
        boardData.card[cardId] && boardData.card[cardId].columnId === currentEditColumn.id
      );
      for (const cardId of cardsToDelete) {
        delete boardData.card[cardId];
      }
      
      delete boardData.column[currentEditColumn.id];
      
      const saveResponse = await saveRawWorkspaceData(currentWorkspace.url_hash, boardData);
      
      if (saveResponse.success) {
        const remainingColumns = Object.values(boardData.column || {}).filter(col => col.boardId === currentKanbanBoard.id);
        
        if (remainingColumns.length === 0) {
          await deleteKanbanBoardOnServer(currentWorkspace.url_hash, currentKanbanBoard.id);
          await loadKanbanBoardsIntoWorkspace();
          renderKanbanBoardsList();
          showScreen('workspace-screen');
          closeColumnModalFunc();
          return;
        }
        
        await renderKanban();
        closeColumnModalFunc();
      } else {
        alert('Ошибка при удалении колонки: ' + (saveResponse.error || 'Неизвестная ошибка'));
      }
    } catch (error) {
      console.error('Delete column error:', error);
      alert('Ошибка при удалении колонки: ' + error.message);
    }
  }
}

// ==================== КАРТОЧКИ ====================
function showCreateNoteModal(columnId) {
  currentEditCard = null;
  const titleElem = document.getElementById('card-modal-title');
  const titleInput = document.getElementById('card-title-input');
  const contentInput = document.getElementById('card-content-input');
  const deleteBtn = document.getElementById('delete-card-btn');
  
  if (titleElem) titleElem.textContent = 'Новая заметка';
  if (titleInput) titleInput.value = '';
  if (contentInput) contentInput.value = '';
  if (deleteBtn) deleteBtn.style.display = 'none';
  
  const modal = document.getElementById('card-modal');
  if (modal) modal.dataset.targetColumnId = columnId;
  
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.add('show');
  if (modal) modal.classList.add('show');
}

function showCardModal(card, columnId) {
  currentEditCard = card;
  const titleElem = document.getElementById('card-modal-title');
  const titleInput = document.getElementById('card-title-input');
  const contentInput = document.getElementById('card-content-input');
  const deleteBtn = document.getElementById('delete-card-btn');
  
  if (titleElem) titleElem.textContent = 'Редактирование';
  if (titleInput) titleInput.value = card.title || '';
  if (contentInput) contentInput.value = card.content || '';
  if (deleteBtn) deleteBtn.style.display = 'block';
  
  const modal = document.getElementById('card-modal');
  if (modal) modal.dataset.targetColumnId = columnId;
  
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.add('show');
  if (modal) modal.classList.add('show');
}

async function saveCard() {
  const title = document.getElementById('card-title-input')?.value?.trim() || '';
  const content = document.getElementById('card-content-input')?.value || '';
  const targetColumnId = document.getElementById('card-modal')?.dataset.targetColumnId;
  
  if (!targetColumnId) {
    alert('Ошибка: колонка не найдена');
    return;
  }
  
  if (!currentWorkspace || !currentKanbanBoard) {
    alert('Ошибка: не выбрано рабочее пространство или доска');
    return;
  }
  
  try {
    const rawData = await getRawWorkspaceData(currentWorkspace.url_hash);
    let boardData = rawData.board_data || {};
    
    if (!boardData.card) boardData.card = {};
    
    if (currentEditCard) {
      if (boardData.card[currentEditCard.id]) {
        boardData.card[currentEditCard.id].title = title || 'Без названия';
        boardData.card[currentEditCard.id].content = content;
      }
    } else {
      const cardId = await generateIdOnServer(currentWorkspace.url_hash, 'card');
      
      const existingCards = Object.values(boardData.card).filter(c => c.columnId === targetColumnId);
      
      boardData.card[cardId] = {
        id: cardId,
        title: title || 'Новая заметка',
        content: content,
        columnId: targetColumnId,
        index: existingCards.length
      };
    }
    
    const saveResponse = await saveRawWorkspaceData(currentWorkspace.url_hash, boardData);
    
    if (saveResponse.success) {
      await renderKanban();
      closeCardModalFunc();
    } else {
      alert('Ошибка при сохранении карточки: ' + (saveResponse.error || 'Неизвестная ошибка'));
    }
  } catch (error) {
    console.error('Save card error:', error);
    alert('Ошибка при сохранении карточки: ' + error.message);
  }
}

async function deleteCard() {
  if (!currentEditCard) return;
  
  if (confirm('Удалить заметку?')) {
    if (!currentWorkspace || !currentKanbanBoard) {
      alert('Ошибка: не выбрано рабочее пространство или доска');
      return;
    }
    
    try {
      const rawData = await getRawWorkspaceData(currentWorkspace.url_hash);
      let boardData = rawData.board_data || {};
      
      if (!boardData.card) boardData.card = {};
      
      delete boardData.card[currentEditCard.id];
      
      const saveResponse = await saveRawWorkspaceData(currentWorkspace.url_hash, boardData);
      
      if (saveResponse.success) {
        await renderKanban();
        closeCardModalFunc();
      } else {
        alert('Ошибка при удалении карточки: ' + (saveResponse.error || 'Неизвестная ошибка'));
      }
    } catch (error) {
      console.error('Delete card error:', error);
      alert('Ошибка при удалении карточки: ' + error.message);
    }
  }
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}