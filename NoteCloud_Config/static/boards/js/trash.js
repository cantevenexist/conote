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
        const urlHash = deleteBtn.getAttribute('data-url_hash');

        if (confirm('Вы уверены, что хотите удалить эту доску?')) {
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
    }
});

document.getElementById("delete-all-btn").addEventListener("click", function(){
    if (!confirm('Вы уверены, что хотите удалить все ваши доски?')) {
      return;
    }
    const csrftoken = getCookie('csrftoken');
    const currentUsername = window.currentUsername;
    fetch(`/workspace/trash/delete_all/`, {
      method: "DELETE",
      headers: {
        "X-CSRFToken": csrftoken
      }
    })
    .then(response => response.json())
    .then(data => {
      if(data.status === "success"){
        // Удаляем со страницы все доски пользователя
        document.querySelectorAll('.board_item').forEach(function(item) {
            item.remove();
        });
      }
    })
    .catch(error => console.error('Ошибка:', error));
});


document.querySelector('.main_block').addEventListener('click', (e) => {
    const restoreBtn = e.target.closest('.restore-btn');
    if (restoreBtn) {
        const csrftoken = getCookie('csrftoken');
        const boardElement = restoreBtn.closest('.board_item');
        const urlHash = restoreBtn.getAttribute('data-url_hash');

        fetch(`/workspace/trash/${urlHash}/restore/`, {
            method: 'POST',
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

document.getElementById("restore-all-btn").addEventListener("click", function(){
    const csrftoken = getCookie('csrftoken');
    const currentUsername = window.currentUsername;
    fetch(`/workspace/trash/restore_all/`, {
      method: "POST",
      headers: {
        "X-CSRFToken": csrftoken
      }
    })
    .then(response => response.json())
    .then(data => {
      if(data.status === "success"){
        // Удаляем со страницы все доски пользователя
        document.querySelectorAll('.board_item').forEach(function(item) {
            item.remove();
        });
      }
    })
    .catch(error => console.error('Ошибка:', error));
});
