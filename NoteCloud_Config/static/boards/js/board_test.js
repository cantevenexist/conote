function getCookie(name) {
    const value = $.cookie(name);
    return value ? decodeURIComponent(value) : null;
}

const stage = new Konva.Stage({
  container: 'container',
  width: window.innerWidth,
  height: window.innerHeight
});
const layer = new Konva.Layer();
stage.add(layer);
stage.kanbanBoards = [];

const COLUMN_WIDTH = 280;
const COLUMN_MARGIN = 15;
const CARD_MARGIN = 10;
const INITIAL_BOARD_HEIGHT = 200;
const HEADER_HEIGHT = 60;
const BUTTON_HEIGHT = 40;
const ADD_COLUMN_BUTTON_WIDTH = 40;
const CARD_PADDING = 10;
const MIN_CARD_HEIGHT = 60;

let redrawScheduled = false;
function scheduleRedraw() {
  if (!redrawScheduled) {
    redrawScheduled = true;
    requestAnimationFrame(() => {
      layer.batchDraw();
      redrawScheduled = false;
      updateDebugInfo();
    });
  }
}

const loadingScreen = document.getElementById('loading-screen');
const overlay = document.getElementById('overlay');
const cardModal = document.getElementById('card-modal');
const cardTitleInput = document.getElementById('card-title');
const cardContentInput = document.getElementById('card-content');
const closeCardModalBtn = document.getElementById('close-card-modal');
const deleteCardBtn = document.getElementById('delete-card');
const columnModal = document.getElementById('column-modal');
const columnTitleInput = document.getElementById('column-title');
const closeColumnModalBtn = document.getElementById('close-column-modal');
const deleteColumnBtn = document.getElementById('delete-column');
const boardModal = document.getElementById('board-modal');
const boardTitleInput = document.getElementById('board-title');
const closeBoardModalBtn = document.getElementById('close-board-modal');
const deleteBoardBtn = document.getElementById('delete-board');
const debugToggle = document.getElementById('debug-toggle');
const debugPanel = document.getElementById('debug-panel');
const debugContent = document.getElementById('debug-content');
const addBoardBtn = document.getElementById('add-board-btn');

let currentEditingElement = null;
let currentElementType = null;
let isCreatingBoard = false;
let previewBoard = null;

// Async function to generate ID from server
async function generateId(objectType) {
  const csrftoken = getCookie('csrftoken');
  const urlHash = window.location.pathname.split('/')[2];
  const payload = {
    url_hash: urlHash,
    object_type: objectType
  };
  const response = await fetch('/workspace/generate_id/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': csrftoken,
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (data.id) {
    return data.id;
  } else {
    throw new Error('Failed to generate ID');
  }
}

// Load initial JSON data
async function loadInitialData() {
  const urlHash = window.location.pathname.split('/')[2];
  const response = await fetch(`/workspace/board_data/${urlHash}/`);
  if (!response.ok) {
    if (response.status === 404) {
      // Нет данных
      return [];
    }
    throw new Error('Не удалось загрузить данные доски');
  }
  const data = await response.json();
  if (Array.isArray(data)) {
    return data;
  } else if (typeof data === 'object' && data !== null && Object.keys(data).length === 0) {
    return [];
  } else {
    throw new Error('Неверный формат данных: ожидался массив или пустой объект');
  }
}

function loadBoardFromJSON(data) {
  data.forEach(boardData => {
    const board = createBoardFromData(boardData);
    const sortedColumns = boardData.columns.sort((a, b) => a.index - b.index);
    sortedColumns.forEach((columnData, i) => {
      const column = createColumnFromData(columnData, board, i + 1);
      const sortedCards = columnData.cards.sort((a, b) => a.index - b.index);
      sortedCards.forEach((cardData, j) => {
        createCardFromData(cardData, column, j + 1);
      });
    });
  });
}

// Command application
function applyCommand(command) {
  try {
    switch(command.type) {
      case "create":
        handleCreateCommand(command);
        break;
      case "update":
        handleUpdateCommand(command);
        break;
      case "delete":
        handleDeleteCommand(command);
        break;
      default:
        console.error(`Unknown command type: ${command.type}`);
    }
  } catch (error) {
    console.error(`Error applying command: ${error.message}`);
  }
}

// Create functions with IDs
function createBoardFromData(data) {
  const board = new Konva.Group({
    x: data.x,
    y: data.y,
    draggable: true
  });
  board.setAttr('id', data.id);
  const boardWidth = COLUMN_WIDTH + COLUMN_MARGIN * 2 + ADD_COLUMN_BUTTON_WIDTH;
  const boardBg = new Konva.Rect({
    width: boardWidth,
    height: INITIAL_BOARD_HEIGHT,
    fill: '#ECEFF1',
    cornerRadius: 10,
    stroke: '#B0BEC5',
    strokeWidth: 2,
    shadowColor: 'black',
    shadowBlur: 10,
    shadowOpacity: 0.2,
    shadowOffset: { x: 5, y: 5 }
  });
  const header = new Konva.Text({
    text: data.title,
    fontSize: 18,
    fontFamily: 'Arial',
    fill: '#37474F',
    width: boardBg.width() - 40,
    padding: 20,
    align: 'left',
    fontStyle: 'bold',
    ellipsis: true,
    wrap: 'none'
  });
  board.add(boardBg, header);
  createAddColumnButton(board);
  layer.add(board);
  stage.kanbanBoards.push(board);

  header.on('click tap', function(e) {
    if (!e.evt.ctrlKey && !e.evt.metaKey && !e.evt.shiftKey) {
      showModal('board', board, header.text());
      e.cancelBubble = true;
    }
  });
  board.on('dragstart', () => {
    document.body.style.cursor = 'grabbing';
    board.moveToTop();
    scheduleRedraw();
  })
  .on('dragmove', scheduleRedraw)
  .on('dragend', () => {
    document.body.style.cursor = 'default';
    const command = {
      type: "update",
      objectType: "board",
      id: board.getAttr('id'),
      data: {
        x: board.x(),
        y: board.y()
      }
    };
    sendCommand(command);
    scheduleRedraw();
  });
  return board;
}

function createBoardFromCommand(data) {
  const existingBoard = findBoardById(data.id);
  if (existingBoard) return;
  const board = createBoardFromData({
    id: data.id,
    title: data.title || "Новая доска",
    x: data.x || 100,
    y: data.y || 100
  });
  scheduleRedraw();
  return board;
}

function createColumnFromData(data, board, index) {
  const col = new Konva.Group({
    x: getColumnX(board, index),
    y: HEADER_HEIGHT,
    draggable: true,
    name: 'kanban-column',
    dragBoundFunc: function(pos) {
      const boardRect = board.findOne('Rect');
      const boardLeft = board.x();
      const boardRight = boardLeft + boardRect.width();
      const minX = boardLeft + COLUMN_MARGIN * 0.5;
      const maxX = boardRight - COLUMN_WIDTH - COLUMN_MARGIN * 1.5 - ADD_COLUMN_BUTTON_WIDTH;
      const newX = Math.max(minX, Math.min(pos.x, maxX));
      return { x: newX, y: this.absolutePosition().y };
    }
  });
  col.setAttr('id', data.id);
  col.setAttr('index', index);
  col.originalY = HEADER_HEIGHT;
  const colBg = new Konva.Rect({
    width: COLUMN_WIDTH,
    height: 40 + CARD_MARGIN + MIN_CARD_HEIGHT + CARD_MARGIN,
    fill: '#E0E0E0',
    cornerRadius: 5,
    stroke: '#BDBDBD',
    strokeWidth: 1
  });
  const header = new Konva.Text({
    text: data.title,
    fontSize: 16,
    fontFamily: 'Arial',
    fill: 'black',
    width: COLUMN_WIDTH - 20,
    padding: 10,
    offsetY: -7,
    align: 'left',
    fontStyle: 'bold',
    ellipsis: true,
    wrap: 'none'
  });
  header.on('click tap', function(e) {
    if (!e.evt.ctrlKey && !e.evt.metaKey && !e.evt.shiftKey) {
      showModal('column', col, header.text());
      e.cancelBubble = true;
    }
  });
  const addCardBtn = new Konva.Group({
    x: CARD_MARGIN,
    y: 40 + CARD_MARGIN,
    name: 'add-card-button'
  });
  const addCardBg = new Konva.Rect({
    width: COLUMN_WIDTH - 2 * CARD_MARGIN,
    height: MIN_CARD_HEIGHT,
    fill: '#66BB6A',
    cornerRadius: 5
  });
  const addCardTxt = new Konva.Text({
    text: 'Добавить карточку',
    fontSize: 14,
    fontFamily: 'Arial',
    fill: 'white',
    width: COLUMN_WIDTH - 2 * CARD_MARGIN,
    padding: 10,
    align: 'left',
    verticalAlign: 'middle',
    height: MIN_CARD_HEIGHT - 2 * CARD_PADDING,
    offsetY: -11
  });
  addCardBtn.add(addCardBg, addCardTxt).on('click tap', e => {
    e.cancelBubble = true;
    addCardToColumn(col, board);
    scheduleRedraw();
  });
  setupButtonHover(addCardBtn, addCardBg, '#66BB6A', '#81C784');
  col.add(colBg, header, addCardBtn);
  board.add(col);
  setupColumnDragEvents(col, board);
  return col;
}

function createColumnFromCommand(data) {
  const existingColumn = findColumnById(data.id);
  if (existingColumn) return;
  const board = findBoardById(data.boardId);
  if (!board) throw new Error(`Board with ID ${data.boardId} not found`);
  const cols = board.find('.kanban-column').sort((a, b) => a.getAttr('index') - b.getAttr('index'));
  const index = data.index || cols.length + 1;
  const column = createColumnFromData({ id: data.id, title: data.title || "Новая колонка" }, board, index);
  const btn = board.findOne('.add-column-button');
  btn.x(getColumnX(board, cols.length + 2));
  const boardBg = board.findOne('Rect');
  boardBg.width(getColumnX(board, cols.length + 2) + ADD_COLUMN_BUTTON_WIDTH + COLUMN_MARGIN);
  board.findOne('Text').width(boardBg.width() - 40);
  recalcBoardHeight(board);
  scheduleRedraw();
  return column;
}

function createCardFromData(data, column, index) {
  const card = new Konva.Group({
    x: CARD_MARGIN,
    y: getCardY(column, index),
    name: 'card',
    draggable: true
  });
  card.setAttr('id', data.id);
  card.setAttr('index', index);
  const cardTxt = new Konva.Text({
    text: data.title,
    fontSize: 14,
    fontFamily: 'Arial',
    fill: 'black',
    width: COLUMN_WIDTH - 2 * CARD_MARGIN - 2 * CARD_PADDING,
    padding: CARD_PADDING,
    align: 'left'
  });
  const cardHeight = calculateCardHeight(cardTxt);
  const cardBg = new Konva.Rect({
    width: COLUMN_WIDTH - 2 * CARD_MARGIN,
    height: cardHeight,
    fill: '#FFF',
    cornerRadius: 5,
    stroke: '#9E9E9E',
    strokeWidth: 1
  });
  cardTxt.y((cardHeight - cardTxt.height()) / 2);
  card.add(cardBg, cardTxt);
  card.content = data.content || '';
  column.add(card);
  card.on('click tap', function(e) {
    if (!e.evt.ctrlKey && !e.evt.metaKey && !e.evt.shiftKey) {
      showModal('card', this, cardTxt.text().split('\n')[0], this.content || '');
    }
  });
  setupCardDragEvents(card);
  return card;
}

function createCardFromCommand(data) {
  const existingCard = findCardById(data.id);
  if (existingCard) return;
  const column = findColumnById(data.columnId);
  if (!column) throw new Error(`Column with ID ${data.columnId} not found`);
  const board = column.getParent();
  const cards = column.find('.card').sort((a, b) => a.getAttr('index') - b.getAttr('index'));
  const index = data.index || cards.length + 1;
  const card = createCardFromData({ id: data.id, title: data.title || "Новая карточка", content: data.content || "" }, column, index);
  reorderCardsInColumn(column);
  recalcBoardHeight(board);
  scheduleRedraw();
  return card;
}

// Command handlers
function handleCreateCommand(command) {
  switch(command.objectType) {
    case "board":
      createBoardFromCommand(command.data);
      break;
    case "column":
      createColumnFromCommand(command.data);
      break;
    case "card":
      createCardFromCommand(command.data);
      break;
  }
}

function handleUpdateCommand(command) {
  switch(command.objectType) {
    case "board":
      updateBoardFromCommand(command.id, command.data);
      break;
    case "column":
      updateColumnFromCommand(command.id, command.data);
      break;
    case "card":
      updateCardFromCommand(command.id, command.data);
      break;
  }
}

function handleDeleteCommand(command) {
  switch(command.objectType) {
    case "board":
      deleteBoardFromCommand(command.id);
      break;
    case "column":
      deleteColumnFromCommand(command.id);
      break;
    case "card":
      deleteCardFromCommand(command.id);
      break;
  }
}

function updateBoardFromCommand(id, data) {
  const board = findBoardById(id);
  if (!board) return;
  if (data.title) {
    board.findOne('Text').text(data.title);
  }
  if (data.x !== undefined) board.x(data.x);
  if (data.y !== undefined) board.y(data.y);
  scheduleRedraw();
}

function updateColumnFromCommand(id, data) {
  const column = findColumnById(id);
  if (!column) return;
  const board = column.getParent();
  if (data.title) column.findOne('Text').text(data.title);
  if (data.boardId && data.boardId !== board.getAttr('id')) {
    const newBoard = findBoardById(data.boardId);
    if (newBoard) {
      column.remove();
      newBoard.add(column);
      column.setAttr('index', data.index || 1);
      reorderColumnsInBoard(newBoard);
      reorderColumnsInBoard(board);
      recalcBoardHeight(newBoard);
      recalcBoardHeight(board);
    }
  } else if (data.index && data.index !== column.getAttr('index')) {
    column.setAttr('index', data.index);
    reorderColumnsInBoard(board);
    recalcBoardHeight(board);
  }
  scheduleRedraw();
}

function updateCardFromCommand(id, data) {
  const card = findCardById(id);
  if (!card) return;
  const oldColumn = card.getParent();
  const oldBoard = oldColumn.getParent();
  if (data.title) {
    const cardText = card.findOne('Text');
    cardText.text(data.title);
    const cardBg = card.findOne('Rect');
    const newHeight = calculateCardHeight(cardText);
    cardBg.height(newHeight);
    cardText.y((newHeight - cardText.height()) / 2);
  }
  if (data.content) card.content = data.content;
  if (data.columnId && data.columnId !== oldColumn.getAttr('id')) {
    const newColumn = findColumnById(data.columnId);
    if (newColumn) {
      card.remove();
      newColumn.add(card);
      card.x(CARD_MARGIN);
      card.setAttr('index', data.index || 1);
      reorderCardsInColumn(newColumn);
      reorderCardsInColumn(oldColumn);
      recalcBoardHeight(newColumn.getParent());
      recalcBoardHeight(oldBoard);
    }
  } else if (data.index && data.index !== card.getAttr('index')) {
    card.setAttr('index', data.index);
    reorderCardsInColumn(oldColumn);
    recalcBoardHeight(oldBoard);
  }
  scheduleRedraw();
}

function deleteBoardFromCommand(id) {
  const board = findBoardById(id);
  if (!board) return;
  const index = stage.kanbanBoards.indexOf(board);
  if (index !== -1) stage.kanbanBoards.splice(index, 1);
  board.destroy();
  scheduleRedraw();
}

function deleteColumnFromCommand(id) {
  const column = findColumnById(id);
  if (!column) return;
  const board = column.getParent();
  column.destroy();
  reorderColumnsInBoard(board);
  recalcBoardHeight(board);
  scheduleRedraw();
}

function deleteCardFromCommand(id) {
  const card = findCardById(id);
  if (!card) return;
  const column = card.getParent();
  const board = column.getParent();
  card.destroy();
  reorderCardsInColumn(column);
  recalcBoardHeight(board);
  scheduleRedraw();
}

// Find functions
function findBoardById(id) {
  return stage.kanbanBoards.find(board => board.getAttr('id') === id);
}

function findColumnById(id) {
  for (const board of stage.kanbanBoards) {
    const column = board.find('.kanban-column').find(col => col.getAttr('id') === id);
    if (column) return column;
  }
  return null;
}

function findCardById(id) {
  for (const board of stage.kanbanBoards) {
    for (const column of board.find('.kanban-column')) {
      const card = column.find('.card').find(card => card.getAttr('id') === id);
      if (card) return card;
    }
  }
  return null;
}

// UI event handlers
debugToggle.addEventListener('click', () => {
  const isVisible = debugPanel.style.display === 'block';
  debugPanel.style.display = isVisible ? 'none' : 'block';
  debugToggle.textContent = isVisible ? 'Показать структуру' : 'Скрыть структуру';
});

function showModal(type, element, title, content = '') {
  currentEditingElement = element;
  currentElementType = type;
  overlay.style.display = 'block';
  if (type === 'card') {
    cardTitleInput.value = title;
    cardContentInput.value = content;
    cardModal.style.display = 'block';
  } else if (type === 'column') {
    columnTitleInput.value = title;
    columnModal.style.display = 'block';
  } else if (type === 'board') {
    boardTitleInput.value = title;
    boardModal.style.display = 'block';
  }
}

function hideModals() {
  overlay.style.display = 'none';
  cardModal.style.display = 'none';
  columnModal.style.display = 'none';
  boardModal.style.display = 'none';
  updateElementFromInputs();
  currentEditingElement = null;
  currentElementType = null;
}

function updateElementFromInputs() {
  if (!currentEditingElement || !currentElementType) return;
  let command;
  if (currentElementType === 'card') {
    const title = cardTitleInput.value;
    const content = cardContentInput.value;
    const cardText = currentEditingElement.findOne('Text');
    cardText.text(title);
    currentEditingElement.content = content;
    const newHeight = calculateCardHeight(cardText);
    const cardBg = currentEditingElement.findOne('Rect');
    cardBg.height(newHeight);
    cardText.y((newHeight - cardText.height()) / 2);
    const column = currentEditingElement.getParent();
    reorderCardsInColumn(column);
    recalcBoardHeight(column.getParent());
    command = {
      type: "update",
      objectType: "card",
      id: currentEditingElement.getAttr('id'),
      data: { title, content }
    };
  } else if (currentElementType === 'column') {
    const title = columnTitleInput.value;
    currentEditingElement.findOne('Text').text(title);
    command = {
      type: "update",
      objectType: "column",
      id: currentEditingElement.getAttr('id'),
      data: { title }
    };
  } else if (currentElementType === 'board') {
    const title = boardTitleInput.value;
    currentEditingElement.findOne('Text').text(title);
    command = {
      type: "update",
      objectType: "board",
      id: currentEditingElement.getAttr('id'),
      data: { title }
    };
  }
  if (command) sendCommand(command);
  scheduleRedraw();
}

function deleteCurrentElement() {
  if (!currentEditingElement || !currentElementType) return;
  const command = {
    type: "delete",
    objectType: currentElementType,
    id: currentEditingElement.getAttr('id')
  };
  sendCommand(command);
  if (currentElementType === 'card') {
    const column = currentEditingElement.getParent();
    currentEditingElement.destroy();
    reorderCardsInColumn(column);
    recalcBoardHeight(column.getParent());
  } else if (currentElementType === 'column') {
    const board = currentEditingElement.getParent();
    currentEditingElement.destroy();
    reorderColumnsInBoard(board);
    recalcBoardHeight(board);
  } else if (currentElementType === 'board') {
    const index = stage.kanbanBoards.indexOf(currentEditingElement);
    if (index !== -1) stage.kanbanBoards.splice(index, 1);
    currentEditingElement.destroy();
  }
  hideModals();
}

cardTitleInput.addEventListener('input', updateElementFromInputs);
cardContentInput.addEventListener('input', updateElementFromInputs);
closeCardModalBtn.addEventListener('click', hideModals);
columnTitleInput.addEventListener('input', updateElementFromInputs);
closeColumnModalBtn.addEventListener('click', hideModals);
boardTitleInput.addEventListener('input', updateElementFromInputs);
closeBoardModalBtn.addEventListener('click', hideModals);
deleteCardBtn.addEventListener('click', deleteCurrentElement);
deleteColumnBtn.addEventListener('click', deleteCurrentElement);
deleteBoardBtn.addEventListener('click', deleteCurrentElement);
overlay.addEventListener('click', hideModals);

function setupButtonHover(button, bg, normal, hover) {
  button.on('mouseover', () => {
    document.body.style.cursor = 'pointer';
    bg.fill(hover);
    scheduleRedraw();
  });
  button.on('mouseout', () => {
    document.body.style.cursor = 'default';
    bg.fill(normal);
    scheduleRedraw();
  });
}

addBoardBtn.addEventListener('click', function() {
  isCreatingBoard = !isCreatingBoard;
  if (isCreatingBoard) {
    addBoardBtn.classList.add('creating');
    addBoardBtn.textContent = 'Отмена';
    document.body.style.cursor = 'crosshair';
    createPreviewBoard();
  } else {
    cancelBoardCreation();
  }
});

function createPreviewBoard() {
  if (previewBoard) previewBoard.destroy();
  const boardWidth = COLUMN_WIDTH + COLUMN_MARGIN * 3 + ADD_COLUMN_BUTTON_WIDTH;
  previewBoard = new Konva.Rect({
    width: boardWidth,
    height: INITIAL_BOARD_HEIGHT,
    fill: 'rgba(236, 239, 241, 0.7)',
    cornerRadius: 10,
    stroke: 'rgba(176, 190, 197, 0.7)',
    strokeWidth: 2,
    shadowColor: 'black',
    shadowBlur: 10,
    shadowOpacity: 0.2,
    shadowOffset: { x: 5, y: 5 }
  });
  layer.add(previewBoard);
  previewBoard.moveToTop();
  scheduleRedraw();
}

function updatePreviewBoardPosition(x, y) {
  if (!previewBoard) return;
  const boardWidth = previewBoard.width();
  const boardHeight = previewBoard.height();
  previewBoard.x(x - boardWidth / 2);
  previewBoard.y(y - boardHeight / 2);
  scheduleRedraw();
}

function cancelBoardCreation() {
  if (previewBoard) {
    previewBoard.destroy();
    previewBoard = null;
  }
  addBoardBtn.classList.remove('creating');
  addBoardBtn.textContent = 'Добавить доску Kanban';
  document.body.style.cursor = 'default';
  isCreatingBoard = false;
  scheduleRedraw();
}

stage.on('mousemove', function(e) {
  if (!isCreatingBoard || !previewBoard) return;
  const pos = stage.getPointerPosition();
  if (pos) updatePreviewBoardPosition(pos.x, pos.y);
});

stage.on('click tap', async function(e) {
  if (!isCreatingBoard || !previewBoard) return;
  const pos = stage.getPointerPosition();
  if (pos) {
    await addKanbanBoard(pos.x, pos.y);
    cancelBoardCreation();
  }
});

async function addKanbanBoard(x, y) {
  const id = await generateId('board');
  const boardWidth = COLUMN_WIDTH + COLUMN_MARGIN * 2 + ADD_COLUMN_BUTTON_WIDTH;
  const boardX = x - boardWidth / 2;
  const boardY = y - INITIAL_BOARD_HEIGHT / 2;
  const board = createBoardFromCommand({
    id: id,
    title: 'Новая доска',
    x: boardX,
    y: boardY
  });
  const command = {
    type: "create",
    objectType: "board",
    data: {
      id: id,
      title: 'Новая доска',
      x: boardX,
      y: boardY
    }
  };
  sendCommand(command);
}

function createAddColumnButton(board) {
  const btn = new Konva.Group({
    x: getColumnX(board, 1),
    y: HEADER_HEIGHT,
    name: 'add-column-button'
  });
  const bg = new Konva.Rect({
    width: ADD_COLUMN_BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
    fill: '#42A5F5',
    cornerRadius: 5
  });
  const txt = new Konva.Text({
    text: '+',
    fontSize: 20,
    fontFamily: 'Arial',
    fill: 'white',
    width: ADD_COLUMN_BUTTON_WIDTH,
    padding: 10,
    align: 'center'
  });
  btn.add(bg, txt).on('click tap', async e => {
    e.cancelBubble = true;
    await addColumnToBoard(board);
    scheduleRedraw();
  });
  setupButtonHover(btn, bg, '#42A5F5', '#64B5F6');
  board.add(btn);
  return btn;
}

function recalcBoardHeight(board) {
  const cols = board.find('.kanban-column');
  let maxH = 0;
  cols.forEach(col => {
    const bg = col.findOne('Rect');
    const h = col.y() + bg.height();
    if (h > maxH) maxH = h;
  });
  const newH = maxH + COLUMN_MARGIN;
  board.findOne('Rect').height(newH);
}

function getColumnX(board, index) {
  return COLUMN_MARGIN + (index - 1) * (COLUMN_WIDTH + COLUMN_MARGIN);
}

function getCardY(column, index) {
  const cards = column.find('.card').sort((a, b) => a.getAttr('index') - b.getAttr('index'));
  let y = 40 + CARD_MARGIN;
  for (let i = 0; i < index - 1 && i < cards.length; i++) {
    const prevCard = cards[i];
    const cardBg = prevCard.findOne('Rect');
    y += cardBg.height() + CARD_MARGIN;
  }
  return y;
}

async function addColumnToBoard(board) {
  const id = await generateId('column');
  const cols = board.find('.kanban-column').sort((a, b) => a.getAttr('index') - b.getAttr('index'));
  const index = cols.length + 1;
  const column = createColumnFromCommand({
    id: id,
    title: 'Новая колонка',
    boardId: board.getAttr('id'),
    index: index
  });
  const command = {
    type: "create",
    objectType: "column",
    data: {
      id: id,
      title: 'Новая колонка',
      boardId: board.getAttr('id'),
      index: index
    }
  };
  sendCommand(command);
}

function setupColumnDragEvents(col, board) {
  let originalPositions = [];
  let currentTweens = [];
  let isDragging = false;

  col.on('dragstart', function() {
    document.body.style.cursor = 'grabbing';
    this.moveToTop();
    isDragging = true;
    currentTweens.forEach(tween => tween.destroy());
    currentTweens = [];
    originalPositions = board.find('.kanban-column').map(c => ({
      node: c,
      x: c.x()
    }));
    scheduleRedraw();
  })
  .on('dragmove', function() {
    if (!isDragging) return;
    const draggedCol = this;
    const cols = board.find('.kanban-column');
    const draggedCenterX = draggedCol.x() + COLUMN_WIDTH / 2;
    const sortedCols = [...cols].sort((a, b) => a.x() - b.x());
    let newIndex = 0;
    for (let i = 0; i < sortedCols.length; i++) {
      if (draggedCol === sortedCols[i]) continue;
      const centerX = sortedCols[i].x() + COLUMN_WIDTH / 2;
      if (draggedCenterX > centerX) newIndex = i + 1;
    }
    let targetX = COLUMN_MARGIN;
    const targets = [];
    for (let i = 0, colIndex = 0; colIndex < sortedCols.length; colIndex++) {
      if (i === newIndex) {
        targets.push({ node: draggedCol, x: targetX, skip: true });
        targetX += COLUMN_WIDTH + COLUMN_MARGIN;
        i++;
      }
      if (colIndex < sortedCols.length && sortedCols[colIndex] !== draggedCol) {
        targets.push({ node: sortedCols[colIndex], x: targetX });
        targetX += COLUMN_WIDTH + COLUMN_MARGIN;
        i++;
      }
    }
    targets.forEach(target => {
      if (target.skip) return;
      const distance = Math.abs(target.node.x() - target.x);
      if (distance < 1) return;
      const duration = Math.min(0.3, Math.max(0.05, distance / 500));
      const tween = new Konva.Tween({
        node: target.node,
        x: target.x,
        duration: duration,
        easing: Konva.Easings.Linear,
        onFinish: function() {
          currentTweens = currentTweens.filter(t => t !== this);
        }
      });
      currentTweens = currentTweens.filter(t => t.node !== target.node);
      currentTweens.push(tween);
      tween.play();
    });
    const btn = board.findOne('.add-column-button');
    btn.x(targetX);
    scheduleRedraw();
  })
  .on('dragend', function() {
    document.body.style.cursor = 'default';
    isDragging = false;
    currentTweens.forEach(tween => tween.destroy());
    currentTweens = [];
    const cols = board.find('.kanban-column').sort((a, b) => a.x() - b.x());
    cols.forEach((col, i) => {
      const newIndex = i + 1;
      if (col.getAttr('index') !== newIndex) {
        col.setAttr('index', newIndex);
        sendCommand({
          type: "update",
          objectType: "column",
          id: col.getAttr('id'),
          data: { index: newIndex }
        });
      }
      col.x(getColumnX(board, newIndex));
    });
    const btn = board.findOne('.add-column-button');
    btn.x(getColumnX(board, cols.length + 1));
    const boardBg = board.findOne('Rect');
    boardBg.width(getColumnX(board, cols.length + 1) + ADD_COLUMN_BUTTON_WIDTH + COLUMN_MARGIN);
    board.findOne('Text').width(boardBg.width() - 40);
    recalcBoardHeight(board);
    scheduleRedraw();
  });
}

function reorderColumnsInBoard(board) {
  const columns = board.find('.kanban-column').sort((a, b) => a.getAttr('index') - b.getAttr('index'));
  const btn = board.findOne('.add-column-button');
  columns.forEach((col, i) => {
    col.setAttr('index', i + 1);
    col.x(getColumnX(board, i + 1));
  });
  btn.x(getColumnX(board, columns.length + 1));
  const boardBg = board.findOne('Rect');
  boardBg.width(getColumnX(board, columns.length + 1) + ADD_COLUMN_BUTTON_WIDTH + COLUMN_MARGIN);
  board.findOne('Text').width(boardBg.width() - 40);
}

function calculateCardHeight(textNode) {
  textNode.height('auto');
  const textHeight = textNode.height();
  const calculatedHeight = textHeight + 2 * CARD_PADDING;
  return Math.max(calculatedHeight, MIN_CARD_HEIGHT);
}

async function addCardToColumn(column, board) {
  const id = await generateId('card');
  const cards = column.find('.card').sort((a, b) => a.getAttr('index') - b.getAttr('index'));
  const index = cards.length + 1;
  const card = createCardFromCommand({
    id: id,
    title: 'Новая карточка',
    columnId: column.getAttr('id'),
    index: index
  });
  const command = {
    type: "create",
    objectType: "card",
    data: {
      id: id,
      title: 'Новая карточка',
      columnId: column.getAttr('id'),
      index: index
    }
  };
  sendCommand(command);
}

function setupCardDragEvents(card) {
  let cardTweens = [];

  card.on('dragstart', function() {
    document.body.style.cursor = 'grabbing';
    this.moveToTop();
    this.startCol = this.getParent();
    this.startBoard = this.startCol.getParent();
    this.startPos = { x: this.x(), y: this.y() };
    cardTweens.forEach(t => t.destroy());
    cardTweens = [];
    scheduleRedraw();
  })
  .on('dragmove', function() {
    const draggedCard = this;
    const cards = this.getParent().find('.card').filter(c => c !== draggedCard);
    const draggedCenterY = draggedCard.y() + draggedCard.findOne('Rect').height() / 2;
    cards.sort((a, b) => a.y() - b.y());
    let newIndex = 0;
    for (let i = 0; i < cards.length; i++) {
      const centerY = cards[i].y() + cards[i].findOne('Rect').height() / 2;
      if (draggedCenterY > centerY) newIndex = i + 1;
    }
    let targetY = 40 + CARD_MARGIN;
    const targets = [];
    for (let i = 0, cardIndex = 0; cardIndex < cards.length; cardIndex++) {
      if (i === newIndex) {
        targets.push({ node: draggedCard, y: targetY, skip: true });
        targetY += draggedCard.findOne('Rect').height() + CARD_MARGIN;
        i++;
      }
      if (cardIndex < cards.length && cards[cardIndex] !== draggedCard) {
        targets.push({ node: cards[cardIndex], y: targetY });
        targetY += cards[cardIndex].findOne('Rect').height() + CARD_MARGIN;
        i++;
      }
    }
    targets.forEach(target => {
      if (target.skip) return;
      const distance = Math.abs(target.node.y() - target.y);
      if (distance < 1) return;
      const duration = Math.min(0.3, Math.max(0.05, distance / 200));
      const tween = new Konva.Tween({
        node: target.node,
        y: target.y,
        duration: duration,
        easing: Konva.Easings.Linear,
        onFinish: function() {
          cardTweens = cardTweens.filter(t => t !== this);
        }
      });
      cardTweens = cardTweens.filter(t => t.node !== target.node);
      cardTweens.push(tween);
      tween.play();
    });
    scheduleRedraw();
  })
  .on('dragend', function() {
    document.body.style.cursor = 'default';
    cardTweens.forEach(t => t.destroy());
    cardTweens = [];
    handleCardDrop(this);
    scheduleRedraw();
  });
}

function reorderCardsInColumn(column) {
  const cards = column.find('.card').sort((a, b) => a.getAttr('index') - b.getAttr('index'));
  let y = 40 + CARD_MARGIN;
  cards.forEach((c, i) => {
    c.setAttr('index', i + 1);
    c.y(y);
    const cardBg = c.findOne('Rect');
    y += cardBg.height() + CARD_MARGIN;
  });
  const addBtn = column.findOne('.add-card-button');
  addBtn.y(y);
  column.findOne('Rect').height(y + MIN_CARD_HEIGHT + CARD_MARGIN);
}

function handleCardDrop(card) {
  const pos = card.getAbsolutePosition();
  const cardBg = card.findOne('Rect');
  const cardWidth = cardBg.width();
  const cardHeight = cardBg.height();
  const centerX = pos.x + cardWidth / 2;
  const centerY = pos.y + cardHeight / 2;
  let targetCol = null;
  let targetBoard = null;
  stage.kanbanBoards.forEach(b => {
    const cols = b.find('.kanban-column');
    cols.forEach(c => {
      const colPos = c.getAbsolutePosition();
      const colRect = c.findOne('Rect');
      const colHeight = colRect.height();
      if (centerX > colPos.x && centerX < colPos.x + COLUMN_WIDTH &&
          centerY > colPos.y && centerY < colPos.y + colHeight) {
        targetCol = c;
        targetBoard = b;
      }
    });
  });
  const startCol = card.startCol;
  const startBoard = card.startBoard;
  if (targetCol) {
    const targetColPos = targetCol.getAbsolutePosition();
    const localY = centerY - targetColPos.y - cardHeight / 2;
    card.moveTo(targetCol);
    card.x(CARD_MARGIN);
    card.y(localY);
    reorderCardsInColumn(targetCol);
    reorderCardsInColumn(startCol);
    recalcBoardHeight(targetBoard);
    recalcBoardHeight(startBoard);
    const newIndex = targetCol.find('.card').sort((a, b) => a.y() - b.y()).indexOf(card) + 1;
    sendCommand({
      type: "update",
      objectType: "card",
      id: card.getAttr('id'),
      data: {
        columnId: targetCol.getAttr('id'),
        index: newIndex
      }
    });
  } else {
    card.moveTo(startCol);
    card.x(card.startPos.x);
    card.y(card.startPos.y);
    reorderCardsInColumn(startCol);
    recalcBoardHeight(startBoard);
  }
}

function updateDebugInfo() {
  if (debugPanel.style.display !== 'block') return;
  let html = '';
  html += `<div class="debug-section">
    <h3>Сцена (Stage)</h3>
    <div class="debug-property"><div class="debug-property-name">Ширина:</div><div class="debug-property-value">${stage.width()}</div></div>
    <div class="debug-property"><div class="debug-property-name">Высота:</div><div class="debug-property-value">${stage.height()}</div></div>
  </div>`;
  html += `<div class="debug-section"><h3>Доски (${stage.kanbanBoards.length})</h3>`;
  stage.kanbanBoards.forEach((board, boardIndex) => {
    const boardHeader = board.findOne('Text');
    const boardBg = board.findOne('Rect');
    html += `</br><div class="debug-object">
      <div class="debug-property"><div class="debug-property-name">Доска (ID: ${board.getAttr('id')}):</div><div class="debug-property-value">${boardHeader.text()}</div></div>
      <div class="debug-property"><div class="debug-property-name">Позиция:</div><div class="debug-property-value">x: ${board.x()}, y: ${board.y()}</div></div>
      <div class="debug-property"><div class="debug-property-name">Размеры:</div><div class="debug-property-value">${boardBg.width()} × ${boardBg.height()}</div></div>`;
    const columns = board.find('.kanban-column');
    html += `<div class="debug-property"><div class="debug-property-name">Колонки:</div><div class="debug-property-value">${columns.length}</div></div>`;
    columns.forEach((col, colIndex) => {
      const colHeader = col.findOne('Text');
      const colBg = col.findOne('Rect');
      html += `</br><div class="debug-object">
        <div class="debug-property"><div class="debug-property-name">Колонка (ID: ${col.getAttr('id')}, Индекс: ${col.getAttr('index')}):</div><div class="debug-property-value">${colHeader.text()}</div></div>
        <div class="debug-property"><div class="debug-property-name">Позиция:</div><div class="debug-property-value">x: ${col.x()}, y: ${col.y()}</div></div>
        <div class="debug-property"><div class="debug-property-name">Размеры:</div><div class="debug-property-value">${colBg.width()} × ${colBg.height()}</div></div>`;
      const cards = col.find('.card');
      html += `<div class="debug-property"><div class="debug-property-name">Карточки:</div><div class="debug-property-value">${cards.length}</div></div>`;
      cards.forEach((card, cardIndex) => {
        const cardText = card.findOne('Text');
        const cardBg = card.findOne('Rect');
        html += `</br><div class="debug-object">
          <div class="debug-property"><div class="debug-property-name">Карточка (ID: ${card.getAttr('id')}, Индекс: ${card.getAttr('index')}):</div><div class="debug-property-value">${cardText.text().split('\n')[0]}</div></div>
          <div class="debug-property"><div class="debug-property-name">Позиция:</div><div class="debug-property-value">x: ${card.x()}, y: ${card.y()}</div></div>
          <div class="debug-property"><div class="debug-property-name">Размеры:</div><div class="debug-property-value">${cardBg.width()} × ${cardBg.height()}</div></div>
          <div class="debug-property"><div class="debug-property-name">Содержание:</div><div class="debug-property-value">${card.content || ''}</div></div>
        </div>`;
      });
      html += `</div>`;
    });
    html += `</div>`;
  });
  debugContent.innerHTML = html;
}

// Initialization
async function initializeBoard() {
  try {
    const jsonData = await loadInitialData();
    loadBoardFromJSON(jsonData);
    connectWebSocket();
    // Wait briefly for WebSocket commands to be applied
    await new Promise(resolve => setTimeout(resolve, 1000));
    loadingScreen.style.display = 'none';
  } catch (error) {
    console.error('Error initializing board:', error);
    loadingScreen.innerHTML = '<p>Ошибка загрузки доски</p>';
  }
}

initializeBoard();