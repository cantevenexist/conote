// ==================== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
let boards = [];
let currentBoard = null;
let currentEditColumn = null;
let currentEditCard = null;

// Для drag-and-drop
let draggedColumnId = null;
let draggedCardId = null;
let sourceColumnId = null;
let isDraggingCard = false;
let isDraggingColumn = false;

// Для визуального отображения
let dragOverColumnId = null;
let placeholderElement = null;
// ==================== РЕСАЙЗ ОКНА ====================
let isResizing = false;
let startX, startY, startWidth, startHeight;

function initResize() {
  const resizeHandle = document.getElementById('resize-handle');
  if (!resizeHandle) return;
  
  resizeHandle.addEventListener('mousedown', startResize);
  document.addEventListener('mousemove', doResize);
  document.addEventListener('mouseup', stopResize);
}

function startResize(e) {
  e.preventDefault();
  e.stopPropagation();
  isResizing = true;
  
  startX = e.clientX;
  startY = e.clientY;
  startWidth = document.body.clientWidth;
  startHeight = document.body.clientHeight;
  
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'se-resize';
}

function doResize(e) {
  if (!isResizing) return;
  
  const newWidth = startWidth + (e.clientX - startX);
  const newHeight = startHeight + (e.clientY - startY);
  
  // Минимальные размеры
  const minWidth = 550;
  const minHeight = 450;
  
  // Максимальные размеры (опционально)
  const maxWidth = 1200;
  const maxHeight = 800;
  
  const finalWidth = Math.min(maxWidth, Math.max(minWidth, newWidth));
  const finalHeight = Math.min(maxHeight, Math.max(minHeight, newHeight));
  
  document.body.style.width = finalWidth + 'px';
  document.body.style.height = finalHeight + 'px';
}

function stopResize() {
  isResizing = false;
  document.body.style.userSelect = '';
  document.body.style.cursor = '';
  
  // Сохраняем размер для следующего открытия
  chrome.storage.local.set({
    windowWidth: document.body.clientWidth,
    windowHeight: document.body.clientHeight
  });
}

// ==================== ИНИЦИАЛИЗАЦИЯ ====================
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  renderBoardsList();
  showScreen('boards-screen');
  setupEventListeners();
});

// ==================== РАБОТА С ХРАНИЛИЩЕМ ====================
async function loadData() {
  const result = await chrome.storage.local.get(['boards']);
  boards = result.boards || [];
}

async function saveData() {
  await chrome.storage.local.set({ boards: boards });
}

async function getCurrentBoardId() {
  const result = await chrome.storage.local.get(['currentBoardId']);
  return result.currentBoardId;
}

async function setCurrentBoardId(boardId) {
  await chrome.storage.local.set({ currentBoardId: boardId });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ==================== ОБРАБОТЧИКИ СОБЫТИЙ ====================
function setupEventListeners() {
  document.getElementById('create-board-btn')?.addEventListener('click', () => showScreen('create-board-screen'));
  document.getElementById('back-to-boards')?.addEventListener('click', () => showScreen('boards-screen'));
  document.getElementById('back-to-boards-list')?.addEventListener('click', () => {
    showScreen('boards-screen');
    renderBoardsList();
  });
  
  document.getElementById('confirm-create-board')?.addEventListener('click', createNewBoard);
  document.getElementById('add-column-btn')?.addEventListener('click', showCreateColumnModal);
  
  document.getElementById('board-settings-btn')?.addEventListener('click', showBoardSettings);
  document.getElementById('save-settings-btn')?.addEventListener('click', saveBoardSettings);
  document.getElementById('delete-board-btn')?.addEventListener('click', deleteCurrentBoard);
  document.getElementById('close-settings-modal')?.addEventListener('click', closeSettingsModal);
  
  document.getElementById('prev-board-carousel')?.addEventListener('click', prevBoard);
  document.getElementById('next-board-carousel')?.addEventListener('click', nextBoard);
    
  document.getElementById('close-column-modal')?.addEventListener('click', closeColumnModal);
  document.getElementById('save-column-btn')?.addEventListener('click', saveColumn);
  document.getElementById('delete-column-btn')?.addEventListener('click', deleteColumn);
  
  document.getElementById('close-card-modal')?.addEventListener('click', closeCardModal);
  document.getElementById('save-card-btn')?.addEventListener('click', saveCard);
  document.getElementById('delete-card-btn')?.addEventListener('click', deleteCard);
  
  document.getElementById('modal-overlay')?.addEventListener('click', () => {
    closeColumnModal();
    closeCardModal();
    closeSettingsModal();
  });
}

// ==================== ЭКРАНЫ ====================
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
  document.getElementById(screenId).classList.add('active');
}

// ==================== СПИСОК ДОСОК ====================
function renderBoardsList() {
  const container = document.getElementById('boards-list');
  
  if (boards.length === 0) {
    container.innerHTML = '<div class="empty-state">Нет досок. Нажмите + чтобы создать</div>';
    return;
  }
  
  container.innerHTML = boards.map(board => `
    <div class="board-card" data-board-id="${board.id}">
      <div class="board-card-title">${escapeHtml(board.title)}</div>
      <div class="board-card-info">${board.columns?.length || 0} колонок</div>
    </div>
  `).join('');
  
  document.querySelectorAll('.board-card').forEach(card => {
    card.addEventListener('click', async () => {
      const boardId = card.dataset.boardId;
      currentBoard = boards.find(b => b.id === boardId);
      await setCurrentBoardId(boardId);
      renderKanban();
      showScreen('kanban-screen');
    });
  });
}

// ==================== СОЗДАНИЕ ДОСКИ ====================
async function createNewBoard() {
  const nameInput = document.getElementById('new-board-name');
  const title = nameInput.value.trim();
  
  if (!title) {
    alert('Введите название доски');
    return;
  }
  
  // Создаем колонку "Колонка 1" автоматически
  const defaultColumn = {
    id: generateId(),
    title: 'Колонка 1',
    index: 0,
    cards: []
  };
  
  const newBoard = {
    id: generateId(),
    title: title,
    createdAt: Date.now(),
    columns: [defaultColumn]  // Добавляем колонку по умолчанию
  };
  
  boards.push(newBoard);
  await saveData();
  
  nameInput.value = '';
  
  currentBoard = newBoard;
  await setCurrentBoardId(newBoard.id);
  renderBoardsList();
  renderKanban();
  showScreen('kanban-screen');
}

// ==================== КАНБАН-ДОСКА ====================
function renderKanban() {
  if (!currentBoard) return;
  
  // Проверяем, не пустая ли доска
  if (currentBoard.columns.length === 0) {
    checkAndDeleteEmptyBoard();
    return;
  }
  
  document.getElementById('current-board-title').textContent = currentBoard.title;
  
  const carousel = document.getElementById('board-carousel');
  if (boards.length > 1) {
    carousel.style.display = 'flex';
    updateCarouselInfo();
  } else {
    carousel.style.display = 'none';
  }
  
  const wrapper = document.getElementById('columns-wrapper');
  
  if (!currentBoard.columns || currentBoard.columns.length === 0) {
    wrapper.innerHTML = '<div class="empty-state">Нет колонок. Нажмите "+ Добавить колонку"</div>';
    return;
  }
  
  const sortedColumns = [...currentBoard.columns].sort((a, b) => a.index - b.index);
  
  wrapper.innerHTML = sortedColumns.map(column => `
    <div class="column" data-column-id="${column.id}" data-column-index="${column.index}">
      <div class="column-header" draggable="true" data-column-id="${column.id}">
        <span class="column-title">${escapeHtml(column.title)}</span>
        <button class="column-menu-btn" data-column-id="${column.id}">⋮</button>
      </div>
      <div class="column-cards" data-column-id="${column.id}">
        ${renderCards(column.cards, column.id)}
      </div>
      <button class="add-card-btn" data-column-id="${column.id}">+ Добавить карточку</button>
    </div>
  `).join('');
  
  // Обработчики для колонок
  document.querySelectorAll('.column-header').forEach(header => {
    header.addEventListener('dragstart', handleColumnDragStart);
    header.addEventListener('dragend', handleColumnDragEnd);
    header.addEventListener('dragover', handleColumnDragOver);
    header.addEventListener('dragenter', handleColumnDragEnter);
    header.addEventListener('dragleave', handleColumnDragLeave);
  });
  
  document.querySelectorAll('.column-menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const columnId = btn.dataset.columnId;
      const column = currentBoard.columns.find(c => c.id === columnId);
      if (column) showColumnModal(column);
    });
  });
  
  document.querySelectorAll('.add-card-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const columnId = btn.dataset.columnId;
      showCreateNoteModal(columnId);
    });
  });
  
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      const cardId = card.dataset.cardId;
      const columnId = card.dataset.columnId;
      const column = currentBoard.columns.find(c => c.id === columnId);
      const cardData = column?.cards.find(c => c.id === cardId);
      if (cardData) showCardModal(cardData, columnId);
    });
  });
  
  setupCardDragAndDrop();
}

function renderCards(cards, columnId) {
  if (!cards || cards.length === 0) {
    return '<div class="empty-cards">Нет карточек</div>';
  }
  
  const sortedCards = [...cards].sort((a, b) => a.index - b.index);
  
  return sortedCards.map(card => `
    <div class="card" draggable="true" data-card-id="${card.id}" data-column-id="${columnId}" data-card-index="${card.index}">
      <div class="card-title">${escapeHtml(card.title || 'Без названия')}</div>
      <div class="card-content">${escapeHtml(card.content?.substring(0, 80) || '')}${card.content?.length > 80 ? '...' : ''}</div>
      <div class="card-date">${new Date(card.updatedAt || card.createdAt).toLocaleDateString()}</div>
    </div>
  `).join('');
}

// ==================== DRAG-AND-DROP ДЛЯ КОЛОНОК ====================
function handleColumnDragStart(e) {
  const header = e.target.closest('.column-header');
  if (!header) {
    e.preventDefault();
    return false;
  }
  
  const column = header.closest('.column');
  if (!column) {
    e.preventDefault();
    return false;
  }
  
  draggedColumnId = column.dataset.columnId;
  isDraggingColumn = true;
  isDraggingCard = false;
  
  e.dataTransfer.setData('text/plain', `column:${draggedColumnId}`);
  e.dataTransfer.effectAllowed = 'move';
  
  // Визуальный эффект - только прозрачность, без подсветки
  column.style.opacity = '0.4';
}

function handleColumnDragEnd(e) {
  const column = document.querySelector(`.column[data-column-id="${draggedColumnId}"]`);
  if (column) {
    column.style.opacity = '';
  }
  
  draggedColumnId = null;
  isDraggingColumn = false;
  dragOverColumnId = null;
}

function handleColumnDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleColumnDragEnter(e) {
  e.preventDefault();
  // Ничего не делаем, убираем подсветку
}

function handleColumnDragLeave(e) {
  // Ничего не делаем
}

// ==================== ОБРАБОТЧИК DROP ДЛЯ КОЛОНОК ====================
function setupColumnDropHandler() {
  const columnsWrapper = document.getElementById('columns-wrapper');
  
  columnsWrapper.removeEventListener('drop', handleColumnsWrapperDrop);
  columnsWrapper.addEventListener('drop', handleColumnsWrapperDrop);
}

function handleColumnsWrapperDrop(e) {
  e.preventDefault();
  
  if (!isDraggingColumn || !draggedColumnId) return;
  
  // Находим целевую колонку под курсором
  const targetColumn = e.target.closest('.column');
  if (!targetColumn) return;
  
  const targetColumnId = targetColumn.dataset.columnId;
  if (draggedColumnId === targetColumnId) return;
  
  // Находим индексы
  const draggedIndex = currentBoard.columns.findIndex(c => c.id === draggedColumnId);
  const targetIndex = currentBoard.columns.findIndex(c => c.id === targetColumnId);
  
  if (draggedIndex === -1 || targetIndex === -1) return;
  
  // Перемещаем колонку
  const [draggedColumn] = currentBoard.columns.splice(draggedIndex, 1);
  currentBoard.columns.splice(targetIndex, 0, draggedColumn);
  
  // Обновляем индексы
  currentBoard.columns.forEach((col, idx) => col.index = idx);
  
  saveData();
  renderKanban();
}

// ==================== DRAG-AND-DROP ДЛЯ КАРТОЧЕК ====================
function setupCardDragAndDrop() {
  const cards = document.querySelectorAll('.card');
  const columnsContainers = document.querySelectorAll('.column-cards');
  
  cards.forEach(card => {
    card.removeEventListener('dragstart', handleCardDragStart);
    card.removeEventListener('dragend', handleCardDragEnd);
    card.addEventListener('dragstart', handleCardDragStart);
    card.addEventListener('dragend', handleCardDragEnd);
  });
  
  columnsContainers.forEach(container => {
    container.removeEventListener('dragover', handleCardDragOver);
    container.removeEventListener('drop', handleCardDrop);
    container.addEventListener('dragover', handleCardDragOver);
    container.addEventListener('drop', handleCardDrop);
  });
}

function handleCardDragStart(e) {
  const card = e.target.closest('.card');
  if (!card) {
    e.preventDefault();
    return false;
  }
  
  draggedCardId = card.dataset.cardId;
  sourceColumnId = card.dataset.columnId;
  isDraggingCard = true;
  isDraggingColumn = false;
  
  e.dataTransfer.setData('text/plain', `card:${draggedCardId}`);
  e.dataTransfer.effectAllowed = 'move';
  card.style.opacity = '0.4';
}

function handleCardDragEnd(e) {
  const card = document.querySelector(`.card[data-card-id="${draggedCardId}"]`);
  if (card) card.style.opacity = '';
  draggedCardId = null;
  sourceColumnId = null;
  isDraggingCard = false;
}

function handleCardDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleCardDrop(e) {
  e.preventDefault();
  
  if (!isDraggingCard || !draggedCardId || !sourceColumnId) return;
  
  const targetCardsContainer = e.target.closest('.column-cards');
  if (!targetCardsContainer) return;
  
  const targetColumnId = targetCardsContainer.dataset.columnId;
  
  const sourceColumn = currentBoard.columns.find(c => c.id === sourceColumnId);
  const targetColumn = currentBoard.columns.find(c => c.id === targetColumnId);
  
  if (!sourceColumn || !targetColumn) return;
  
  const cardIndex = sourceColumn.cards.findIndex(c => c.id === draggedCardId);
  if (cardIndex === -1) return;
  
  const [draggedCard] = sourceColumn.cards.splice(cardIndex, 1);
  
  // Определяем позицию вставки
  const rect = targetCardsContainer.getBoundingClientRect();
  const mouseY = e.clientY;
  const relativeY = mouseY - rect.top;
  
  const targetCards = targetColumn.cards;
  let insertIndex = targetCards.length;
  
  const cardElements = targetCardsContainer.querySelectorAll('.card');
  for (let i = 0; i < cardElements.length; i++) {
    const cardRect = cardElements[i].getBoundingClientRect();
    const cardMiddle = cardRect.top + cardRect.height / 2;
    if (mouseY < cardMiddle) {
      insertIndex = i;
      break;
    }
  }
  
  targetColumn.cards.splice(insertIndex, 0, draggedCard);
  
  sourceColumn.cards.forEach((card, idx) => card.index = idx);
  targetColumn.cards.forEach((card, idx) => card.index = idx);
  
  saveData();
  renderKanban();
}

// ==================== КАРУСЕЛЬ ДОСОК ====================
function updateCarouselInfo() {
  const currentIndex = boards.findIndex(b => b.id === currentBoard.id);
  const carouselName = document.getElementById('carousel-board-name');
  carouselName.textContent = `${currentIndex + 1} / ${boards.length} • ${currentBoard.title}`;
}

function prevBoard() {
  const currentIndex = boards.findIndex(b => b.id === currentBoard.id);
  if (currentIndex > 0) {
    currentBoard = boards[currentIndex - 1];
    setCurrentBoardId(currentBoard.id);
    renderKanban();
    updateCarouselInfo();
  }
}

function nextBoard() {
  const currentIndex = boards.findIndex(b => b.id === currentBoard.id);
  if (currentIndex < boards.length - 1) {
    currentBoard = boards[currentIndex + 1];
    setCurrentBoardId(currentBoard.id);
    renderKanban();
    updateCarouselInfo();
  }
}

// ==================== КОЛОНКИ ====================
function showCreateColumnModal() {
  currentEditColumn = null;
  document.getElementById('column-modal-title').textContent = 'Новая колонка';
  document.getElementById('column-name-input').value = '';
  document.getElementById('delete-column-btn').style.display = 'none';
  document.getElementById('modal-overlay').classList.add('show');
  document.getElementById('column-modal').classList.add('show');
}

function showColumnModal(column) {
  currentEditColumn = column;
  document.getElementById('column-modal-title').textContent = 'Редактирование колонки';
  document.getElementById('column-name-input').value = column.title;
  document.getElementById('delete-column-btn').style.display = 'block';
  document.getElementById('modal-overlay').classList.add('show');
  document.getElementById('column-modal').classList.add('show');
}

function saveColumn() {
  const name = document.getElementById('column-name-input').value.trim();
  if (!name) {
    alert('Введите название колонки');
    return;
  }
  
  if (currentEditColumn) {
    currentEditColumn.title = name;
  } else {
    const newColumn = {
      id: generateId(),
      title: name,
      index: currentBoard.columns.length,
      cards: []
    };
    currentBoard.columns.push(newColumn);
  }
  
  saveData();
  renderKanban();
  closeColumnModal();
}

function deleteColumn() {
  if (!currentEditColumn) return;
  
  if (confirm(`Удалить колонку "${currentEditColumn.title}"? Все карточки в ней будут удалены.`)) {
    currentBoard.columns = currentBoard.columns.filter(c => c.id !== currentEditColumn.id);
    currentBoard.columns.forEach((col, idx) => col.index = idx);
    
    // Проверяем: если колонок не осталось, удаляем доску
    if (currentBoard.columns.length === 0) {
      const boardIndex = boards.findIndex(b => b.id === currentBoard.id);
      if (boardIndex !== -1) {
        boards.splice(boardIndex, 1);
        
        if (boards.length > 0) {
          currentBoard = boards[0];
          setCurrentBoardId(currentBoard.id);
          renderKanban();
        } else {
          showScreen('boards-screen');
          renderBoardsList();
          currentBoard = null;
        }
        
        saveData();
        closeColumnModal();
        return;
      }
    }
    
    saveData();
    renderKanban();
    closeColumnModal();
  }
}

function closeColumnModal() {
  document.getElementById('modal-overlay').classList.remove('show');
  document.getElementById('column-modal').classList.remove('show');
  currentEditColumn = null;
}

// ==================== ПРОВЕРКА И УДАЛЕНИЕ ПУСТОЙ ДОСКИ ====================
function checkAndDeleteEmptyBoard() {
  if (currentBoard && currentBoard.columns.length === 0) {
    const boardIndex = boards.findIndex(b => b.id === currentBoard.id);
    if (boardIndex !== -1) {
      boards.splice(boardIndex, 1);
      
      if (boards.length > 0) {
        currentBoard = boards[0];
        setCurrentBoardId(currentBoard.id);
        renderKanban();
      } else {
        showScreen('boards-screen');
        renderBoardsList();
        currentBoard = null;
      }
      
      saveData();
    }
  }
}

// ==================== КАРТОЧКИ ====================
function showCreateNoteModal(columnId = null) {
  currentEditCard = null;
  document.getElementById('card-modal-title').textContent = 'Новая заметка';
  document.getElementById('card-title-input').value = '';
  document.getElementById('card-content-input').value = '';
  document.getElementById('delete-card-btn').style.display = 'none';
  
  let targetColumnId = columnId;
  if (!targetColumnId && currentBoard.columns.length > 0) {
    targetColumnId = currentBoard.columns[0].id;
  }
  
  if (!targetColumnId) {
    alert('Сначала создайте колонку');
    return;
  }
  
  document.getElementById('card-modal').dataset.targetColumnId = targetColumnId;
  document.getElementById('modal-overlay').classList.add('show');
  document.getElementById('card-modal').classList.add('show');
}

function showCardModal(card, columnId) {
  currentEditCard = card;
  document.getElementById('card-modal-title').textContent = 'Редактирование';
  document.getElementById('card-title-input').value = card.title || '';
  document.getElementById('card-content-input').value = card.content || '';
  document.getElementById('delete-card-btn').style.display = 'block';
  document.getElementById('card-modal').dataset.targetColumnId = columnId;
  document.getElementById('modal-overlay').classList.add('show');
  document.getElementById('card-modal').classList.add('show');
}

function saveCard() {
  const title = document.getElementById('card-title-input').value.trim();
  const content = document.getElementById('card-content-input').value;
  const targetColumnId = document.getElementById('card-modal').dataset.targetColumnId;
  const column = currentBoard.columns.find(c => c.id === targetColumnId);
  
  if (!column) {
    alert('Колонка не найдена');
    return;
  }
  
  if (currentEditCard) {
    currentEditCard.title = title || 'Без названия';
    currentEditCard.content = content;
    currentEditCard.updatedAt = Date.now();
  } else {
    const newCard = {
      id: generateId(),
      title: title || 'Новая заметка',
      content: content,
      index: column.cards.length,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    column.cards.push(newCard);
  }
  
  saveData();
  renderKanban();
  closeCardModal();
}

function deleteCard() {
  if (!currentEditCard) return;
  
  const targetColumnId = document.getElementById('card-modal').dataset.targetColumnId;
  const column = currentBoard.columns.find(c => c.id === targetColumnId);
  
  if (column && confirm('Удалить заметку?')) {
    column.cards = column.cards.filter(c => c.id !== currentEditCard.id);
    column.cards.forEach((card, idx) => card.index = idx);
    saveData();
    renderKanban();
    closeCardModal();
  }
}

function closeCardModal() {
  document.getElementById('modal-overlay').classList.remove('show');
  document.getElementById('card-modal').classList.remove('show');
  currentEditCard = null;
}

// ==================== НАСТРОЙКИ ДОСКИ ====================
function showBoardSettings() {
  document.getElementById('settings-board-name').value = currentBoard.title;
  document.getElementById('modal-overlay').classList.add('show');
  document.getElementById('settings-modal').classList.add('show');
}

function saveBoardSettings() {
  const newName = document.getElementById('settings-board-name').value.trim();
  if (newName) {
    currentBoard.title = newName;
    saveData();
    renderKanban();
    closeSettingsModal();
  }
}

function deleteCurrentBoard() {
  if (confirm(`Удалить доску "${currentBoard.title}"? Все данные будут потеряны.`)) {
    const index = boards.findIndex(b => b.id === currentBoard.id);
    boards.splice(index, 1);
    
    if (boards.length > 0) {
      currentBoard = boards[0];
      setCurrentBoardId(currentBoard.id);
      renderKanban();
    } else {
      showScreen('boards-screen');
      renderBoardsList();
    }
    
    saveData();
    closeSettingsModal();
  }
}

function closeSettingsModal() {
  document.getElementById('modal-overlay').classList.remove('show');
  document.getElementById('settings-modal').classList.remove('show');
}

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Инициализируем обработчик drop для колонок после загрузки
setTimeout(() => {
  setupColumnDropHandler();
}, 100);