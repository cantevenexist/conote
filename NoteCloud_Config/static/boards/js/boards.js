document.addEventListener('DOMContentLoaded', function() {
    function getCookie(name) {
        const value = $.cookie(name);
        return value ? decodeURIComponent(value) : null;
    }

    const csrftoken = getCookie('csrftoken');

    document.querySelector('.board_creation_block').addEventListener('click', function() {
        fetch(window.location.href, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken
            },
            body: JSON.stringify({action: 'create_board'})
        })
        .then(response => response.json())
        .then(data => {
            if (data.html) {
                // Вставляем полученный HTML
                let tempDiv = document.createElement('div');
                tempDiv.innerHTML = data.html;
                let newBoard = tempDiv.firstElementChild;
                // Добавляем новый элемент в основной контейнер
                document.querySelector('.main_block').appendChild(newBoard);
                // Выполняем сортировку досок
                sortBoards();
            }
        })
        .catch(error => console.error('Error:', error));
    });
});

// Функция сортировки досок
function sortBoards() {
    let mainBlock = document.querySelector('.main_block');
    // Выбираем все элементы досок, кроме блока создания
    let boardItems = Array.from(document.querySelectorAll('.board_item'));
    boardItems.sort(function(a, b) {
        let aFav = a.getAttribute('data-favorites') === 'True' || a.getAttribute('data-favorites') === 'true';
        let bFav = b.getAttribute('data-favorites') === 'True' || b.getAttribute('data-favorites') === 'true';
        let aDate = new Date(a.getAttribute('data-updated'));
        let bDate = new Date(b.getAttribute('data-updated'));
        // Сначала сортируем по признаку избранности
        if (aFav !== bFav) {
            return aFav ? -1 : 1;
        }
        // Если одинаковы — сортировка по дате (от новых к старым)
        return bDate - aDate;
    });
    // Удаляем и заново вставляем отсортированные элементы в контейнер
    // При этом оставляем блок создания на месте
    let boardCreationBlock = document.querySelector('.board_creation_block');
    boardItems.forEach(item => {
        mainBlock.appendChild(item);
    });
}


document.addEventListener('DOMContentLoaded', () => {
    const mainBlock = document.querySelector('.main_block');

    mainBlock.addEventListener('click', (e) => {
    const btn = e.target.closest('.popup-btn');
        if (btn) {
          const boardItem = btn.closest('.board_item');
          const popup = boardItem.querySelector('.popup');

          // Закрываем все остальные попапы
          document.querySelectorAll('.popup').forEach(p => {
            if (p !== popup) p.classList.remove('show');
          });

          popup.classList.toggle('show');
        }
    });

    // Закрытие попапов при клике вне блока
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.board_item')) {
          document.querySelectorAll('.popup').forEach(popup => popup.classList.remove('show'));
        }
    });
});
