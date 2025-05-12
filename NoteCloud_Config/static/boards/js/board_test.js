function getCookie(name) {
    const value = $.cookie(name);
    return value ? decodeURIComponent(value) : null;
}


document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('toggle_share');
    const panel = document.getElementById('share_panel');
    const searchInp = document.getElementById('share-search');
    const tabs = document.querySelectorAll('.share-tab');
    const listBox = document.getElementById('share-list');
    const spinner = document.getElementById('share-spinner');
    const loadMore = document.getElementById('share-load-more');

    let currentType = 'subscriptions';
    let offset = 0;
    const limit = 10;
    let lastSearch = '';

    // default-avatar SVG
    const defaultAvatar = `<svg  width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <g id="System / Camera">
                            <path id="Vector" d="M9.48898 7H6.2002C5.08009 7 4.51962 7 4.0918 7.21799C3.71547 7.40973 3.40973 7.71547 3.21799 8.0918C3 8.51962 3 9.08009 3 10.2002V15.8002C3 16.9203 3 17.4796 3.21799 17.9074C3.40973 18.2837 3.71547 18.5905 4.0918 18.7822C4.5192 19 5.07899 19 6.19691 19H17.8031C18.921 19 19.48 19 19.9074 18.7822C20.2837 18.5905 20.5905 18.2837 20.7822 17.9074C21 17.48 21 16.921 21 15.8031V10.1969C21 9.07899 21 8.5192 20.7822 8.0918C20.5905 7.71547 20.2837 7.40973 19.9074 7.21799C19.4796 7 18.9203 7 17.8002 7H14.5108M9.48898 7H9.55078M9.48898 7C9.50151 7.00001 9.51468 7 9.52857 7L9.55078 7M9.48898 7C9.38286 6.99995 9.32339 6.99941 9.27637 6.99414C8.68878 6.92835 8.28578 6.36908 8.40918 5.79084C8.42066 5.73703 8.44336 5.66894 8.4883 5.53412L8.49023 5.52841C8.54156 5.37443 8.56723 5.29743 8.59558 5.22949C8.88586 4.53389 9.54322 4.06083 10.2949 4.00541C10.3683 4 10.449 4 10.6113 4H13.3886C13.5509 4 13.6322 4 13.7057 4.00541C14.4574 4.06083 15.114 4.53389 15.4043 5.22949C15.4326 5.29743 15.4584 5.37434 15.5098 5.52832C15.556 5.66699 15.5791 5.73636 15.5908 5.79093C15.7142 6.36917 15.3118 6.92835 14.7242 6.99414C14.6772 6.99941 14.6171 6.99995 14.5108 7M9.55078 7H14.449M14.449 7H14.5108M14.449 7L14.4712 7C14.4851 7 14.4983 7.00001 14.5108 7M12 16C10.3431 16 9 14.6569 9 13C9 11.3431 10.3431 10 12 10C13.6569 10 15 11.3431 15 13C15 14.6569 13.6569 16 12 16Z" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                            style="stroke: #6f7276;"/>
                            </g>
                            </svg>`;

    // дебаунс
    function debounce(fn, delay) {
        let tid;
        return (...args) => {
            clearTimeout(tid);
            tid = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    function buildItem(u) {
        const avatar = u.avatar
        ? `<img src="${u.avatar}" width="40" height="40" style="border-radius:50%"/>`
        : defaultAvatar;
        return `
                <div class="share-item" data-username="${u.username}">
                <div class="avatar">${avatar}</div>
                <div class="username">${u.username}</div>
                <button
                    class="invite-btn"
                    data-user-id="${u.id}"
                    data-username="${u.username}"
                >Пригласить</button>
                </div>`;
    }

    async function loadList({ append = false } = {}) {
        // перед запросом — показываем спиннер и очищаем блок
        if (!append) {
            listBox.innerHTML = '';
            loadMore.style.display = 'none';
        }
        spinner.style.display = 'block';
        loadMore.disabled = true;

        const params = new URLSearchParams({
            offset, limit,
            type: currentType,
            search: lastSearch,
        });
        const resp = await fetch(`/workspace/api/sub_and_users/?` + params);
        const { results: data, has_more } = await resp.json();

        // прячем спиннер
        spinner.style.display = 'none';
        loadMore.disabled = false;

        data.forEach(u => listBox.insertAdjacentHTML('beforeend', buildItem(u)));

        // «Загрузить ещё»
        loadMore.style.display = has_more ? 'block' : 'none';
    }

    // переключаем панель
    toggleBtn.addEventListener('click', e => {
        e.stopPropagation();
        panel.classList.toggle('show');
        toggleBtn.classList.toggle('active');
        if (panel.classList.contains('show')) {
            offset = 0; lastSearch = ''; searchInp.value = '';
            loadList({ append: false });
        }
    });

    // клики вне
    window.addEventListener('click', e => {
        if (!panel.contains(e.target) && !toggleBtn.contains(e.target)) {
            panel.classList.remove('show');
            toggleBtn.classList.remove('active');
        }
    });

    // табы
    tabs.forEach(tab => tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentType = tab.dataset.type;
        offset = 0; lastSearch = ''; searchInp.value = '';
        loadList({ append: false });
    }));

    // «Загрузить ещё»
    loadMore.addEventListener('click', () => {
        offset += limit;
        loadList({ append: true });
    });

    // поиск с дебаунсом 100 мс
    searchInp.addEventListener('input',
        debounce(() => {
            lastSearch = searchInp.value.trim();
            offset = 0;
            loadList({ append: false });
        }, 100)
    );

    // Делегируем клик по кнопкам внутри списка
    listBox.addEventListener('click', async e => {
        const btn = e.target.closest('.invite-btn');
        if (!btn) return;

        const userId = btn.dataset.userId;
        const username = btn.dataset.username;
        const payload  = { user_id: Number(userId), user: username };

        btn.disabled = true;

        try {
            const csrftoken = getCookie('csrftoken');
            const resp = await fetch('/workspace/api/invite/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
                 body: JSON.stringify(payload),
            });
            if (!resp.ok) throw new Error(`Server error: ${resp.status}`);
            const data = await resp.json();
            console.log('Notification created:', data);
            // можно показать какое-нибудь подтверждение
        } catch (err) {
            console.error(err);
            alert('Не удалось отправить приглашение');
        } finally {
            btn.disabled = false;
        }
    });
});



// ДОСКА
// Инициализация Stage
const stage = new Konva.Stage({
    container: 'container',
    width: window.innerWidth,
    height: window.innerHeight,
});

// Основной слой
const layer = new Konva.Layer();
stage.add(layer);

// Переменные состояния
let currentMode = 'select';
let isDrawing = false;
let isDrawingShape = false;
let currentLine = null;
let currentShape = null;
let shapeType = 'rect';
let isPanning = false;
let lastPos = null;
let transformer = null;
let currentZoom = 1;
let selectionRectangle = null;
let x1, y1, x2, y2;
let lastWheelEventTime = 0;
const baseZoomSensitivity = 0.01;
const THROTTLE_DELAY = 100; // миллисекунд
let lastSentTime = 0;
let idCounter = 1;

// Настройки рисования
let drawSettings = {
    strokeWidth: 5,
    strokeColor: '#000000'
};

// Фиксированные настройки для фигур
const shapeSettings = {
    strokeWidth: 5,
    strokeColor: '#000000',
    fillColor: 'transparent'
};

// Переменные для обработки мультитача
let initialDistance = null;
let initialCenter = null;
let initialPosition = null;
let initialScale = 1;

// Функция генерации ID
function generateId() {
    return 'obj-' + idCounter++;
}

// Функция логирования изменений
function logChange(type, obj, changedAttrs = null) {
    const changeData = {
        timestamp: new Date().toISOString(),
        type: type,
        id: obj.id(),
        attrs: type === 'U' && changedAttrs ? changedAttrs : getObjectAttributes(obj)
    };

    console.log(JSON.stringify(changeData));

    const outputDiv = document.getElementById('json-output') || document.createElement('div');
    outputDiv.id = 'json-output';
    if (!outputDiv.hasChildNodes()) {
        const header = document.createElement('div');
        header.textContent = 'JSON Output:';
        header.style.fontWeight = 'bold';
        header.style.marginBottom = '10px';
        outputDiv.appendChild(header);
        document.body.appendChild(outputDiv);
    }

    const newEntry = document.createElement('div');
    newEntry.textContent = JSON.stringify(changeData, null, 2);
    outputDiv.appendChild(newEntry);
    outputDiv.scrollTop = outputDiv.scrollHeight;

    return changeData;
}

// Получение атрибутов объекта
function getObjectAttributes(obj) {
    const attrs = {
        x: obj.x(),
        y: obj.y(),
        rotation: obj.rotation(),
        scaleX: obj.scaleX ? obj.scaleX() : 1,
        scaleY: obj.scaleY ? obj.scaleY() : 1,
        stroke: obj.stroke(),
        strokeWidth: obj.originalStrokeWidth || obj.strokeWidth(),
        name: obj.getClassName().toLowerCase(),
    };
    if (obj.getClassName() === 'Rect') {
        attrs.width = obj.width();
        attrs.height = obj.height();
        attrs.fill = obj.fill();
    } else if (obj.getClassName() === 'Circle') {
        attrs.radius = obj.radius();
        attrs.fill = obj.fill();
    } else if (obj.getClassName() === 'RegularPolygon') {
        attrs.sides = obj.sides();
        attrs.radius = obj.radius();
        attrs.fill = obj.fill();
    } else if (obj.getClassName() === 'Line') {
        attrs.points = obj.points();
    }
    return attrs;
}

// Настройка отслеживания изменений объекта
function setupChangeTracking(obj) {
    let lastAttrs = getObjectAttributes(obj);
    logChange('C', obj);

    obj.on('transform dragmove', () => handleObjectChange(obj, lastAttrs));

    obj.on('transformend dragend', () => {
        logChange('U', obj);
    });
}

// Обработка изменений объекта с троттлингом
function handleObjectChange(obj, lastAttrs) {
    const currentAttrs = getObjectAttributes(obj);
    const changedAttrs = {};
    let hasChanges = false;

    for (const key in currentAttrs) {
        if (JSON.stringify(currentAttrs[key]) !== JSON.stringify(lastAttrs[key])) {
            changedAttrs[key] = currentAttrs[key];
            hasChanges = true;
        }
    }

    if (!hasChanges) return;

    Object.assign(lastAttrs, currentAttrs);

    const now = Date.now();
    if (now - lastSentTime >= THROTTLE_DELAY) {
        lastSentTime = now;
        logChange('U', obj, changedAttrs);
    }
}

// Функция для обновления предпросмотра линии
function updateLinePreview() {
    const maxSize = 20;
    const outerCircle = document.getElementById('line-preview-outer');
    const innerCircle = document.getElementById('line-preview-inner');

    const innerSize = (drawSettings.strokeWidth / 20) * maxSize;

    outerCircle.style.width = maxSize + 'px';
    outerCircle.style.height = maxSize + 'px';

    innerCircle.style.width = innerSize + 'px';
    innerCircle.style.height = innerSize + 'px';
    innerCircle.style.color = drawSettings.strokeColor;
}

// Функция для выбора цвета через color picker
function setupColorPicker() {
    const colorPicker = document.getElementById('color-picker');
    const colorInput = document.getElementById('line-color');

    colorPicker.addEventListener('click', function() {
        colorInput.click();
    });

    colorInput.addEventListener('input', function() {
        const color = this.value;
        drawSettings.strokeColor = color;
        updateLinePreview();
    });
}

// Модифицируем toJSON для сохранения оригинальных значений
const originalToJSON = Konva.Node.prototype.toJSON;
Konva.Node.prototype.toJSON = function() {
    const json = originalToJSON.call(this);

    if (this.originalStrokeWidth !== undefined) {
        json.attrs.strokeWidth = this.originalStrokeWidth;
        json.attrs.hitStrokeWidth = this.originalHitStrokeWidth;
    }

    return json;
};

// Функция для обновления масштабирования stroke и hitStrokeWidth
function updateStrokeScaling() {
    const shapes = layer.find('Shape');
    shapes.forEach(shape => {
        if (shape.isUserTool) return;

        if (shape.originalStrokeWidth === undefined) {
            shape.originalStrokeWidth = shape.strokeWidth() || 0;
            shape.originalHitStrokeWidth = shape.hitStrokeWidth() || shape.originalStrokeWidth * 4;
        }

        shape.strokeWidth(shape.originalStrokeWidth * currentZoom);
        shape.hitStrokeWidth(shape.originalHitStrokeWidth * currentZoom);
    });
    layer.batchDraw();
}

// Функция для создания/обновления трансформера
function updateTransformer(nodes = []) {
    if (transformer) {
        transformer.detach();
        transformer.destroy();
        transformer = null;
    }

    if (nodes.length > 0) {
        transformer = new Konva.Transformer({
            nodes: nodes,
            rotateEnabled: true,
            ignoreStroke: true,
            boundBoxFunc: (oldBox, newBox) => newBox,
            isUserTool: true,
            shouldOverdrawWholeArea: true,
        });
        layer.add(transformer);
        layer.draw();
    }
}

// Функция для обновления draggable состояния всех объектов
function updateObjectsDraggable() {
    const shapes = layer.find('Shape');
    shapes.forEach(shape => {
        if (shape.isUserTool) return;
        shape.draggable(currentMode === 'select');
    });
    layer.batchDraw();
}

// Функция для обновления отображения масштаба
function updateZoomDisplay() {
    const zoomPercentage = Math.round(currentZoom * 100);
    document.getElementById('zoom-input').value = zoomPercentage;
}

// Функция масштабирования к точке
function zoomToPoint(pointer, newScale) {
    const mousePointTo = {
        x: (pointer.x - stage.x()) / currentZoom,
        y: (pointer.y - stage.y()) / currentZoom
    };

    const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale
    };

    stage.position(newPos);
    stage.scale({ x: newScale, y: newScale });
    currentZoom = newScale;
    updateZoomDisplay();
    stage.fire('scaleChange');
}

// Инициализация кастомного зума
function setupZoomControls(stage, layer) {
    const minZoom = 0.1;
    const maxZoom = 4;
    let targetZoom = 1;

    const allowedZoomPercentages = [10, 25, 50, 75, 100, 150, 200, 250, 300, 350, 400];

    function findNextZoom(currentPercentage) {
        for (let i = 0; i < allowedZoomPercentages.length; i++) {
            if (currentPercentage < allowedZoomPercentages[i]) {
                return allowedZoomPercentages[i];
            }
        }
        return allowedZoomPercentages[allowedZoomPercentages.length - 1];
    }

    function findPrevZoom(currentPercentage) {
        for (let i = allowedZoomPercentages.length - 1; i >= 0; i--) {
            if (currentPercentage > allowedZoomPercentages[i]) {
                return allowedZoomPercentages[i];
            }
        }
        return allowedZoomPercentages[0];
    }

    function startSmoothZoom(newTargetZoom, pointer = null) {
        targetZoom = Math.max(minZoom, Math.min(newTargetZoom, maxZoom));
        if (!pointer) {
            pointer = { x: stage.width() / 2, y: stage.height() / 2 };
        }

        if (stage.animatingZoom) return;

        stage.animatingZoom = true;
        animateZoom(pointer);
    }

    function animateZoom(pointer) {
        const zoomStep = (targetZoom - currentZoom) * 0.3;
        const newZoom = currentZoom + zoomStep;

        zoomToPoint(pointer, newZoom);

        if (Math.abs(newZoom - targetZoom) > 0.001) {
            requestAnimationFrame(() => animateZoom(pointer));
        } else {
            zoomToPoint(pointer, targetZoom);
            stage.animatingZoom = false;
        }
    }

    function setZoomFromInput() {
        const inputElement = document.getElementById('zoom-input');
        const zoomPercentage = parseFloat(inputElement.value);

        if (isNaN(zoomPercentage)) {
            updateZoomDisplay();
            return;
        }

        const newZoom = Math.max(minZoom, Math.min(zoomPercentage / 100, maxZoom));
        startSmoothZoom(newZoom);
    }

    stage.on('wheel', function(e) {
        e.evt.preventDefault();

        const now = performance.now();
        const deltaTime = now - lastWheelEventTime;
        lastWheelEventTime = now;

        if (e.evt.ctrlKey || e.evt.metaKey) {
            const pointer = stage.getPointerPosition() || { x: stage.width() / 2, y: stage.height() / 2 };
            const delta = e.evt.deltaY;

            const scrollSpeed = Math.abs(delta) / (deltaTime || 1);
            const zoomSensitivity = baseZoomSensitivity + scrollSpeed * 0.1;

            const newZoom = currentZoom + (delta > 0 ? -zoomSensitivity : zoomSensitivity);
            const constrainedZoom = Math.max(minZoom, Math.min(newZoom, maxZoom));

            zoomToPoint(pointer, constrainedZoom);
        } else {
            stage.position({
                x: stage.x() - e.evt.deltaX,
                y: stage.y() - e.evt.deltaY
            });
            layer.batchDraw();
        }
    });

    document.addEventListener('keydown', function(event) {
        if (event.ctrlKey || event.metaKey) {
            const currentPercentage = Math.round(currentZoom * 100);

            if (event.key === '+' || event.key === '=') {
                event.preventDefault();
                const nextZoomPercentage = findNextZoom(currentPercentage);
                startSmoothZoom(nextZoomPercentage / 100);
            } else if (event.key === '-') {
                event.preventDefault();
                const prevZoomPercentage = findPrevZoom(currentPercentage);
                startSmoothZoom(prevZoomPercentage / 100);
            } else if (event.key === '0') {
                event.preventDefault();
                startSmoothZoom(1);
            }
        }
    });

    document.getElementById('zoom-in').addEventListener('click', function() {
        const currentPercentage = Math.round(currentZoom * 100);
        const nextZoomPercentage = findNextZoom(currentPercentage);
        startSmoothZoom(nextZoomPercentage / 100);
    });

    document.getElementById('zoom-out').addEventListener('click', function() {
        const currentPercentage = Math.round(currentZoom * 100);
        const prevZoomPercentage = findPrevZoom(currentPercentage);
        startSmoothZoom(prevZoomPercentage / 100);
    });

    document.getElementById('zoom-reset').addEventListener('click', function() {
        startSmoothZoom(1);
    });

    document.getElementById('zoom-input').addEventListener('change', setZoomFromInput);

    updateZoomDisplay();
}

// Центрирование холста на точке (0, 0)
function centerStageAtZero() {
    stage.position({
        x: stage.width() / 2,
        y: stage.height() / 2
    });
    stage.scale({ x: 1, y: 1 });
    currentZoom = 1;
    updateZoomDisplay();
}

// Перемещение к точке (0, 0)
function goHome() {
    smoothMoveViewportTo(0, 0, 500);
}

// Плавное перемещение к точке
function smoothMoveViewportTo(targetX, targetY, duration = 1000, targetZoom = 1) {
    const startPos = { x: stage.x(), y: stage.y() };
    const startZoom = currentZoom;
    const startTime = performance.now();

    const targetStageX = stage.width() / 2 - targetX * targetZoom;
    const targetStageY = stage.height() / 2 - targetY * targetZoom;

    function animate() {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = easeInOutCubic(progress);

        stage.position({
            x: startPos.x + (targetStageX - startPos.x) * easeProgress,
            y: startPos.y + (targetStageY - startPos.y) * easeProgress
        });

        const newScale = startZoom + (targetZoom - startZoom) * easeProgress;
        stage.scale({ x: newScale, y: newScale });
        currentZoom = newScale;
        updateZoomDisplay();

        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }

    animate();
}

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Применение настроек режима
function applyModeSettings(mode) {
    const settings = {
        pan: { cursor: 'grab', selection: false },
        select: { cursor: 'default', selection: true },
        draw: { cursor: 'crosshair', selection: false },
        shapes: { cursor: 'crosshair', selection: false }
    }[mode];

    currentMode = mode;

    if (transformer) {
        transformer.detach();
        transformer.destroy();
        transformer = null;
        layer.draw();
    }

    stage.container().style.cursor = settings.cursor;
    updateModeInfo();
    updateObjectsDraggable();

    const drawSettingsPanel = document.getElementById('draw-settings');
    const shapeSettingsPanel = document.getElementById('shape-settings');

    drawSettingsPanel.style.display = 'none';
    shapeSettingsPanel.style.display = 'none';

    if (mode === 'draw') {
        drawSettingsPanel.style.display = 'block';
    } else if (mode === 'shapes') {
        shapeSettingsPanel.style.display = 'block';
    }
}

// Обновление информации о режиме
function updateModeInfo() {
    const modes = {
        pan: 'Текущий режим: Pan',
        select: 'Текущий режим: Select',
        draw: 'Текущий режим: Draw',
        shapes: 'Текущий режим: Shapes'
    };
    document.getElementById('mode-info').textContent = modes[currentMode];
}

// Получение корректных координат с учетом масштаба и смещения
function getCorrectedPointerPosition(e) {
    const pos = e.evt.touches ?
        { x: e.evt.changedTouches[0].clientX, y: e.evt.changedTouches[0].clientY } :
        stage.getPointerPosition() || { x: 0, y: 0 };

    return {
        x: (pos.x - stage.x()) / currentZoom,
        y: (pos.y - stage.y()) / currentZoom
    };
}

// Получение абсолютных координат
function getAbsolutePointerPosition(e) {
    const pos = e.evt.touches ?
        { x: e.evt.changedTouches[0].clientX, y: e.evt.changedTouches[0].clientY } :
        stage.getPointerPosition() || { x: 0, y: 0 };
    return {
        x: pos.x,
        y: pos.y
    };
}

// Расчет центра между двумя точками
function getCenterBetweenTouches(touch1, touch2) {
    return {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2
    };
}

// Обработка событий мыши и касаний
function handleMouseDown(e) {
    const toolbar = document.getElementById('ui_toolbar');
    toolbar.classList.add('inactive');

    if (currentMode === 'draw' || currentMode === 'shapes') {
        document.getElementById('draw-settings').style.display = 'none';
        document.getElementById('shape-settings').style.display = 'none';
    }

    if (e.evt.touches && e.evt.touches.length > 1) {
        if (currentMode === 'pan') {
            const touch1 = e.evt.touches[0];
            const touch2 = e.evt.touches[1];

            initialDistance = Math.hypot(
                touch2.clientX - touch1.clientX,
                touch2.clientY - touch1.clientY
            );
            initialCenter = getCenterBetweenTouches(touch1, touch2);
            initialPosition = { x: stage.x(), y: stage.y() };
            initialScale = currentZoom;
        }
        e.evt.preventDefault();
        return;
    }

    const isMiddleButton = e.evt.button === 1;
    const isRightButton = e.evt.button === 2;
    const isLeftButton = e.evt.button === 0 || e.evt.touches;

    if (isMiddleButton || isRightButton) {
        isPanning = true;
        lastPos = getAbsolutePointerPosition(e);
        stage.container().style.cursor = 'grabbing';
        return;
    }

    if (currentMode === 'draw' && isLeftButton) {
        isDrawing = true;
        const pointerPos = getCorrectedPointerPosition(e);
        currentLine = new Konva.Line({
            id: generateId(),
            stroke: drawSettings.strokeColor,
            strokeWidth: drawSettings.strokeWidth * currentZoom,
            _strokeWidthOriginal: drawSettings.strokeWidth,
            points: [pointerPos.x, pointerPos.y],
            draggable: false,
            globalCompositeOperation: 'source-over',
            strokeScaleEnabled: false,
            hitStrokeWidth: (drawSettings.strokeWidth * 4) * currentZoom,
            _hitStrokeWidthOriginal: drawSettings.strokeWidth * 4,
            lineCap: 'round',
            lineJoin: 'round',
        });
        currentLine.originalStrokeWidth = drawSettings.strokeWidth;
        currentLine.originalHitStrokeWidth = drawSettings.strokeWidth * 4;
        layer.add(currentLine);
        setupChangeTracking(currentLine);
        return;
    }

    if (currentMode === 'shapes' && isLeftButton) {
        isDrawingShape = true;
        const pointerPos = getCorrectedPointerPosition(e);

        switch(shapeType) {
            case 'rect':
                currentShape = new Konva.Rect({
                    id: generateId(),
                    x: pointerPos.x,
                    y: pointerPos.y,
                    width: 0,
                    height: 0,
                    stroke: shapeSettings.strokeColor,
                    strokeWidth: shapeSettings.strokeWidth * currentZoom,
                    _strokeWidthOriginal: shapeSettings.strokeWidth,
                    fill: shapeSettings.fillColor,
                    draggable: false,
                    strokeScaleEnabled: false,
                    hitStrokeWidth: (shapeSettings.strokeWidth * 4) * currentZoom,
                    _hitStrokeWidthOriginal: shapeSettings.strokeWidth * 4,
                });
                break;
            case 'circle':
                currentShape = new Konva.Circle({
                    id: generateId(),
                    x: pointerPos.x,
                    y: pointerPos.y,
                    radius: 0,
                    stroke: shapeSettings.strokeColor,
                    strokeWidth: shapeSettings.strokeWidth * currentZoom,
                    _strokeWidthOriginal: shapeSettings.strokeWidth,
                    fill: shapeSettings.fillColor,
                    draggable: false,
                    strokeScaleEnabled: false,
                    hitStrokeWidth: (shapeSettings.strokeWidth * 4) * currentZoom,
                    _hitStrokeWidthOriginal: shapeSettings.strokeWidth * 4,
                });
                break;
            case 'triangle':
                currentShape = new Konva.RegularPolygon({
                    id: generateId(),
                    x: pointerPos.x,
                    y: pointerPos.y,
                    sides: 3,
                    radius: 0,
                    stroke: shapeSettings.strokeColor,
                    strokeWidth: shapeSettings.strokeWidth * currentZoom,
                    _strokeWidthOriginal: shapeSettings.strokeWidth,
                    fill: shapeSettings.fillColor,
                    draggable: false,
                    strokeScaleEnabled: false,
                    hitStrokeWidth: (shapeSettings.strokeWidth * 4) * currentZoom,
                    _hitStrokeWidthOriginal: shapeSettings.strokeWidth * 4,
                });
                break;
        }

        if (currentShape) {
            currentShape.originalStrokeWidth = shapeSettings.strokeWidth;
            currentShape.originalHitStrokeWidth = shapeSettings.strokeWidth * 4;
            layer.add(currentShape);
            setupChangeTracking(currentShape);
        }
        return;
    }

    if (currentMode === 'pan' && isLeftButton) {
        isPanning = true;
        lastPos = getAbsolutePointerPosition(e);
        stage.container().style.cursor = 'grabbing';
        return;
    }

    if (currentMode === 'select' && e.target === stage && isLeftButton) {
        updateTransformer();

        const pos = getAbsolutePointerPosition(e);
        if (!pos) return;

        x1 = pos.x;
        y1 = pos.y;
        x2 = pos.x;
        y2 = pos.y;

        selectionRectangle.setAttrs({
            x: (x1 - stage.x()) / currentZoom,
            y: (y1 - stage.y()) / currentZoom,
            width: 0,
            height: 0,
            visible: true,
        });
        layer.draw();
    }
}

function handleMouseMove(e) {
    if (e.evt.touches && e.evt.touches.length > 1 && currentMode !== 'pan') {
        e.evt.preventDefault();
        return;
    }

    if (e.evt.touches && e.evt.touches.length > 1 && currentMode === 'pan') {
        e.evt.preventDefault();

        const touch1 = e.evt.touches[0];
        const touch2 = e.evt.touches[1];
        const currentDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );

        if (initialDistance !== null && initialCenter !== null) {
            const scale = (currentDistance / initialDistance) * initialScale;
            const newScale = Math.max(0.1, Math.min(scale, 4));

            const currentCenter = getCenterBetweenTouches(touch1, touch2);
            const centerDeltaX = currentCenter.x - initialCenter.x;
            const centerDeltaY = currentCenter.y - initialCenter.y;

            const newPos = {
                x: initialPosition.x + centerDeltaX,
                y: initialPosition.y + centerDeltaY
            };

            const mousePointTo = {
                x: (currentCenter.x - newPos.x) / initialScale,
                y: (currentCenter.y - newPos.y) / initialScale
            };

            const finalPos = {
                x: currentCenter.x - mousePointTo.x * newScale,
                y: currentCenter.y - mousePointTo.y * newScale
            };

            stage.position(finalPos);
            stage.scale({ x: newScale, y: newScale });
            currentZoom = newScale;
            updateZoomDisplay();
        }
        return;
    }

    if (isDrawing && currentLine) {
        const pointerPos = getCorrectedPointerPosition(e);
        const newPoints = currentLine.points().concat([pointerPos.x, pointerPos.y]);
        currentLine.points(newPoints);
        layer.batchDraw();
        return;
    }

    if (isDrawingShape && currentShape) {
        const pointerPos = getCorrectedPointerPosition(e);
        const startX = currentShape.x();
        const startY = currentShape.y();

        switch(shapeType) {
            case 'rect':
                currentShape.width(pointerPos.x - startX);
                currentShape.height(pointerPos.y - startY);
                break;
            case 'circle':
                const radius = Math.sqrt(
                    Math.pow(pointerPos.x - startX, 2) +
                    Math.pow(pointerPos.y - startY, 2)
                );
                currentShape.radius(radius);
                break;
            case 'triangle':
                const triRadius = Math.sqrt(
                    Math.pow(pointerPos.x - startX, 2) +
                    Math.pow(pointerPos.y - startY, 2)
                );
                currentShape.radius(triRadius);
                break;
        }
        layer.batchDraw();
        return;
    }

    if (isPanning && lastPos) {
        e.evt.preventDefault();
        const currentPos = getAbsolutePointerPosition(e);
        if (!currentPos) return;

        const dx = currentPos.x - lastPos.x;
        const dy = currentPos.y - lastPos.y;

        stage.position({
            x: stage.x() + dx,
            y: stage.y() + dy
        });

        lastPos = currentPos;
        layer.batchDraw();
        return;
    }

    if (currentMode === 'select' && selectionRectangle.visible()) {
        const pos = getAbsolutePointerPosition(e);
        if (!pos) return;

        x2 = pos.x;
        y2 = pos.y;

        const rectX = Math.min(x1, x2);
        const rectY = Math.min(y1, y2);
        const rectWidth = Math.abs(x2 - x1);
        const rectHeight = Math.abs(y2 - y1);

        const correctedX = (rectX - stage.x()) / currentZoom;
        const correctedY = (rectY - stage.y()) / currentZoom;
        const correctedWidth = rectWidth / currentZoom;
        const correctedHeight = rectHeight / currentZoom;

        selectionRectangle.setAttrs({
            x: correctedX,
            y: correctedY,
            width: correctedWidth,
            height: correctedHeight,
        });
        layer.batchDraw();
    }
}

function handleMouseUp() {
    const toolbar = document.getElementById('ui_toolbar');
    toolbar.classList.remove('inactive');

    initialDistance = null;
    initialCenter = null;
    initialPosition = null;
    initialScale = currentZoom;

    if (isDrawing) {
        isDrawing = false;
        if (currentMode === 'draw') {
            document.getElementById('draw-settings').style.display = 'block';
        }
        currentLine = null;
        return;
    }

    if (isDrawingShape) {
        isDrawingShape = false;
        if (currentMode === 'shapes') {
            document.getElementById('shape-settings').style.display = 'block';
        }

        if (currentShape) {
            const minSize = 5;
            let shouldRemove = false;

            if (shapeType === 'rect' &&
                (Math.abs(currentShape.width()) < minSize ||
                 Math.abs(currentShape.height()) < minSize)) {
                shouldRemove = true;
            } else if ((shapeType === 'circle' || shapeType === 'triangle') &&
                       currentShape.radius() < minSize) {
                shouldRemove = true;
            }

            if (shouldRemove) {
                logChange('D', currentShape);
                currentShape.destroy();
                currentShape = null;
                layer.batchDraw();
                return;
            }

            currentShape = null;
        }
        return;
    }

    if (isPanning) {
        isPanning = false;
        if (currentMode === 'pan') {
            stage.container().style.cursor = 'grab';
        } else {
            stage.container().style.cursor = 'default';
        }
        return;
    }

    if (currentMode === 'select' && selectionRectangle.visible()) {
        setTimeout(() => {
            selectionRectangle.visible(false);
            layer.draw();
        });

        const rectX = Math.min(x1, x2);
        const rectY = Math.min(y1, y2);
        const rectWidth = Math.abs(x2 - x1);
        const rectHeight = Math.abs(y2 - y1);

        const selectionBox = new Konva.Rect({
            x: rectX,
            y: rectY,
            width: rectWidth,
            height: rectHeight
        });

        const selectionClientRect = selectionBox.getClientRect();
        const shapes = layer.find('Shape');

        const selected = shapes.filter((shape) => {
            if (shape === selectionRectangle) return false;
            const shapeClientRect = shape.getClientRect();

            if (!Konva.Util.haveIntersection(selectionClientRect, shapeClientRect)) {
                return false;
            }

            if (shape.getClassName() !== 'Line') {
                return true;
            }

            return isLineIntersectingSelection(shape, selectionClientRect);
        });

        function isLineIntersectingSelection(line, selectionRect) {
            const points = line.points();
            const transform = line.getAbsoluteTransform();

            for (let i = 0; i < points.length - 2; i += 2) {
                const start = transform.point({
                    x: points[i],
                    y: points[i + 1]
                });
                const end = transform.point({
                    x: points[i + 2],
                    y: points[i + 3]
                });

                if (isPointInRect(start, selectionRect) || isPointInRect(end, selectionRect)) {
                    return true;
                }

                if (checkLineSegmentIntersection(start, end, selectionRect)) {
                    return true;
                }
            }

            return false;
        }

        function isPointInRect(point, rect) {
            return point.x >= rect.x &&
                   point.x <= rect.x + rect.width &&
                   point.y >= rect.y &&
                   point.y <= rect.y + rect.height;
        }

        function checkLineSegmentIntersection(start, end, rect) {
            const rectLines = [
                { start: { x: rect.x, y: rect.y }, end: { x: rect.x + rect.width, y: rect.y } },
                { start: { x: rect.x + rect.width, y: rect.y }, end: { x: rect.x + rect.width, y: rect.y + rect.height } },
                { start: { x: rect.x, y: rect.y + rect.height }, end: { x: rect.x + rect.width, y: rect.y + rect.height } },
                { start: { x: rect.x, y: rect.y }, end: { x: rect.x, y: rect.y + rect.height } }
            ];

            for (const border of rectLines) {
                if (doLinesIntersect(start, end, border.start, border.end)) {
                    return true;
                }
            }

            return false;
        }

        function doLinesIntersect(a1, a2, b1, b2) {
            const ccw = (A, B, C) => (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
            return ccw(a1, b1, b2) !== ccw(a2, b1, b2) && ccw(a1, a2, b1) !== ccw(a1, a2, b2);
        }

        updateTransformer(selected);
    }
}

function handleObjectSelect(e) {
    if (currentMode !== 'select') return;

    if (e.evt.button !== undefined && e.evt.button !== 0 && !e.evt.touches) return;

    if (selectionRectangle.visible() &&
        (selectionRectangle.width() > 0 || selectionRectangle.height() > 0)) {
        return;
    }

    if (e.target === stage) {
        updateTransformer();
        return;
    }

    const metaPressed = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey;
    const isSelected = transformer && transformer.nodes().indexOf(e.target) >= 0;

    if (!metaPressed && !isSelected) {
        updateTransformer([e.target]);
    } else if (metaPressed && isSelected) {
        const nodes = transformer.nodes().slice();
        nodes.splice(nodes.indexOf(e.target), 1);
        updateTransformer(nodes);
    } else if (metaPressed && !isSelected) {
        const nodes = transformer ? transformer.nodes().concat([e.target]) : [e.target];
        updateTransformer(nodes);
    }
}

function togglePanSelect() {
    const newMode = currentMode === 'select' ? 'pan' : 'select';
    applyModeSettings(newMode);
    document.getElementById('panselect-toggle').textContent = newMode === 'pan' ? 'Pan' : 'Select';
}

function deleteSelectedObjects() {
    if (transformer && transformer.nodes().length > 0) {
        transformer.nodes().forEach(node => {
            logChange('D', node);
            node.destroy();
        });
        updateTransformer();
    }
}

function exportToJSON() {
    const data = stage.toJSON();
    console.log(JSON.stringify(data, null, 2));
}

function handleResize() {
    stage.width(window.innerWidth);
    stage.height(window.innerHeight);
    layer.batchDraw();
}

function init() {
    centerStageAtZero();
    setupZoomControls(stage, layer);

    selectionRectangle = new Konva.Rect({
        fill: 'rgba(0, 0, 255, 0.3)',
        stroke: null,
        visible: false,
        isUserTool: true,
    });
    layer.add(selectionRectangle);

    stage.on('scaleChange', updateStrokeScaling);

    stage.on('mousedown', handleMouseDown);
    stage.on('touchstart', function(e) {
        e.evt.preventDefault();
        handleMouseDown(e);
    });

    stage.on('mousemove', handleMouseMove);
    stage.on('touchmove', function(e) {
        e.evt.preventDefault();
        handleMouseMove(e);
    });

    stage.on('mouseup', handleMouseUp);
    stage.on('touchend', function(e) {
        e.evt.preventDefault();
        handleMouseUp();
    });

    stage.on('click tap', function(e) {
        const target = e.target;
        const isTransformerPart = target.getParent() === transformer;
        if (isTransformerPart) return;
        if (target === stage) {
            updateTransformer();
        } else if (currentMode === 'select') {
            handleObjectSelect(e);
        }
    });

    stage.on('contextmenu', (e) => {
        e.evt.preventDefault();
    });

    const lineWidthInput = document.getElementById('line-width');
    const widthValue = document.getElementById('width-value');

    lineWidthInput.addEventListener('input', function() {
        const value = this.value;
        widthValue.textContent = value;
        drawSettings.strokeWidth = parseInt(value);
        updateLinePreview();
    });

    setupColorPicker();
    updateLinePreview();

    document.getElementById('shape-rect').addEventListener('click', () => shapeType = 'rect');
    document.getElementById('shape-circle').addEventListener('click', () => shapeType = 'circle');
    document.getElementById('shape-triangle').addEventListener('click', () => shapeType = 'triangle');

    document.getElementById('panselect-toggle').addEventListener('click', togglePanSelect);
    document.getElementById('toggle-draw').addEventListener('click', () => applyModeSettings('draw'));
    document.getElementById('toggle-shapes').addEventListener('click', () => applyModeSettings('shapes'));
    document.getElementById('go-home').addEventListener('click', goHome);

    window.addEventListener('resize', handleResize);

    applyModeSettings('select');
    updateStrokeScaling();
}

window.addEventListener('DOMContentLoaded', init);