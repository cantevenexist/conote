
// Проверка на мобильное устройство
function isMobile() {
    const userAgent = window.navigator.userAgent;
    return /Android|iPhone|iPad|iPod/i.test(userAgent);
}


// External links
document.addEventListener('DOMContentLoaded', function () {
    let originalHref;

    // Добавляем делегирование событий к document
    document.addEventListener('click', function (event) {
        // Находим ближайший элемент с классом .external_link
        const link = event.target.closest('.external_link');
        if (link) { // Проверяем, найден ли такой элемент
            event.preventDefault(); // Предотвращаем стандартное поведение перехода по ссылке
            originalHref = link.href; // Сохраняем URL ссылки

            const externalLinkRedirectConfirmationDivPanel = document.getElementById('externalLinkRedirectConfirmationDivPanel');

            // Вставляем URL в соответствующий блок
            document.getElementById('externalLinkInsertItemDiv').innerHTML = originalHref;

            // Показываем панель подтверждения
            externalLinkRedirectConfirmationDivPanel.style.display = 'block';
            centerElementsVertically(); // Предполагается, что эта функция уже определена где-то в коде
        }
    });

    // Обработчики для кнопок подтверждения и отмены
    document.getElementById('externalLinkRedirectConfirmButton')?.addEventListener('click', function () {
        if (originalHref) {
            window.open(originalHref, '_blank'); // Открываем сохранённый URL в новой вкладке
        }
        const externalLinkRedirectConfirmationDivPanel = document.getElementById('externalLinkRedirectConfirmationDivPanel');
        externalLinkRedirectConfirmationDivPanel.style.display = 'none'; // Скрываем блок подтверждения
    });

    document.getElementById('externalLinkRedirectCancelButton')?.addEventListener('click', function () {
        const externalLinkRedirectConfirmationDivPanel = document.getElementById('externalLinkRedirectConfirmationDivPanel');
        externalLinkRedirectConfirmationDivPanel.style.display = 'none';
    });

    document.getElementById('externalLinkRedirectCloseButton')?.addEventListener('click', function () {
        const externalLinkRedirectConfirmationDivPanel = document.getElementById('externalLinkRedirectConfirmationDivPanel');
        externalLinkRedirectConfirmationDivPanel.style.display = 'none';
    });

    // Закрытие по клавише Escape
    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            const externalLinkRedirectConfirmationDivPanel = document.getElementById('externalLinkRedirectConfirmationDivPanel');
            externalLinkRedirectConfirmationDivPanel.style.display = 'none';
        }
    });
});



// Find and create url in text
function highlightUrlsInText() {
    const elements = document.querySelectorAll('.text_could_be_url');
    const urlRegex = /(\bhttps?:\/\/[^\s]+|www\.[^\s]+)/gi;

    elements.forEach(element => {
        const textContent = element.textContent;
        const modifiedContent = textContent.replace(urlRegex, function (url) {
            if (!url.startsWith('http')) {
                url = 'http://' + url;
            }
            return `<a href="${url}" target="_blank" class="external_link">${url}</a>`;
        });
        element.innerHTML = modifiedContent;
    });
}

// Вызов функции при загрузке страницы
document.addEventListener("DOMContentLoaded", function () {
    highlightUrlsInText();
});


// Menu button, draggable false
function initializeMenu() {
    const avatar = document.querySelectorAll('.avatar_area img');
    const logotype = document.querySelectorAll('.logotype img');
    avatar.forEach(function(img) {img.setAttribute('draggable', 'false');});
    logotype.forEach(function(img) {img.setAttribute('draggable', 'false');});
}

function toggleMenu() {
    var user_settings_panel = document.getElementById("user_settings_panel");
    var toggle_button = document.getElementById("toggle_button");

    // Проверяем, существуют ли необходимые элементы
    if (!user_settings_panel || !toggle_button) {
        return; // Если хотя бы один элемент отсутствует, выходим из функции
    }

    // Если элементы существуют, выполняем логику
    user_settings_panel.classList.toggle("show");
    toggle_button.classList.toggle('active');
}

window.addEventListener('click', function(event) {
    var user_settings_panel = document.getElementById("user_settings_panel");
    var toggle_button = document.getElementById("toggle_button");

    // Проверяем, существуют ли необходимые элементы
    if (!user_settings_panel || !toggle_button) {
        return; // Если хотя бы один элемент отсутствует, выходим из обработчика
    }

    // Логика для скрытия панели при клике вне её или кнопки
    if (
        !user_settings_panel.contains(event.target) &&
        !toggle_button.contains(event.target)
    ) {
        user_settings_panel.classList.remove("show");
        toggle_button.classList.remove('active');
    }
});

// Вызываем инициализацию меню при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    initializeMenu();
});



// Функция для локализации времени
function localizeTime() {
    const timeElements = document.querySelectorAll('.time');
    timeElements.forEach(function(element) {
        const serverTime = element.getAttribute('data-time');
        const utcDate = new Date(serverTime);
        const timezoneOffset = utcDate.getTimezoneOffset();
        const localDate = new Date(utcDate.getTime() - timezoneOffset * 60000);
        const localTime = localDate.toLocaleString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        });
        element.textContent = localTime;
    });
}

// Инициализируем локализацию времени при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    localizeTime();
});



// Метод goBack, который возвращает пользователя на предыдущую страницу
function goBack() {
    window.history.back();
}



// Autoexpand textarea
function initializeAutoExpandTextarea() {
    const textareas = document.querySelectorAll('textarea');
    function adjustHeight(textarea) {
        textarea.style.height = 'auto';
        if (textarea.scrollHeight > textarea.clientHeight) {
            textarea.style.height = textarea.scrollHeight + 'px';
        }
    }
    textareas.forEach(function(textarea) {
        adjustHeight(textarea);
        textarea.addEventListener('input', function() {
            adjustHeight(this);
        });
    });
}

// Вызываем инициализацию текстовых полей при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    initializeAutoExpandTextarea();
});


// Escape disable
document.addEventListener('keydown', function(event) {if (event.key === 'Escape') {event.preventDefault();}});



// Center page
const page_must_be_centered = document.querySelector('.page_must_be_centered');
if (page_must_be_centered) {
window.addEventListener('load', centerVerticallyPage);
window.addEventListener('resize', centerVerticallyPage);}
function centerVerticallyPage() {
    if (isMobile()) {$('.layout_central_block').css('padding-top', '5%'); return;}
    
    const parentHeight_of_page_must_be_centered = document.querySelector('.scrollable-container').offsetHeight;
    const page_must_be_centeredHeight = page_must_be_centered.offsetHeight;

    if (page_must_be_centeredHeight + 100 < parentHeight_of_page_must_be_centered) {
        const offset = (parentHeight_of_page_must_be_centered - page_must_be_centeredHeight) / 2;
        page_must_be_centered.style.marginTop = offset - 25 + 'px';
        page_must_be_centered.style.marginBottom = offset + 25 + 'px';
    } else {
        page_must_be_centered.style.marginTop = '20px';
        page_must_be_centered.style.marginBottom = '20px';
    }
}


// Center content
const elementsToCenter = document.querySelectorAll('.content_must_be_centered');
if (elementsToCenter.length > 0) {
    window.addEventListener('load', centerElementsVertically);
    window.addEventListener('resize', centerElementsVertically);
}

function centerElementsVertically() {
    const parentHeight = document.querySelector('.scrollable-container').offsetHeight;

    elementsToCenter.forEach(element => {
        const elementHeight = element.offsetHeight;

        if (elementHeight < parentHeight) {
            const offset = (parentHeight - elementHeight) / 2;
            element.style.marginTop = offset + 25 + 'px';
            element.style.marginBottom = offset + 25 + 'px';
        } else {
            element.style.marginTop = '0px';
            element.style.marginBottom = '0px';
        }
    });
}



// Zoom box for IMG
document.addEventListener('DOMContentLoaded', function () {
  const zoomBoxPanels = document.querySelectorAll('.zoom_box');

  zoomBoxPanels.forEach(function (zoom_box_divPanel) {
    let zoom_box_scale = 1; // Текущий масштаб изображения
    let isDragging = false; // Флаг для проверки перетаскивания
    let offsetX = 0; // Смещение по оси X
    let offsetY = 0; // Смещение по оси Y
    let initialX = 0; // Начальная позиция курсора по X
    let initialY = 0; // Начальная позиция курсора по Y

    // Обработчик прокрутки для изменения масштаба
    zoom_box_divPanel.addEventListener('wheel', function (event) {
      event.preventDefault();

      if (event.deltaY < 0) {
        zoom_box_scale = Math.min(zoom_box_scale + 0.04, 5);
      } else {
        zoom_box_scale = Math.max(zoom_box_scale - 0.04, 0.25);
      }

      applyTransform();
    });

    // Начало перетаскивания
    zoom_box_divPanel.addEventListener('mousedown', function (event) {
      isDragging = true;
      initialX = event.clientX - parseFloat(zoom_box_divPanel.style.left || '0');
      initialY = event.clientY - parseFloat(zoom_box_divPanel.style.top || '0');
      zoom_box_divPanel.style.cursor = 'grabbing';
    });

    // Движение мыши во время перетаскивания
    document.addEventListener('mousemove', function (event) {
      if (!isDragging) return;

      offsetX = event.clientX - initialX;
      offsetY = event.clientY - initialY;

      zoom_box_divPanel.style.left = `${offsetX}px`;
      zoom_box_divPanel.style.top = `${offsetY}px`;
    });

    // Окончание перетаскивания
    document.addEventListener('mouseup', function () {
      isDragging = false;
      zoom_box_divPanel.style.cursor = 'grab';
    });

    // Применение трансформации (масштабирование + позиционирование)
    function applyTransform() {
      zoom_box_divPanel.style.transform = `scale(${zoom_box_scale})`;
    }

    // Сброс масштаба и позиции
    function resetZoomAndPosition() {
      zoom_box_scale = 1;
      offsetX = 0;
      offsetY = 0;
      zoom_box_divPanel.style.transform = 'scale(1)';
      zoom_box_divPanel.style.left = '0px';
      zoom_box_divPanel.style.top = '0px';
    }

    // Сброс по кнопке
    const resetButton = zoom_box_divPanel.querySelector('.reset-zoom-button');
    if (resetButton) {
      resetButton.addEventListener('click', resetZoomAndPosition);
    }

    // Сброс при клике вне объекта
    document.addEventListener('click', function (event) {
      // Проверяем, был ли клик внутри zoom_box_divPanel
      if (!zoom_box_divPanel.contains(event.target)) {
        resetZoomAndPosition();
      }
    });
  });
});
