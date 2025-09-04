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
const cancelCropButton = document.getElementById('cancel-crop-btn');
const profileCropActionContainer = document.getElementById('profile-crop-action-container');
let originalImageContainerHTML = document.getElementById('image-container').innerHTML;
const deleteAvatarBtn = document.getElementById('delete-avatar-btn');
const avatarLabel = document.querySelector('label[for="id_avatar"]'); 
const avatarInput = document.getElementById('id_avatar'); 

let isCropperActive = false;

document.getElementById('id_avatar').addEventListener('change', function(event) {
    const files = event.target.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.size > 2 * 1024 * 1024) {
            alert('Размер изображения не должен превышать 2МБ');
            event.target.value = '';
            return;
        }
        const allowedExtensions = ['bmp', 'jpeg', 'png', 'jpg', 'heic'];
        const fileExtension = file.name.split('.').pop().toLowerCase();
        if (!allowedExtensions.includes(fileExtension)) {
            alert('Недопустимый формат изображения. Допустимые расширения: bmp, jpeg, png, jpg, heic.');
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
            image.style.width = '512px';
            image.style.height = '512px';
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
            profileCropActionContainer.style.display = 'flex';
            if (deleteAvatarBtn) {
                deleteAvatarBtn.style.display = 'none';
            }

            avatarLabel.removeAttribute('for');
            isCropperActive = true;
        };
        reader.readAsDataURL(files[0]);
    }
});


avatarLabel.addEventListener('click', function(event) {
    if (isCropperActive) {
        event.preventDefault();
    }
});

cancelCropButton.addEventListener('click', function() {
    if (cropper) {
        cropper.destroy();
        cropper = null;
    }
    avatarInput.value = ''; // Очищаем значение input
    document.getElementById('image-container').innerHTML = originalImageContainerHTML;
    profileCropActionContainer.style.display = 'none';
    if (deleteAvatarBtn) {
        deleteAvatarBtn.style.display = 'block';
    }

    avatarLabel.setAttribute('for', 'id_avatar'); 
    isCropperActive = false; 
});

document.addEventListener("DOMContentLoaded", function () {
    const addLinkBtn = document.getElementById("add-link-btn");
    const linksContainer = document.getElementById("links-container");
    addLinkBtn.addEventListener("click", function () {
        // Находим все поля ввода
        const linkInputs = linksContainer.querySelectorAll(".link-input");
        // Считаем количество уже видимых полей
        const visibleInputsCount = Array.from(linkInputs).filter(input => input.style.display !== "none").length;
        // Проверяем, не превышено ли максимальное количество ссылок (3)
        if (visibleInputsCount < 3) {
            // Ищем скрытое поле для показа
            let hiddenInput = Array.from(linkInputs).find(input => input.style.display === "none");
            if (hiddenInput) {
                hiddenInput.style.display = "block";
            }
            // Если теперь видимых полей стало ровно 3, скрываем кнопку
            if (visibleInputsCount + 1 === 3) {
                addLinkBtn.style.display = "none";
            }
        } else {
            // Если уже есть 3 видимых поля, сразу скрываем кнопку
            addLinkBtn.style.display = "none";
            alert("Разрешено добавить не более 3 ссылок на сторонние сервисы");
        }
    });

    // При загрузке страницы проверяем наличие всех трех полей
    const initialLinkInputs = linksContainer.querySelectorAll(".link-input");
    const initialVisibleInputsCount = Array.from(initialLinkInputs).filter(input => input.style.display !== "none").length;

    if (initialVisibleInputsCount === 3) {
        // Если уже есть 3 видимые ссылки, скрываем кнопку
        addLinkBtn.style.display = "none";
        alert('Уже добавлено 3 ссылки');
    }
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
            width: 512,
            height: 512,
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

document.addEventListener('DOMContentLoaded', function () {
    // Инициализация начальных значений
    const initialUsername = document.getElementById('current-username').value || '';
    const initialAboutMe = document.getElementById('id_about_me').value || '';
    const initialLinks = Array.from(document.querySelectorAll('input[name="links"]'))
        .map(input => input.value || '');

    let hasChanges = false;

    // Функция проверки изменений
    function checkChanges() {
        hasChanges = false;

        // Проверка никнейма
        const currentUsername = document.getElementById('id_username').value || '';
        if (currentUsername !== initialUsername) {
            hasChanges = true;
        }

        // Проверка описания
        const currentAbout = document.getElementById('id_about_me').value || '';
        if (currentAbout !== initialAboutMe) {
            hasChanges = true;
        }

        // Проверка ссылок
        const currentLinks = Array.from(document.querySelectorAll('input[name="links"]'))
            .map(input => input.value || '');
        if (JSON.stringify(currentLinks) !== JSON.stringify(initialLinks)) {
            hasChanges = true;
        }

        // Обновление видимости кнопки
        const saveButton = document.getElementById('profileEditSaveChangesDownButton');
        saveButton.disabled = !hasChanges;
        
    }

    // Добавление обработчиков событий для существующих полей
    document.querySelectorAll('input[name="links"], #id_username, #id_about_me')
        .forEach(element => element.addEventListener('input', checkChanges));

    // Инициализация проверки при загрузке страницы
    checkChanges();
});