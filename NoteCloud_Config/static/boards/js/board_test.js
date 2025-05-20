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
const commandInput = document.getElementById('command-input');
const applyCommandBtn = document.getElementById('apply-command');

let currentEditingElement = null;
let currentElementType = null;
let isCreatingBoard = false;
let previewBoard = null;

async function logChange(action, objectType, data) {
  let command = null;

  switch(action) {
    case 'create':
      command = {
        type: "create",
        objectType: objectType,
        data: {
          id: data.id,
          ...(objectType === 'board' ? {
            title: data.title,
            x: data.x, // x, y в процентах для создания
            y: data.y
          } : {}),
          ...(objectType === 'column' ? {
            title: data.title,
            boardId: data.boardId
          } : {}),
          ...(objectType === 'card' ? {
            id: data.id,
            title: data.title,
            content: data.content,
            columnId: data.columnId
          } : {})
        }
      };
      break;

    case 'update':
      command = {
        type: "update",
        objectType: objectType,
        id: data.id,
        data: {
          ...(objectType === 'board' ? {
            title: data.new.title,
            x: data.new.x, // x, y в процентах для обновления
            y: data.new.y
          } : {}),
          ...(objectType === 'column' ? {
            title: data.new.title,
            boardId: currentEditingElement.getParent().getAttr('id'),
            index: currentEditingElement.getAttr('index')
          } : {}),
          ...(objectType === 'card' ? {
            title: data.new.title,
            content: data.new.content,
            columnId: currentEditingElement.getParent().getAttr('id'),
            index: currentEditingElement.getAttr('index')
          } : {})
        }
      };
      break;

    case 'delete':
      command = {
        type: "delete",
        objectType: objectType,
        id: data.id
      };
      break;

    case 'move':
      command = {
        type: "update",
        objectType: 'card',
        id: data.id,
        data: {
          columnId: data.toColumn,
          index: data.newIndex || 1
        }
      };
      break;

    case 'reorder':
      if (objectType === 'column') {
        command = {
          type: "update",
          objectType: 'column',
          id: data.id,
          data: {
            index: data.newIndex
          }
        };
      } else if (objectType === 'card') {
        command = {
          type: "update",
          objectType: 'card',
          id: data.id,
          data: {
            index: data.newIndex
          }
        };
      }
      break;
  }

  if (command) {
    await sendCommand(command);
  }
}

function insertExample(type) {
  let example = '';

  switch(type) {
    case 'create-board':
      example = JSON.stringify({
        type: "create",
        objectType: "board",
        data: {
          title: "Новая доска",
          x: 100,
          y: 100
        }
      }, null, 2);
      break;

    case 'create-column':
      example = JSON.stringify({
        type: "create",
        objectType: "column",
        data: {
          title: "Новая колонка",
          boardId: 0
        }
      }, null, 2);
      break;

    case 'create-card':
      example = JSON.stringify({
        type: "create",
        objectType: "card",
        data: {
          title: "Новая карточка",
          content: "Описание карточки",
          columnId: 1
        }
      }, null, 2);
      break;

    case 'update-board':
      example = JSON.stringify({
        type: "update",
        objectType: "board",
        id: 0,
        data: {
          title: "Новое название доски",
          x: 200,
          y: 200
        }
      }, null, 2);
      break;

    case 'update-column':
      example = JSON.stringify({
        type: "update",
        objectType: "column",
        id: 1,
        data: {
          title: "Новое название колонки",
          boardId: 0,
          index: 2
        }
      }, null, 2);
      break;

    case 'update-card':
      example = JSON.stringify({
        type: "update",
        objectType: "card",
        id: 2,
        data: {
          title: "Новое название карточки",
          content: "Новое описание карточки",
          columnId: 1,
          index: 1
        }
      }, null, 2);
      break;

    case 'delete-board':
      example = JSON.stringify({
        type: "delete",
        objectType: "board",
        id: 0
      }, null, 2);
      break;

    case 'delete-column':
      example = JSON.stringify({
        type: "delete",
        objectType: "column",
        id: 1
      }, null, 2);
      break;

    case 'delete-card':
      example = JSON.stringify({
        type: "delete",
        objectType: "card",
        id: 2
      }, null, 2);
      break;
  }

  commandInput.value = example;
}

function applyCommand(command, commandFromServer = false) {
  try {
    if (!command.type || !command.objectType) {
      throw new Error("Неверный формат команды: отсутствует type или objectType");
    }

    switch(command.type) {
      case "create":
        handleCreateCommand(command, commandFromServer);
        break;

      case "update":
        handleUpdateCommand(command, commandFromServer);
        break;

      case "delete":
        handleDeleteCommand(command, commandFromServer);
        break;

      default:
        throw new Error(`Неизвестный тип команды: ${command.type}`);
    }

    if (!commandFromServer) {
      alert("Команда успешно выполнена");
    }
  } catch (error) {
    if (!commandFromServer) {
      alert(`Ошибка выполнения команды: ${error.message}`);
    }
    console.error(error);
  }
}

function handleCreateCommand(command, commandFromServer) {
  if (!command.data) {
    throw new Error("Отсутствует data в команде создания");
  }

  switch(command.objectType) {
    case "board":
      createBoardFromCommand(command.data, commandFromServer);
      break;

    case "column":
      createColumnFromCommand(command.data, commandFromServer);
      break;

    case "card":
      createCardFromCommand(command.data, commandFromServer);
      break;

    default:
      throw new Error(`Неизвестный тип объекта для создания: ${command.objectType}`);
  }
}

function handleUpdateCommand(command, commandFromServer) {
  if (!command.id && command.id !== 0) {
    throw new Error("Отсутствует id в команде обновления");
  }

  if (!command.data) {
    throw new Error("Отсутствует data в команде обновления");
  }

  switch(command.objectType) {
    case "board":
      updateBoardFromCommand(command.id, command.data, commandFromServer);
      break;

    case "column":
      updateColumnFromCommand(command.id, command.data, commandFromServer);
      break;

    case "card":
      updateCardFromCommand(command.id, command.data, commandFromServer);
      break;

    default:
      throw new Error(`Неизвестный тип объекта для обновления: ${command.objectType}`);
  }
}

function handleDeleteCommand(command, commandFromServer) {
  if (!command.id && command.id !== 0) {
    throw new Error("Отсутствует id в команде удаления");
  }

  switch(command.objectType) {
    case "board":
      deleteBoardFromCommand(command.id, commandFromServer);
      break;

    case "column":
      deleteColumnFromCommand(command.id, commandFromServer);
      break;

    case "card":
      deleteCardFromCommand(command.id, commandFromServer);
      break;

    default:
      throw new Error(`Неизвестный тип объекта для удаления: ${command.objectType}`);
  }
}

async function createBoardFromCommand(data, commandFromServer = false) {
  // If command comes from server, use provided ID; otherwise, fetch new ID
  const boardId = commandFromServer ? data.id : await generateId('board');
  if (!boardId && boardId !== 0) {
    throw new Error("Не удалось получить ID для доски");
  }

  // Если команда от сервера, x и y — нормализованные (0..1), преобразуем в пиксели
  const x = commandFromServer ? data.x * stage.width() : (data.x || 100);
  const y = commandFromServer ? data.y * stage.height() : (data.y || 100);
  const title = data.title || "Новая доска";

  const board = new Konva.Group({
    x: x,
    y: y,
    draggable: true
  });
  board.setAttr('id', boardId);

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
    text: title,
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

  if (!commandFromServer) {
    // Отправляем нормализованные координаты при создании
    await logChange('create', 'board', {
      id: boardId,
      title: title,
      x: x / stage.width(),
      y: y / stage.height()
    });
  }

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
  .on('dragend', async () => {
    document.body.style.cursor = 'default';
    scheduleRedraw();
    // Отправляем нормализованные координаты
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await logChange('update', 'board', {
          id: board.getAttr('id'),
          new: {
            x: board.x() / stage.width(),
            y: board.y() / stage.height()
          }
        });
        break;
      } catch (error) {
        if (attempt === maxRetries) {
          alert('Ошибка отправки координат доски. Попробуйте снова.');
        }
        // Ждём перед следующей попыткой
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  });

  scheduleRedraw();
  return board;
}

function createBoardFromData(data) {
  const x = data.x || 100;
  const y = data.y || 100;
  const title = data.title || "Новая доска";
  const boardId = data.id;

  const board = new Konva.Group({
    x: x,
    y: y,
    draggable: true
  });
  board.setAttr('id', boardId);

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
    text: title,
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
  .on('dragend', async () => {
    document.body.style.cursor = 'default';
    scheduleRedraw();
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await logChange('update', 'board', {
          id: board.getAttr('id'),
          new: {
            x: board.x() / stage.width(),
            y: board.y() / stage.height()
          }
        });
        break;
      } catch (error) {
        if (attempt === maxRetries) {
          alert('Ошибка отправки координат доски. Попробуйте снова.');
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  });

  scheduleRedraw();
  return board;
}

async function createColumnFromCommand(data, commandFromServer = false) {
  if (!data.boardId && data.boardId !== 0) {
    throw new Error("Не указан boardId для создания колонки");
  }

  const board = findBoardById(data.boardId);
  if (!board) {
    throw new Error(`Доска с ID ${data.boardId} не найдена`);
  }

  // If command comes from server, use provided ID; otherwise, fetch new ID
  const columnId = commandFromServer ? data.id : await generateId('column');
  if (!columnId && columnId !== 0) {
    throw new Error("Не удалось получить ID для колонки");
  }

  const title = data.title || "Новая колонка";
  const cols = board.find('.kanban-column');
  const index = cols.length + 1;
  const btn = board.findOne('.add-column-button');
  const xPos = getColumnX(board, index);

  const col = new Konva.Group({
    x: xPos,
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

  col.setAttr('id', columnId);
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
    text: title,
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
  col.setAttr('index', index);
  btn.x(getColumnX(board, index + 1));

  const boardBg = board.findOne('Rect');
  boardBg.width(getColumnX(board, index + 1) + ADD_COLUMN_BUTTON_WIDTH + COLUMN_MARGIN);
  board.findOne('Text').width(boardBg.width() - 40);

  setupColumnDragEvents(col, board);
  recalcBoardHeight(board);

  if (!commandFromServer) {
    await logChange('create', 'column', {
      id: columnId,
      title: title,
      boardId: board.getAttr('id')
    });
  }

  scheduleRedraw();
  return col;
}

function createColumnFromData(data, board, index) {
  const title = data.title || "Новая колонка";
  const columnId = data.id;
  const xPos = getColumnX(board, index);

  const col = new Konva.Group({
    x: xPos,
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

  col.setAttr('id', columnId);
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
    text: title,
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
  col.setAttr('index', index);

  const btn = board.findOne('.add-column-button');
  btn.x(getColumnX(board, index + 1));

  const boardBg = board.findOne('Rect');
  boardBg.width(getColumnX(board, index + 1) + ADD_COLUMN_BUTTON_WIDTH + COLUMN_MARGIN);
  board.findOne('Text').width(boardBg.width() - 40);

  setupColumnDragEvents(col, board);
  scheduleRedraw();
  return col;
}

async function createCardFromCommand(data, commandFromServer = false) {
  if (!data.columnId && data.columnId !== 0) {
    throw new Error("Не указан columnId для создания карточки");
  }

  const column = findColumnById(data.columnId);
  if (!column) {
    throw new Error(`Колонка с ID ${data.columnId} не найдена`);
  }

  // If command comes from server, use provided ID; otherwise, fetch new ID
  const cardId = commandFromServer ? data.id : await generateId('card');
  if (!cardId && cardId !== 0) {
    throw new Error("Не удалось получить ID для карточки");
  }

  const board = column.getParent();
  const title = data.title || "Новая карточка";
  const content = data.content || "";
  const cards = column.find('.card');
  const index = cards.length + 1;
  const yOff = getCardY(column, index);

  const card = new Konva.Group({
    x: CARD_MARGIN,
    y: yOff,
    name: 'card',
    draggable: true
  });

  card.setAttr('id', cardId);

  const cardTxt = new Konva.Text({
    text: title,
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
  card.content = content;

  column.add(card);
  card.setAttr('index', index);

  card.on('click tap', function(e) {
    if (!e.evt.ctrlKey && !e.evt.metaKey && !e.evt.shiftKey) {
      showModal('card', this, cardTxt.text().split('\n')[0], this.content || '');
    }
  });

  setupCardDragEvents(card);

  const addBtn = column.findOne('.add-card-button');
  addBtn.y(yOff + cardHeight + CARD_MARGIN);
  reorderCardsInColumn(column);
  recalcBoardHeight(board);

  if (!commandFromServer) {
    await logChange('create', 'card', {
      id: cardId,
      title: title,
      content: content,
      columnId: column.getAttr('id')
    });
  }

  scheduleRedraw();
  return card;
}

function createCardFromData(data, column, index) {
  const board = column.getParent();
  const title = data.title || "Новая карточка";
  const content = data.content || "";
  const cardId = data.id;
  const yOff = getCardY(column, index);

  const card = new Konva.Group({
    x: CARD_MARGIN,
    y: yOff,
    name: 'card',
    draggable: true
  });

  card.setAttr('id', cardId);

  const cardTxt = new Konva.Text({
    text: title,
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
  card.content = content;

  column.add(card);
  card.setAttr('index', index);

  card.on('click tap', function(e) {
    if (!e.evt.ctrlKey && !e.evt.metaKey && !e.evt.shiftKey) {
      showModal('card', this, cardTxt.text().split('\n')[0], this.content || '');
    }
  });

  setupCardDragEvents(card);

  scheduleRedraw();
  return card;
}

async function updateBoardFromCommand(id, data, commandFromServer = false) {
  const board = findBoardById(id);
  if (!board) {
    throw new Error(`Доска с ID ${id} не найдена`);
  }

  const oldTitle = board.findOne('Text').text();
  const oldX = board.x();
  const oldY = board.y();

  if (data.title !== undefined) {
    const header = board.findOne('Text');
    header.text(data.title);
  }

  if (data.x !== undefined || data.y !== undefined) {
    // Преобразуем нормализованные координаты в пиксели
    const newX = data.x !== undefined ? data.x * stage.width() : board.x();
    const newY = data.y !== undefined ? data.y * stage.height() : board.y();
    board.x(newX);
    board.y(newY);
  }

  if (!commandFromServer) {
    logChange('update', 'board', {
      id: id,
      old: {
        title: oldTitle,
        x: oldX / stage.width(),
        y: oldY / stage.height()
      },
      new: {
        title: data.title !== undefined ? data.title : oldTitle,
        x: (data.x !== undefined ? data.x : oldX / stage.width()),
        y: (data.y !== undefined ? data.y : oldY / stage.height())
      }
    });
  }

  scheduleRedraw();
  return board;
}

async function updateColumnFromCommand(id, data, commandFromServer = false) {
  const column = findColumnById(id);
  if (!column) {
    throw new Error(`Колонка с ID ${id} не найдена`);
  }

  const oldBoard = column.getParent();
  const oldTitle = column.findOne('Text').text();
  const oldIndex = column.getAttr('index');

  if (data.title !== undefined) {
    const header = column.findOne('Text');
    header.text(data.title);
  }

  if (data.boardId !== undefined && data.boardId !== oldBoard.getAttr('id')) {
    const newBoard = findBoardById(data.boardId);
    if (!newBoard) {
      throw new Error(`Доска с ID ${data.boardId} не найдена`);
    }

    column.remove();
    newBoard.add(column);

    const newIndex = data.index !== undefined ? data.index : newBoard.find('.kanban-column').length + 1;
    column.setAttr('index', newIndex);

    reorderColumnsInBoard(newBoard);
    recalcBoardHeight(newBoard);
    reorderColumnsInBoard(oldBoard);
    recalcBoardHeight(oldBoard);

    if (!commandFromServer) {
      await logChange('update', 'column', {
        id: id,
        old: {
          title: oldTitle,
          boardId: oldBoard.getAttr('id'),
          index: oldIndex
        },
        new: {
          title: data.title !== undefined ? data.title : oldTitle,
          boardId: data.boardId,
          index: newIndex
        }
      });
    }

    scheduleRedraw();
    return column;
  }

  if (data.index !== undefined && data.index !== column.getAttr('index')) {
    const columns = oldBoard.find('.kanban-column');
    const currentIndex = column.getAttr('index');
    const newIndex = Math.min(Math.max(1, data.index), columns.length);

    if (currentIndex !== newIndex) {
      column.setAttr('index', newIndex);

      columns.forEach(col => {
        if (col !== column) {
          const idx = col.getAttr('index');
          if (currentIndex < newIndex && idx > currentIndex && idx <= newIndex) {
            col.setAttr('index', idx - 1);
          } else if (currentIndex > newIndex && idx < currentIndex && idx >= newIndex) {
            col.setAttr('index', idx + 1);
          }
        }
      });

      reorderColumnsInBoard(oldBoard);
      recalcBoardHeight(oldBoard);

      if (!commandFromServer) {
        await logChange('update', 'column', {
          id: id,
          old: {
            title: oldTitle,
            boardId: oldBoard.getAttr('id'),
            index: oldIndex
          },
          new: {
            title: column.findOne('Text').text(),
            boardId: oldBoard.getAttr('id'),
            index: newIndex
          }
        });
      }
    }
  } else if (data.title !== undefined) {
    if (!commandFromServer) {
      await logChange('update', 'column', {
        id: id,
        old: {
          title: oldTitle,
          boardId: oldBoard.getAttr('id'),
          index: oldIndex
        },
        new: {
          title: data.title,
          boardId: oldBoard.getAttr('id'),
          index: oldIndex
        }
      });
    }
  }

  scheduleRedraw();
  return column;
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

async function updateCardFromCommand(id, data, commandFromServer = false) {
  const card = findCardById(id);
  if (!card) {
    throw new Error(`Карточка с ID ${id} не найдена`);
  }

  const oldColumn = card.getParent();
  const oldBoard = oldColumn.getParent();
  const oldTitle = card.findOne('Text').text();
  const oldContent = card.content;
  const oldIndex = card.getAttr('index');

  if (data.title !== undefined) {
    const cardText = card.findOne('Text');
    cardText.text(data.title);
    const cardBg = card.findOne('Rect');
    const newHeight = calculateCardHeight(cardText);
    cardBg.height(newHeight);
    cardText.y((newHeight - cardText.height()) / 2);
  }

  if (data.content !== undefined) {
    card.content = data.content;
  }

  let newColumn = oldColumn;
  if (data.columnId !== undefined && data.columnId !== oldColumn.getAttr('id')) {
    newColumn = findColumnById(data.columnId);
    if (!newColumn) {
      throw new Error(`Колонка с ID ${data.columnId} не найдена`);
    }

    card.remove();
    newColumn.add(card);
    card.x(CARD_MARGIN);
    card.y(getCardY(newColumn, data.index || newColumn.find('.card').length + 1));
  }

  if (data.index !== undefined) {
    card.setAttr('index', data.index);

    const cards = newColumn.find('.card');
    const sortedCards = Array.from(cards).sort((a, b) => a.y() - b.y());
    const currentIndex = sortedCards.findIndex(c => c.getAttr('id') === id);

    if (currentIndex !== -1) {
      sortedCards.splice(currentIndex, 1);
      const newIndex = Math.min(Math.max(0, data.index - 1), sortedCards.length);
      sortedCards.splice(newIndex, 0, card);

      let y = 40 + CARD_MARGIN;
      sortedCards.forEach((c, i) => {
        c.setAttr('index', i + 1);
        c.y(y);
        const cardBg = c.findOne('Rect');
        y += cardBg.height() + CARD_MARGIN;
      });

      const addBtn = newColumn.findOne('.add-card-button');
      addBtn.y(y);
      newColumn.findOne('Rect').height(y + MIN_CARD_HEIGHT + CARD_MARGIN);
    }
  }

  if (newColumn === oldColumn && data.index !== undefined) {
    reorderCardsInColumn(oldColumn);
    recalcBoardHeight(oldBoard);
  } else if (newColumn !== oldColumn) {
    reorderCardsInColumn(oldColumn);
    reorderCardsInColumn(newColumn);
    recalcBoardHeight(oldBoard);
    recalcBoardHeight(newColumn.getParent());
  }

  if (!commandFromServer) {
    await logChange('update', 'card', {
      id: id,
      old: {
        title: oldTitle,
        content: oldContent,
        columnId: oldColumn.getAttr('id'),
        index: oldIndex
      },
      new: {
        title: data.title !== undefined ? data.title : oldTitle,
        content: data.content !== undefined ? data.content : oldContent,
        columnId: newColumn.getAttr('id'),
        index: data.index !== undefined ? data.index : oldIndex
      }
    });
  }

  scheduleRedraw();
  return card;
}

async function deleteBoardFromCommand(id, commandFromServer = false) {
  const board = findBoardById(id);
  if (!board) {
    throw new Error(`Доска с ID ${id} не найдена`);
  }

  if (!commandFromServer) {
    await logChange('delete', 'board', {
      id: id
    });
  }

  const index = stage.kanbanBoards.indexOf(board);
  if (index !== -1) {
    stage.kanbanBoards.splice(index, 1);
  }

  board.destroy();
  scheduleRedraw();
}

async function deleteColumnFromCommand(id, commandFromServer = false) {
  const column = findColumnById(id);
  if (!column) {
    throw new Error(`Колонка с ID ${id} не найдена`);
  }

  const board = column.getParent();

  if (!commandFromServer) {
    await logChange('delete', 'column', {
      id: id
    });
  }

  column.destroy();

  const cols = board.find('.kanban-column');
  if (cols.length === 0) {
    const boardIndex = stage.kanbanBoards.indexOf(board);
    if (boardIndex !== -1) {
      stage.kanbanBoards.splice(boardIndex, 1);
    }
    board.destroy();
  } else {
    const btn = board.findOne('.add-column-button');
    cols.forEach((col, i) => {
      col.setAttr('index', i + 1);
      col.x(getColumnX(board, i + 1));
    });
    btn.x(getColumnX(board, cols.length + 1));
    const boardBg = board.findOne('Rect');
    boardBg.width(getColumnX(board, cols.length + 1) + ADD_COLUMN_BUTTON_WIDTH + COLUMN_MARGIN);
    board.findOne('Text').width(boardBg.width() - 40);
    recalcBoardHeight(board);
  }

  scheduleRedraw();
}

async function deleteCardFromCommand(id, commandFromServer = false) {
  const card = findCardById(id);
  if (!card) {
    throw new Error(`Карточка с ID ${id} не найдена`);
  }

  const column = card.getParent();
  const board = column.getParent();

  if (!commandFromServer) {
    await logChange('delete', 'card', {
      id: id
    });
  }

  card.destroy();
  reorderCardsInColumn(column);
  recalcBoardHeight(board);
  scheduleRedraw();
}

function findBoardById(id) {
  return stage.kanbanBoards.find(board => board.getAttr('id') === id);
}

function findColumnById(id) {
  for (const board of stage.kanbanBoards) {
    const columns = board.find(node => node.hasName('kanban-column'));
    for (const column of columns) {
      if (column.getAttr('id') === id) {
        return column;
      }
    }
  }
  return null;
}

function findCardById(id) {
  for (const board of stage.kanbanBoards) {
    const columns = board.find(node => node.hasName('kanban-column'));
    for (const column of columns) {
      const cards = column.find(node => node.hasName('card'));
      for (const card of cards) {
        if (card.getAttr('id') === id) {
          return card;
        }
      }
    }
  }
  return null;
}

debugToggle.addEventListener('click', () => {
  const isVisible = debugPanel.style.display === 'block';
  debugPanel.style.display = isVisible ? 'none' : 'block';
  debugToggle.textContent = isVisible ? 'Показать структуру' : 'Скрыть структуру';
});

applyCommandBtn.addEventListener('click', applyCommand);

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
}

async function updateElementFromInputs() {
  if (!currentEditingElement || !currentElementType) return;

  const oldData = {
    title: currentElementType === 'card'
      ? currentEditingElement.findOne('Text').text()
      : currentEditingElement.findOne('Text').text(),
    ...(currentElementType === 'card' ? { content: currentEditingElement.content } : {})
  };

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

    await logChange('update', 'card', {
      id: currentEditingElement.getAttr('id'),
      old: oldData,
      new: { title, content }
    });
  } else if (currentElementType === 'column') {
    const title = columnTitleInput.value;
    const header = currentEditingElement.findOne('Text');

    await logChange('update', 'column', {
      id: currentEditingElement.getAttr('id'),
      old: { title: header.text() },
      new: { title }
    });

    header.text(title);
  } else if (currentElementType === 'board') {
    const title = boardTitleInput.value;
    const header = currentEditingElement.findOne('Text');

    await logChange('update', 'board', {
      id: currentEditingElement.getAttr('id'),
      old: { title: header.text() },
      new: { title }
    });

    header.text(title);
  }
  scheduleRedraw();
}

async function deleteCurrentElement() {
  if (!currentEditingElement || !currentElementType) return;

  if (currentElementType === 'card') {
    await logChange('delete', 'card', {
      id: currentEditingElement.getAttr('id')
    });
    const column = currentEditingElement.getParent();
    currentEditingElement.destroy();
    reorderCardsInColumn(column);
    recalcBoardHeight(column.getParent());
  } else if (currentElementType === 'column') {
    await logChange('delete', 'column', {
      id: currentEditingElement.getAttr('id')
    });
    const board = currentEditingElement.getParent();
    currentEditingElement.destroy();
    const cols = board.find('.kanban-column');
    if (cols.length === 0) {
      const boardIndex = stage.kanbanBoards.indexOf(board);
      if (boardIndex !== -1) {
        stage.kanbanBoards.splice(boardIndex, 1);
      }
      board.destroy();
    } else {
      const btn = board.findOne('.add-column-button');
      cols.forEach((col, i) => {
        col.setAttr('index', i + 1);
        col.x(getColumnX(board, i + 1));
      });
      btn.x(getColumnX(board, cols.length + 1));
      const boardBg = board.findOne('Rect');
      boardBg.width(getColumnX(board, cols.length + 1) + ADD_COLUMN_BUTTON_WIDTH + COLUMN_MARGIN);
      board.findOne('Text').width(boardBg.width() - 40);
      recalcBoardHeight(board);
    }
  } else if (currentElementType === 'board') {
    await logChange('delete', 'board', {
      id: currentEditingElement.getAttr('id')
    });
    const index = stage.kanbanBoards.indexOf(currentEditingElement);
    if (index !== -1) {
      stage.kanbanBoards.splice(index, 1);
    }
    currentEditingElement.destroy();
  }

  hideModals();
  currentEditingElement = null;
  currentElementType = null;
  scheduleRedraw();
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
  if (previewBoard) {
    previewBoard.destroy();
  }
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
    shadowOffset: { x: 5, y: 5 },
    isUserTool: true
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
  if (!pos) return;
  updatePreviewBoardPosition(pos.x, pos.y);
});

stage.on('click tap', function(e) {
  if (!isCreatingBoard || !previewBoard) return;
  const pos = stage.getPointerPosition();
  if (!pos) return;
  addKanbanBoard(pos.x, pos.y);
  cancelBoardCreation();
});

async function addKanbanBoard(x, y) {
  // Fetch ID before creating the board
  const boardId = await generateId('board');
  if (!boardId && boardId !== 0) {
    throw new Error("Не удалось получить ID для доски");
  }

  const boardWidth = COLUMN_WIDTH + COLUMN_MARGIN * 2 + ADD_COLUMN_BUTTON_WIDTH;
  const boardX = x - boardWidth / 2;
  const boardY = y - INITIAL_BOARD_HEIGHT / 2;

  const board = new Konva.Group({
    x: boardX,
    y: boardY,
    draggable: true
  });

  board.setAttr('id', boardId);

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
    text: 'Доска Kanban ' + (stage.kanbanBoards.length + 1),
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

  await logChange('create', 'board', {
    id: boardId,
    title: header.text(),
    x: boardX / stage.width(),
    y: boardY / stage.height()
  });

  addColumnToBoard(board);
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
  .on('dragend', async () => {
    document.body.style.cursor = 'default';
    scheduleRedraw();
    // Отправляем нормализованные координаты
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await logChange('update', 'board', {
          id: board.getAttr('id'),
          new: {
            x: board.x() / stage.width(),
            y: board.y() / stage.height()
          }
        });
        break;
      } catch (error) {
        if (attempt === maxRetries) {
          alert('Ошибка отправки координат доски. Попробуйте снова.');
        }
        // Ждём перед следующей попыткой
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  });
  scheduleRedraw();
}

function createAddColumnButton(board) {
  const btn = new Konva.Group({
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
  btn.add(bg, txt).on('click tap', e => {
    e.cancelBubble = true;
    addColumnToBoard(board);
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
  // Fetch ID before creating the column
  const columnId = await generateId('column');
  if (!columnId && columnId !== 0) {
    throw new Error("Не удалось получить ID для колонки");
  }

  const cols = board.find('.kanban-column');
  const index = cols.length + 1;
  const btn = board.findOne('.add-column-button');
  const xPos = getColumnX(board, index);

  const col = new Konva.Group({
    x: xPos,
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

  col.setAttr('id', columnId);

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
    text: 'Колонка ' + index,
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
  col.setAttr('index', index);
  btn.x(getColumnX(board, index + 1));
  const boardBg = board.findOne('Rect');
  boardBg.width(getColumnX(board, index + 1) + ADD_COLUMN_BUTTON_WIDTH + COLUMN_MARGIN);
  board.findOne('Text').width(boardBg.width() - 40);
  setupColumnDragEvents(col, board);
  recalcBoardHeight(board);

  await logChange('create', 'column', {
    id: columnId,
    title: header.text(),
    boardId: board.getAttr('id')
  });
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
      if (draggedCenterX > centerX) {
        newIndex = i + 1;
      }
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
  .on('dragend', async function() {
    document.body.style.cursor = 'default';
    isDragging = false;
    currentTweens.forEach(tween => tween.destroy());
    currentTweens = [];
    const cols = board.find('.kanban-column').sort((a, b) => a.x() - b.x());
    for (let i = 0; i < cols.length; i++) {
      const col = cols[i];
      if (col.getAttr('index') !== i + 1) {
        await logChange('reorder', 'column', {
          id: col.getAttr('id'),
          newIndex: i + 1
        });
      }
      col.setAttr('index', i + 1);
      col.x(getColumnX(board, i + 1));
    }
    const btn = board.findOne('.add-column-button');
    btn.x(getColumnX(board, cols.length + 1));
    const boardBg = board.findOne('Rect');
    boardBg.width(getColumnX(board, cols.length + 1) + ADD_COLUMN_BUTTON_WIDTH + COLUMN_MARGIN);
    board.findOne('Text').width(boardBg.width() - 40);
    recalcBoardHeight(board);
    scheduleRedraw();
  });
}

function calculateCardHeight(textNode) {
  textNode.height('auto');
  const textHeight = textNode.height();
  const calculatedHeight = textHeight + 2 * CARD_PADDING;
  return Math.max(calculatedHeight, MIN_CARD_HEIGHT);
}

async function addCardToColumn(column, board) {
  const cards = column.find('.card');
  const index = cards.length + 1;
  const yOff = getCardY(column, index);

  const cardId = await generateId('card');
  const card = new Konva.Group({
    x: CARD_MARGIN,
    y: yOff,
    name: 'card',
    draggable: true
  });

  card.setAttr('id', cardId);

  const cardTxt = new Konva.Text({
    text: 'Карточка ' + index,
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
  card.content = '';
  column.add(card);
  card.setAttr('index', index);
  card.on('click tap', function(e) {
    if (!e.evt.ctrlKey && !e.evt.metaKey && !e.evt.shiftKey) {
      showModal('card', this, cardTxt.text().split('\n')[0], this.content || '');
    }
  });
  setupCardDragEvents(card);
  const addBtn = column.findOne('.add-card-button');
  addBtn.y(yOff + cardHeight + CARD_MARGIN);
  reorderCardsInColumn(column);
  recalcBoardHeight(board);

  await logChange('create', 'card', {
    id: cardId,
    title: cardTxt.text(),
    content: card.content,
    columnId: column.getAttr('id')
  });
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
      if (draggedCenterY > centerY) {
        newIndex = i + 1;
      }
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
  .on('dragend', async function() {
    document.body.style.cursor = 'default';
    cardTweens.forEach(t => t.destroy());
    cardTweens = [];
    await handleCardDrop(this);
    scheduleRedraw();
  });
}

function reorderCardsInColumn(column) {
  const cards = column.find('.card').sort((a, b) => a.y() - b.y());
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

async function handleCardDrop(card) {
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
      if (centerX > colPos.x &&
          centerX < colPos.x + COLUMN_WIDTH &&
          centerY > colPos.y &&
          centerY < colPos.y + colHeight) {
        targetCol = c;
        targetBoard = b;
      }
    });
  });
  const startCol = card.startCol;
  const startBoard = card.startCol.getParent();

  if (targetCol) {
    const targetColPos = targetCol.getAbsolutePosition();
    const localY = centerY - targetColPos.y - cardHeight / 2;
    card.moveTo(targetCol);
    card.x(CARD_MARGIN);
    card.y(localY);

    // Сохраняем старый индекс до обновления
    const oldIndex = card.getAttr('index');

    // Пересчитываем индекс в целевой колонке
    const cardsInTargetCol = targetCol.find('.card').sort((a, b) => a.y() - b.y());
    let newIndex = 1; // Индексы начинаются с 1
    for (let i = 0; i < cardsInTargetCol.length; i++) {
      if (cardsInTargetCol[i] === card) continue;
      const cardCenterY = cardsInTargetCol[i].y() + cardsInTargetCol[i].findOne('Rect').height() / 2;
      if (localY < cardCenterY) {
        break; // Найдена позиция вставки
      }
      newIndex++;
    }

    // Устанавливаем новый индекс
    card.setAttr('index', newIndex);

    // Отправляем команду в зависимости от ситуации
    if (targetCol !== startCol) {
      await logChange('move', 'card', {
        id: card.getAttr('id'),
        toColumn: targetCol.getAttr('id'),
        newIndex: newIndex
      });
    } else if (newIndex !== oldIndex) {
      await logChange('reorder', 'card', {
        id: card.getAttr('id'),
        newIndex: newIndex
      });
    }

    reorderCardsInColumn(startCol);
    reorderCardsInColumn(targetCol);
    recalcBoardHeight(startBoard);
    if (targetBoard !== startBoard) {
      recalcBoardHeight(targetBoard);
    }
  } else {
    card.moveTo(startCol);
    card.x(card.startPos.x);
    card.y(card.startPos.y);
    reorderCardsInColumn(startCol);
    recalcBoardHeight(startBoard);
  }
}

function updateDebugInfo() {
  if (!debugPanel || debugPanel.style.display !== 'block') return;
  let html = '';
  html += `<div class="debug-section">
    <h3>Сцена (Stage)</h3>
    <div class="debug-property">
      <div class="debug-property-name">Ширина:</div>
      <div class="debug-property-value">${stage.width()}</div>
    </div>
    <div class="debug-property">
      <div class="debug-property-name">Высота:</div>
      <div class="debug-property-value">${stage.height()}</div>
    </div>
  </div>`;
  html += `<div class="debug-section">
    <h3>Доски (${stage.kanbanBoards.length})</h3>`;
  stage.kanbanBoards.forEach((board, boardIndex) => {
    const boardHeader = board.findOne('Text');
    const boardBg = board.findOne('Rect');
    html += `</br><div class="debug-object">
      <div class="debug-property">
        <div class="debug-property-name">Доска (ID: ${board.getAttr('id')}):</div>
        <div class="debug-property-value">${boardHeader.text()}</div>
      </div>
      <div class="debug-property">
        <div class="debug-property-name">Позиция:</div>
        <div class="debug-property-value">x: ${board.x()}, y: ${board.y()}</div>
      </div>
      <div class="debug-property">
        <div class="debug-property-name">Размеры:</div>
        <div class="debug-property-value">${boardBg.width()} × ${boardBg.height()}</div>
      </div>`;
    const columns = board.find('.kanban-column');
    html += `<div class="debug-property">
        <div class="debug-property-name">Колонки:</div>
        <div class="debug-property-value">${columns.length}</div>
      </div>`;
    columns.forEach((col, colIndex) => {
      const colHeader = col.findOne('Text');
      const colBg = col.findOne('Rect');
      html += `</br><div class="debug-object">
        <div class="debug-property">
          <div class="debug-property-name">Колонка (ID: ${col.getAttr('id')}, Индекс: ${col.getAttr('index')}):</div>
          <div class="debug-property-value">${colHeader.text()}</div>
        </div>
        <div class="debug-property">
          <div class="debug-property-name">Позиция:</div>
          <div class="debug-property-value">x: ${col.x()}, y: ${col.y()}</div>
        </div>
        <div class="debug-property">
          <div class="debug-property-name">Размеры:</div>
          <div class="debug-property-value">${colBg.width()} × ${colBg.height()}</div>
        </div>`;
      const cards = col.find('.card');
      html += `<div class="debug-property">
          <div class="debug-property-name">Карточки:</div>
          <div class="debug-property-value">${cards.length}</div>
        </div>`;
      cards.forEach((card, cardIndex) => {
        const cardText = card.findOne('Text');
        const cardBg = card.findOne('Rect');
        html += `</br><div class="debug-object">
          <div class="debug-property">
            <div class="debug-property-name">Карточка (ID: ${card.getAttr('id')}, Индекс: ${card.getAttr('index')}):</div>
            <div class="debug-property-value">${cardText.text().split('\n')[0]}</div>
          </div>
          <div class="debug-property">
            <div class="debug-property-name">Позиция:</div>
            <div class="debug-property-value">x: ${card.x()}, y: ${card.y()}</div>
          </div>
          <div class="debug-property">
            <div class="debug-property-name">Размеры:</div>
            <div class="debug-property-value">${cardBg.width()} × ${cardBg.height()}</div>
          </div>
          <div class="debug-property">
            <div class="debug-property-name">Содержание:</div>
            <div class="debug-property-value">${card.content || ''}</div>
          </div>
        </div>`;
      });
      html += `</div>`;
    });
    html += `</div>`;
  });
  debugContent.innerHTML = html;
}

initializeBoard();