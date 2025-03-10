// Функция для подсчета комментариев
function searchAndCountPostComments() {
    // Находим все элементы с классом 'comment_area_container' внутри #commentsList
    const commentContainers = document.querySelectorAll('#commentsList .comment_area_container');    
    // Получаем количество найденных комментариев
    const commentCount = commentContainers.length;
    // Управление отображением случайного сообщения
    const randomMessageNoComments=document.getElementById('randomMessageNoComments');    
    // Если нужно отобразить счетчик на странице, например, в элементе с id="commentCounter"
    const newsCommentCount = document.getElementById('newsCommentCount');
    if (newsCommentCount) {newsCommentCount.innerHTML = `${commentCount}`;if (commentCount>0) {randomMessageNoComments.style.display="none"}else{randomMessageNoComments.style.display="block"}}
    return commentCount; // Возвращаем значение для дальнейшего использования
}

// Вызываем функцию при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    searchAndCountPostComments();
});


// Img
var news_image_panel= document.getElementById("news_image_panel");
var closeBtn_news_image_panel= document.getElementById("closeBtn_news_image_panel");
function toggleDiv_news_image_panel() {
    if (news_image_panel.classList.contains("show")) {
        news_image_panel.classList.remove("show");
    } else {
        news_image_panel.classList.add("show");
    }
}

function hidePanelNewsImagePanel() {news_image_panel.classList.remove("show");}
if (news_image_panel && closeBtn_news_image_panel) {closeBtn_news_image_panel.addEventListener("click", hidePanelNewsImagePanel);}

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {hidePanelNewsImagePanel();}});


// Comments
(function (){
    function getCookie(name) {
        const value = $.cookie(name);
        return value ? decodeURIComponent(value) : null;
    }

    const appData = document.getElementById('page-data');
    const user = appData.dataset.user; // Получаем пользователя
    const requestPath = appData.dataset.requestPath; // Получаем текущий путь
    const csrftoken = getCookie('csrftoken');
    
    const commentInput = document.querySelector('.form_comment textarea');
    const sendCommentButton = document.getElementById('sendCommentButton');
    const commentInputArea = document.getElementById('commentInputArea');

    // Проверяем, существуют ли необходимые элементы
    if (!commentInput || !sendCommentButton || !commentInputArea) {
        return; // Если элементы не найдены, прекращаем выполнение функции
    }
    
    // Флаг, чтобы не запускать анимацию при первой загрузке
    let firstCheckComment = true;

    // Функция для проверки состояния поля ввода
    function checkInputComment() {
        const isEmpty = commentInput.value === ''; // Проверка на пустое поле

        // Пропускаем логику на первой загрузке
        if (firstCheckComment) {
            firstCheckComment = false;
            // Проводим проверку на пустое поле и сразу меняем классы, но без анимации
            return checkInputComment();
        }
        toggleClasses(isEmpty);
    }

    // Функция для переключения классов
    function toggleClasses(isEmpty) {
        // Меняем класс для кнопки отправки
        sendCommentButton.classList.toggle('show', !isEmpty);
        sendCommentButton.classList.toggle('hide', isEmpty);
        sendCommentButton.classList.toggle('restore', isEmpty);

        // Перемещаем форму ввода в зависимости от состояния
        commentInputArea.classList.toggle('form_comment_shifted', !isEmpty);
        commentInputArea.classList.toggle('form_comment_shifted_restore', isEmpty);
    }

    // Добавляем обработчик события на изменение текста в поле ввода
    commentInput.addEventListener('input', checkInputComment);

// Удаление комментариев
$(document).ready(function() {
    // Отправка комментария по нажатию Enter
    const commentInputArea = $('#commentInputArea'); // Ваш div для ввода текста

    commentInputArea.on('keydown', function(event) {
        if (!isMobile() && event.key === 'Enter' && !event.shiftKey) {  // Если нажали Enter без Shift
            event.preventDefault();  // Отменяем стандартное поведение (перенос строки)
            $('#commentForm').submit();  // Отправляем форму
        }
    });

    // Обработчик для отправки формы
    $('#commentForm').on('submit', function(event) {
        event.preventDefault();  // Отменяем стандартное поведение формы

        const commentValue = commentInput.value.trim();
        if (!commentValue) {
            alert('Пожалуйста, введите текст комментария.');
            return;
        }

        $.ajax({
            type: 'POST',
            url: $(this).attr('action'),  // URL, на который будет отправлен запрос
            data: $(this).serialize(),  // Сериализуем данные формы
            success: function(response) {
                if (response.success) {
                    // Очищаем форму
                    $('#commentForm')[0].reset();
                    checkInputComment();  // Проверяем, пустое ли поле
                    
                    commentInput.style.height = ''; // Восстанавливаем высоту поля
                    
                    // Обновляем список комментариев
                    const commentsList = $('#commentsList');
                    commentsList.empty();  // Очищаем текущий список
                    
                    // XSS escape HTML
                    function escapeHtml(unsafe) {
                        return String(unsafe)
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#039;');
                    }

                    function formatDate(date) {
                        const pad = (n) => (n < 10 ? '0' + n : n);
                        return date.getFullYear() + '-' +
                            pad(date.getMonth() + 1) + '-' +
                            pad(date.getDate()) + 'T' +
                            pad(date.getHours()) + ':' +
                            pad(date.getMinutes()) + ':' +
                            pad(date.getSeconds());
                    }

                    response.comments.forEach(function(comment) {
                        // Экранирование контента
                        var escapedContent = escapeHtml(comment.content);
                        var commentHtml = '<div id="comment-' + comment.id + '" class="comment_area_container"><div class="author_container"><p class="selectable"><a href="/profile/'+ comment.author +'/"> <strong>' + comment.author + '</strong></a></p>' + '<div class="comment_action_buttons_container"></button><button class="comment_action_button author_report_button"><svg class="icon" width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="Warning / Octagon_Warning"><path id="Vector" d="M12 8.44971V12.4497M7.33173 3.9375L3.9375 7.33173L3.93442 7.33462C3.59057 7.67847 3.41824 7.85081 3.29492 8.05204C3.18526 8.23098 3.10425 8.4263 3.05526 8.63037C3 8.86055 3 9.10506 3 9.59424V14.4058C3 14.8949 3 15.1395 3.05526 15.3697C3.10425 15.5738 3.18526 15.7688 3.29492 15.9478C3.41857 16.1495 3.59182 16.3228 3.9375 16.6685L7.33173 20.0627C7.67763 20.4086 7.85021 20.5812 8.05204 20.7048C8.23099 20.8145 8.42581 20.8958 8.62988 20.9448C8.85971 21 9.10382 21 9.59151 21H14.4075C14.8952 21 15.1404 21 15.3702 20.9448C15.5743 20.8958 15.7693 20.8145 15.9482 20.7049C16.1501 20.5812 16.323 20.4086 16.6689 20.0627L20.0632 16.6685C20.4091 16.3226 20.5817 16.1496 20.7053 15.9478C20.815 15.7688 20.8953 15.5738 20.9443 15.3697C20.9996 15.1395 21 14.895 21 14.4058V9.59424C21 9.10506 20.9996 8.86055 20.9443 8.63037C20.8953 8.4263 20.815 8.23099 20.7053 8.05205C20.5817 7.85022 20.4091 7.67761 20.0632 7.33173L16.6689 3.9375C16.3233 3.59181 16.15 3.41857 15.9482 3.29492C15.7693 3.18526 15.5743 3.10425 15.3702 3.05526C15.14 3 14.8945 3 14.4053 3H9.59375C9.10457 3 8.86006 3 8.62988 3.05526C8.42581 3.10425 8.23099 3.18526 8.05204 3.29492C7.85204 3.41748 7.68106 3.58847 7.3414 3.92813L7.33173 3.9375ZM12.0498 15.4497V15.5497L11.9502 15.5499V15.4497H12.0498Z" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></g></svg></button>';
                        // Форматирование времени
                        var validDate = new Date(comment.created_at.split(/[\s,]+/).map((part, i) => {
                            return i === 0 
                                ? part.split('.').reverse().join('-') 
                                : part.split(':').slice(0, 2).join(':') + ':00';
                        }).join('T'));
                        // Проверка, если текущий пользователь - это автор комментария
                        if (user === comment.author) {commentHtml += ' <button class="comment_action_button comment_delete_button" data-id="' + comment.id + '"><svg class="icon" width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="Menu / Close_SM"><path id="Vector" d="M16 16L12 12M12 12L8 8M12 12L16 8M12 12L8 16" stroke-width="2" stroke-linecap="round"stroke-linejoin="round"/></g></svg></button>';}
                        commentHtml += '</div></div><p class="content selectable text_could_be_url">' + escapedContent + '</p><p class="date time" data-time="' + validDate + '"></p><div class="comment_separator"></div></div>';
                        commentsList.append(commentHtml);
                        });
                        
                        // После добавления комментариев вызываем функцию для локализации времени
                        localizeTime();  // Локализация времени для новых комментариев
                        highlightUrlsInText(); // Поиск URL
                        searchAndCountPostComments(); // Счетчик комментариев
                    }
            },
            error: function(xhr) {
                // Обработка ошибок
                console.error(xhr.responseText);
            }
        });
    });

    // Обработчик для кнопок удаления комментариев
    $(document).on('click', '.comment_delete_button', function() {
    const commentId = $(this).data('id');

    // Проверяем, что ID комментария существует
    if (!commentId) {
        alert('ID комментария не найден.');
        return;
    }

    $.ajax({
        type: 'POST',
        url: requestPath, // Используйте текущий URL
        data: {
            'comment_id': commentId,
            'csrfmiddlewaretoken': csrftoken // Передаём CSRF-токен
        },
        success: function(response) {
            if (response.success) {
                // Удаляем комментарий из списка
                $('#comment-' + commentId).remove();
                searchAndCountPostComments(); // Счетчик комментариев
            } else {
                alert('Ошибка при удалении комментария: ' + response.error);
                console.error('Server Response:', response);
            }
        },
        error: function(xhr) {
            try {
                // Попытка разобрать JSON-ответ
                const errorResponse = JSON.parse(xhr.responseText);
                if (errorResponse.error) {
                    alert('Ошибка сервера: ' + errorResponse.error);
                } else {
                    alert('Произошла ошибка при удалении комментария.');
                }
            } catch (e) {
                // Если ответ не в формате JSON
                alert('Не удалось получить ответ от сервера.');
            }

            // Логирование подробностей ошибки
            console.error('AJAX Error:', xhr.status, xhr.statusText, xhr.responseText);
        }
    });
});
});
}());