function getScreenPixelWidth() {
      const devicePixelRatio = window.devicePixelRatio || 1;
      const screenWidth = window.innerWidth;
      const zoomLevel = document.documentElement.style.zoom || 1;

      return screenWidth * devicePixelRatio / zoomLevel;
}

const layoutCentralBlock = document.querySelector('.layout_central_block');
layoutCentralBlock.style.maxWidth = getScreenPixelWidth() + 'px';


function toggleDiv() {
        var user_settings_panel = document.getElementById("user_settings_panel");
        if (user_settings_panel.classList.contains("show")) {
            user_settings_panel.classList.remove("show");
        } else {
            user_settings_panel.classList.add("show");
        }
}
