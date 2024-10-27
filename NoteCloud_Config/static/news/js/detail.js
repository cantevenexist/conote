$(document).ready(function() {
    $('#commentForm').on('submit', function(event) {
        event.preventDefault();  // Отменяем стандартное поведение формы

        $.ajax({
            type: 'POST',
            url: $(this).attr('action'),  // URL, на который будет отправлен запрос
            data: $(this).serialize(),  // Сериализуем данные формы
            success: function(response) {
                if (response.success) {
                    // Очищаем форму
                    $('#commentForm')[0].reset();

                    // Обновляем список комментариев
                    const commentsList = $('#commentsList');
                    commentsList.empty();  // Очищаем текущий список
                    response.comments.forEach(function(comment) {
                        commentsList.append('<li id="comment-' + comment.id + '">' + comment.content + ' - ' + comment.author + ' - ' + comment.created_at + ' <button class="deleteComment" data-id="' + comment.id + '">Удалить</button></li>');
                    });
                }
            },
            error: function(xhr) {
                // Обработка ошибок
                console.error(xhr.responseText);
            }
        });
    });

    // Обработчик для кнопок удаления комментариев
    $(document).on('click', '.deleteComment', function() {
        const commentId = $(this).data('id');

        $.ajax({
            type: 'POST',
            url: '{{ request.path }}',  // Используйте текущий URL
            data: {
                'comment_id': commentId,
                'csrfmiddlewaretoken': '{{ csrf_token }}'  // Не забудьте передать CSRF-токен
            },
            success: function(response) {
                if (response.success) {
                    // Удаляем комментарий из списка
                    $('#comment-' + commentId).remove();
                } else {
                    console.error(response.error);
                }
            },
            error: function(xhr) {
                // Обработка ошибок
                console.error(xhr.responseText);
            }
        });
    });
});


