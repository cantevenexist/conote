document.addEventListener('DOMContentLoaded', function() {
            const items = document.querySelectorAll('.settings-item');
            items.forEach(item => {
                item.addEventListener('click', function() {
                    const url = this.getAttribute('data-url');
                    fetch(url)
                        .then(response => response.text())
                        .then(data => {
                            document.getElementById('settings-content').innerHTML = data;
                        })
                        .catch(error => console.error('Error:', error));
                });
            });
});


// btns scroll
document.addEventListener('DOMContentLoaded', function() {
  const slider = document.querySelector('.account_settings_panel_ul');
  const prevBtn = document.querySelector('.prev_button');
  const nextBtn = document.querySelector('.next_button');
  const leftMask = document.querySelector('.left_mask');
  const rightMask = document.querySelector('.right_mask');

  // Стиль для активной кнопки
  const style = document.createElement('style');
  style.textContent = `
    .profile_setting_item_button.active {
      background-color: #f0f0f0;
      border-radius: 4px;
      font-weight: bold;
      color: #000;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
  `;
  document.head.appendChild(style);

  // Функция установки активной кнопки
  function setActiveButton() {
    // Полный путь из URL
    const fullPath = window.location.pathname + window.location.search;
    
    // Удаляем active класс у всех кнопок
    document.querySelectorAll('.profile_setting_item_button').forEach(btn => {
      btn.classList.remove('active');
    });

    // Ищем точное совпадение
    let activeButton = document.querySelector(`.account_settings_panel_ul a[href="${fullPath}"] .profile_setting_item_button`);
    
    // Если точное совпадение не найдено, ищем частичное
    if (!activeButton) {
      const links = document.querySelectorAll('.account_settings_panel_ul a');
      for (let link of links) {
        if (fullPath.startsWith(link.getAttribute('href'))) {
          activeButton = link.querySelector('.profile_setting_item_button');
          break;
        }
      }
    }

    // Если нашли кнопку - активируем
    if (activeButton) {
      activeButton.classList.add('active');
    }
  }


  // Обработчики кликов по ссылкам
  document.querySelectorAll('.account_settings_panel_ul a').forEach(link => {
    link.addEventListener('click', function() {
      localStorage.setItem('activeNavButton', this.getAttribute('href'));
    });
  });

  // Инициализация
  setActiveButton();
  
  // Остальной ваш код...
  leftMask.style.transition = 'opacity 0.5s ease';
  rightMask.style.transition = 'opacity 0.5s ease';
  
  function checkScroll() {
    const hasScroll = slider.scrollWidth > slider.clientWidth + 1;
    const atStart = slider.scrollLeft <= 1;
    const atEnd = slider.scrollLeft + slider.clientWidth >= slider.scrollWidth - 1;
    
    if (hasScroll && !atStart && leftMask.style.opacity !== '1') {
      leftMask.style.transition = 'none';
      leftMask.style.opacity = '1';
      setTimeout(() => leftMask.style.transition = 'opacity 0.5s ease', 10);
    }
    
    if (hasScroll && !atEnd && rightMask.style.opacity !== '1') {
      rightMask.style.transition = 'none';
      rightMask.style.opacity = '1';
      setTimeout(() => rightMask.style.transition = 'opacity 0.5s ease', 10);
    }
    
    leftMask.style.opacity = hasScroll && !atStart ? '1' : '0';
    rightMask.style.opacity = hasScroll && !atEnd ? '1' : '0';
    
    prevBtn.style.opacity = hasScroll && !atStart ? '1' : '0';
    prevBtn.style.pointerEvents = hasScroll && !atStart ? 'auto' : 'none';
    nextBtn.style.opacity = hasScroll && !atEnd ? '1' : '0';
    nextBtn.style.pointerEvents = hasScroll && !atEnd ? 'auto' : 'none';
  }
  
  function smoothScroll(direction) {
    const scrollAmount = Math.min(
      direction === 'prev' ? slider.scrollLeft : slider.scrollWidth - slider.clientWidth - slider.scrollLeft,
      200
    );
    slider.scrollBy({
      left: direction === 'prev' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  }
  
  prevBtn.addEventListener('click', () => smoothScroll('prev'));
  nextBtn.addEventListener('click', () => smoothScroll('next'));
  
  let resizeTimeout;
  function handleResize() {
    clearTimeout(resizeTimeout);
    leftMask.style.transition = 'none';
    rightMask.style.transition = 'none';
    checkScroll();
    resizeTimeout = setTimeout(() => {
      leftMask.style.transition = 'opacity 0.3s ease';
      rightMask.style.transition = 'opacity 0.3s ease';
    }, 100);
  }
  
  window.addEventListener('resize', handleResize);
  slider.addEventListener('scroll', checkScroll);
  checkScroll();
});