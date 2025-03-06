function getCookie(name) {
    const value = $.cookie(name);
    return value ? decodeURIComponent(value) : null;
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


document.querySelector('.main_block').addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) {
        const csrftoken = getCookie('csrftoken');
        const boardElement = deleteBtn.closest('.board_item');
        const urlHash = boardElement.querySelector('a').getAttribute('href').split('/')[2];

        fetch(`/workspace/trash/${urlHash}/delete/`, {
            method: 'DELETE',
            headers: {
                'X-CSRFToken': csrftoken
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                boardElement.remove();
            } else {
                alert('Ошибка при удалении доски');
            }
        });
    }
});
