const textarea = document.getElementById('id_about_me');

textarea.addEventListener('focus', () => {
    if (textarea.value === '') {
        textarea.value = '';
    }
});

textarea.addEventListener('blur', () => {
    if (textarea.value === '') {
        textarea.value = '';
    }
});

let croppedBlob = null;
let originalFileName = '';
let cropper = null;

document.getElementById('id_avatar').addEventListener('change', function(event) {
    const files = event.target.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.size > 2 * 1024 * 1024) {
            alert('Размер изображения не должен превышать 2МБ');
            event.target.value = '';
            return;
        }

        const allowedExtensions = ['bmp', 'jpeg', 'png', 'jpg'];
        const fileExtension = file.name.split('.').pop().toLowerCase();
        if (!allowedExtensions.includes(fileExtension)) {
            alert('Недопустимый формат изображения. Допустимые расширения: bmp, jpeg, png, jpg.');
            event.target.value = '';
            return;
        }

        originalFileName = files[0].name;
        const reader = new FileReader();
        reader.onload = function(e) {
            const imageContainer = document.getElementById('image-container');
            imageContainer.innerHTML = '';

            const image = document.createElement('img');
            image.id = 'image-to-crop';
            image.src = e.target.result;
            image.style.width = '256px';
            image.style.height = '256px';
            imageContainer.appendChild(image);

            if (cropper) {
                cropper.destroy();
            }

            cropper = new Cropper(image, {
                aspectRatio: 1,
                viewMode: 1,
                autoCropArea: 1,
                responsive: true,
            });
        };
        reader.readAsDataURL(files[0]);
    }
});

document.addEventListener("DOMContentLoaded", function () {
    const addLinkBtn = document.getElementById("add-link-btn");
    const linkInputs = document.querySelectorAll("#links-container .link-input");

    addLinkBtn.addEventListener("click", function () {
        let hiddenInput = Array.from(linkInputs).find(input => input.style.display === "none");

        if (hiddenInput) {
            hiddenInput.style.display = "block";
        } else {
            alert("Разрешено добавить не более 3 ссылок на сторонние сервисы");
        }
    });
});

document.getElementById('profile-form').addEventListener('submit', function(event) {
    if (event.submitter && event.submitter.name === 'delete_avatar') {
        return;
    }
    event.preventDefault();

    const linkInputs = document.querySelectorAll('input[name="links"]');
    const regex = /^https:\/\/[^\s]+$/;
    for (let input of linkInputs) {
         const url = input.value.trim();
         if (url !== '' && !regex.test(url)) {
              alert('Неверный формат URL. Каждый URL должен начинаться с "https://".');
              input.focus();
              event.preventDefault();
              return;
         }
    }

    const newUsername = document.getElementById('id_username').value;
    const currentUsername = document.getElementById('current-username').value;

    if (newUsername !== currentUsername) {
        const confirmationMessage = `Ваш никнейм будет изменен с "${currentUsername}" на "${newUsername}". Его нужно будет использовать для входа в аккаунт`;
        document.getElementById('confirmation-message').textContent = confirmationMessage;
        document.getElementById('confirmation-modal').style.display = 'block';

        document.getElementById('confirm-button').onclick = function() {
            document.getElementById('confirmation-modal').style.display = 'none';
            submitForm();
        };

        document.getElementById('cancel-button').onclick = function() {
            document.getElementById('confirmation-modal').style.display = 'none';
        };
    } else {
        submitForm();
    }
});

function submitForm() {
    const formData = new FormData(document.getElementById('profile-form'));

    const newUsername = document.getElementById('id_username').value;
    const currentUsername = document.getElementById('current-username').value;
    if (newUsername === currentUsername) {
        formData.delete('username');
    }

    if (cropper) {
        const canvas = cropper.getCroppedCanvas({
            width: 256,
            height: 256,
        });
        canvas.toBlob(function(blob) {
            if (blob.size > 2 * 1024 * 1024) {
                alert('Размер изображения не должен превышать 2МБ');
                return;
            }

            croppedBlob = blob;
            formData.append('avatar', croppedBlob, originalFileName);

            fetch(window.location.href, {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRFToken': '{{ csrf_token }}'
                }
            }).then(response => {
                if (response.ok) {
                    location.reload();
                } else {
                    response.json().then(data => {
                        if (data.username_error) {
                            alert(data.username_error);
                        } else {
                            alert('Ошибка при сохранении!');
                        }
                    });
                }
            });
        });
    } else {
        fetch(window.location.href, {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': '{{ csrf_token }}'
            }
        }).then(response => {
            if (response.ok) {
                location.reload();
            } else {
                response.json().then(data => {
                    if (data.username_error) {
                        alert(data.username_error);
                    } else {
                        alert('Ошибка при сохранении!');
                    }
                });
            }
        });
    }
}