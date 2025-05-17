function getCookie(name) {
    const value = $.cookie(name);
    return value ? decodeURIComponent(value) : null;
}


function getBoardHashFromUrl() {
    // Разбиваем путь на сегменты, убираем пустые
    const parts = window.location.pathname.split('/').filter(Boolean);
    // Последний сегмент — это url_hash
    return parts[parts.length - 1];
}


document.addEventListener('DOMContentLoaded', () => {
    const BOARD_URL_HASH = getBoardHashFromUrl();
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
            const resp = await fetch(`/workspace/api/invite/${BOARD_URL_HASH}/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
                 body: JSON.stringify(payload),
            });
            const data = await resp.json();
            if (data.status === 'error') {
                // Сервер вернул оставшееся время
                const retry = data.retry_after;
                btn.classList.add('cooldown');
                setTimeout(() => btn.classList.remove('cooldown'), retry * 1000);
                alert(data.message);
            } else {
                // Успех — запускаем таймер на продолжительность cooldown
                btn.classList.add('cooldown');
                setTimeout(() => btn.classList.remove('cooldown'), data.cooldown * 1000);
            }
        } catch (err) {
            console.error(err);
            alert('Не удалось отправить приглашение');
        } finally {
            btn.disabled = false;
        }
    });
});