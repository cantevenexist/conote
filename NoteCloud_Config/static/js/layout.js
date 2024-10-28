document.addEventListener('DOMContentLoaded', function() {
    const images = document.querySelectorAll('.button_header img');
    const logotype = document.querySelectorAll('.logotype img');
    images.forEach(function(img) {img.setAttribute('draggable', 'false');});
    logotype.forEach(function(img) {img.setAttribute('draggable', 'false');});
});

function toggleMenu() {
    var user_settings_panel = document.getElementById("user_settings_panel");
    var toggle_button = document.getElementById("toggle_button");
    user_settings_panel.classList.toggle("show");
    toggle_button.classList.toggle('active');
}

window.onclick = function(event) {
    var user_settings_panel = document.getElementById("user_settings_panel");
    var toggle_button = document.getElementById("toggle_button");

    if (!user_settings_panel.contains(event.target) && !toggle_button.contains(event.target)) {
        user_settings_panel.classList.remove("show");
        toggle_button.classList.remove('active');
    }
}