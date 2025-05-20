const csrftoken = getCookie("csrftoken");

// Построение HTML уведомления
function buildNotificationHTML(n) {
    return `
        <div class=\"notification ${n.is_read ? 'read' : 'unread'}\" data-id=\"${n.id}\">
        <strong>${n.level.toUpperCase()}</strong>: ${n.message}
        <small>${n.created_at}</small>
        </div>
    `;
}

// Обновление счётчика непрочитанных
async function updateUnreadCount() {
    const resp = await fetch('/notifications/api/count/');
    const { count } = await resp.json();
    const badge = document.getElementById('unread_count_badge');
    badge.textContent = count;
    badge.classList.toggle('large', count >= 100);
}

// Универсальная загрузка уведомлений
async function loadNotifications({ offset = 0, limit = 10, panel = smallPanel, useFilters = false, append = false } = {}) {
    let url = `/notifications/api/?offset=${offset}&limit=${limit}`;
    if (useFilters) {
        const r = filters.isRead ? filters.isRead.value : "";
        const l = filters.level ? filters.level.value : "";
        if (r) url += `&is_read=${r}`;
        if (l) url += `&level=${l}`;
    }
    const resp = await fetch(url);
    const data = await resp.json();
    const target = (panel === fullPanel) ? notifContainer : panel;

    if (!append) {
        if (panel === smallPanel) {
            target.innerHTML = '<button id=\"load_all\">Посмотреть все</button>';
        } else {
            notifContainer.innerHTML = '';
            loadMoreBtn.style.display = 'block';
        }
    }

    data.forEach(n => target.insertAdjacentHTML('beforeend', buildNotificationHTML(n)));

    // Ставим обработчики на уведомления
    target.querySelectorAll('.notification').forEach(el => {
        // mark-as-read по клику
        if (el.classList.contains('unread')) {
            el.addEventListener('click', () => markAsRead(el.dataset.id, el));
        }
    });

    // Повесить «открыть полную»
    if (panel === smallPanel) {
        document.getElementById('load_all').addEventListener('click', openFullPanel);
    }

    // Скрыть кнопку "Загрузить ещё", если меньше лимита
    if (panel === fullPanel) {
        if (data.length < limit) loadMoreBtn.style.display = 'none';
    }

    // Обновляем счётчик
    updateUnreadCount();
}

// WebSocket-пуши
const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
const socket = new WebSocket(`${proto}://${window.location.host}/ws/notifications/`);
socket.onmessage = e => {
    const n = JSON.parse(e.data);
    const html = buildNotificationHTML(n);
    const loadBtn = document.getElementById('load_all');
    if (loadBtn) {
        loadBtn.insertAdjacentHTML('afterend', html);
        const items = smallPanel.querySelectorAll('.notification');
        if (items.length > 5) {
            // удаляем самые старые внизу
            for (let i = 0; i < items.length - 5; i++) {
                items[items.length - 1 - i].remove();
            }
        }
    }
    if (isFullOpen) notifContainer.insertAdjacentHTML('afterbegin', html);
    updateUnreadCount();
};
socket.onclose = () => console.error('WS closed');

// POST mark-as-read
async function markAsRead(id, el) {
    const resp = await fetch(`/notifications/api/${id}/mark_read/`, {
        method: 'POST',
        headers: { 'X-CSRFToken': csrftoken }
    });
    if (resp.ok) {
        // помечаем в текущем элементе
        el.classList.replace('unread', 'read');
        // синхронно обновляем в маленькой панели, если элемент там есть
        const smallEl = document.querySelector(`#user_notifications_panel .notification[data-id=\"${id}\"]`);
        if (smallEl) smallEl.classList.replace('unread', 'read');
        // если фильтр по непрочитанным, удаляем из списка
        if (filters.isRead && filters.isRead.value === 'false') {
            el.remove();
        }
        updateUnreadCount();
    }
}


document.addEventListener('click', async e => {
    // «Принять»
    let btn = e.target.closest('.notif-accept');
    if (btn) {
        const url = btn.dataset.url;
        try {
            // просто переходим по ссылке — сервер вернёт редирект на доску
            window.location.href = url;
        } catch {
            alert('Не удалось принять приглашение');
        }
        removeButtons(btn);
        return;
    }

    // «Отменить»
    btn = e.target.closest('.notif-decline');
    if (btn) {
        const url = btn.dataset.url;
        try {
            const resp = await fetch(url, {
                method: 'POST',
                headers: { 'X-CSRFToken': getCookie('csrftoken') }
            });
            if (!resp.ok) throw '';
        } catch {
            alert('Не удалось отменить приглашение');
        }
        removeButtons(btn);
    }
});

// удаляем обе кнопки из нотификации
function removeButtons(buttonClicked) {
    const container = buttonClicked.closest('.notification');
    if (!container) return;
    container.querySelectorAll('button.notif-accept, button.notif-decline')
        .forEach(b => b.remove());
}