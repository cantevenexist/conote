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