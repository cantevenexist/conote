
function addSvgAsNewListItem() {
  const warningUls = document.querySelectorAll('ul:not([class])');
  const errorUls = document.querySelectorAll('ul.errorlist');

  function processUls(uls, svgContent) {
    uls.forEach(ul => {
      const firstLi = ul.querySelector('li:first-child');
      if (firstLi && !firstLi.querySelector('svg.icon-attention, svg.icon-error')) {
        const newLi = document.createElement('li');
        newLi.innerHTML = svgContent;
        ul.prepend(newLi);
      }
    });
  }
  const warningSvg = `
    <svg width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-attention">
      <g id="Warning / Circle_Warning">
        <path id="Vector" d="M12 8.4502V12.4502M12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21ZM12.0498 15.4502V15.5502L11.9502 15.5498V15.4502H12.0498Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
    </svg>
  `;
  processUls(warningUls, warningSvg);

  const errorSvg = `
    <svg width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-error">
      <g id="Warning / Circle_Warning">
        <path id="Vector" d="M12 8.4502V12.4502M12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21ZM12.0498 15.4502V15.5502L11.9502 15.5498V15.4502H12.0498Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
    </svg>
  `;
  processUls(errorUls, errorSvg);
}

document.addEventListener('DOMContentLoaded', addSvgAsNewListItem);


const parent = document.querySelector('.scrollable-container');
const child = document.querySelector('.form_block');

function centerVertically() {
    const parentHeight = parent.offsetHeight;
    const childHeight = child.offsetHeight;

    if (childHeight < parentHeight) {
    const offset = (parentHeight - childHeight) / 2;
    child.style.marginTop = offset + 'px';
    child.style.marginBottom = offset + 'px';
    } else {
    // Если внутренний блок выше, чем родительский, сбросить отступы
    child.style.marginTop = '20px';
    child.style.marginBottom = '20px';
    }
}

// Вызываем функцию при загрузке страницы и при изменении размера окна
window.addEventListener('load', centerVertically);
window.addEventListener('resize', centerVertically);

document.addEventListener('keydown', function(event) {if (event.key === 'Escape') {event.preventDefault();}});
