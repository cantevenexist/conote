$(document).ready(function() {
    function getCookie(name) {
        const value = $.cookie(name);
        return value ? decodeURIComponent(value) : null;
    }

    const csrftoken = getCookie('csrftoken');
    const username = $('#user-data').data('username');

    function updateSubscribersList(current_user, action) {
        const subscribersList = $('#panel-subscribers ul');
        const subscriberItem = $(`#subscriber-${current_user}`);
        if (action === 'subscribe') {
            subscribersList.append(
                `<li id="subscriber-${current_user}">
                    <div class="subscriber-item">
                        <div class="sub_container">
                            <div class="sub_avatar_container">
                                <a href="/profile/${current_user}/">

                                </a>
                            </div>
                            <div class="sub_username">
                                <a href="/profile/${current_user}/">
                                    ${current_user}
                                </a>
                            </div>
                        </div>
                    </div>
                </li>`);

// {% if user.avatar %}
//     <img src="{{ user.avatar }}" alt="{{ user.username }}'s avatar">
// {% else %}
//     <svg  width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
//     <g id="System / Camera">
//     <path id="Vector" d="M9.48898 7H6.2002C5.08009 7 4.51962 7 4.0918 7.21799C3.71547 7.40973 3.40973 7.71547 3.21799 8.0918C3 8.51962 3 9.08009 3 10.2002V15.8002C3 16.9203 3 17.4796 3.21799 17.9074C3.40973 18.2837 3.71547 18.5905 4.0918 18.7822C4.5192 19 5.07899 19 6.19691 19H17.8031C18.921 19 19.48 19 19.9074 18.7822C20.2837 18.5905 20.5905 18.2837 20.7822 17.9074C21 17.48 21 16.921 21 15.8031V10.1969C21 9.07899 21 8.5192 20.7822 8.0918C20.5905 7.71547 20.2837 7.40973 19.9074 7.21799C19.4796 7 18.9203 7 17.8002 7H14.5108M9.48898 7H9.55078M9.48898 7C9.50151 7.00001 9.51468 7 9.52857 7L9.55078 7M9.48898 7C9.38286 6.99995 9.32339 6.99941 9.27637 6.99414C8.68878 6.92835 8.28578 6.36908 8.40918 5.79084C8.42066 5.73703 8.44336 5.66894 8.4883 5.53412L8.49023 5.52841C8.54156 5.37443 8.56723 5.29743 8.59558 5.22949C8.88586 4.53389 9.54322 4.06083 10.2949 4.00541C10.3683 4 10.449 4 10.6113 4H13.3886C13.5509 4 13.6322 4 13.7057 4.00541C14.4574 4.06083 15.114 4.53389 15.4043 5.22949C15.4326 5.29743 15.4584 5.37434 15.5098 5.52832C15.556 5.66699 15.5791 5.73636 15.5908 5.79093C15.7142 6.36917 15.3118 6.92835 14.7242 6.99414C14.6772 6.99941 14.6171 6.99995 14.5108 7M9.55078 7H14.449M14.449 7H14.5108M14.449 7L14.4712 7C14.4851 7 14.4983 7.00001 14.5108 7M12 16C10.3431 16 9 14.6569 9 13C9 11.3431 10.3431 10 12 10C13.6569 10 15 11.3431 15 13C15 14.6569 13.6569 16 12 16Z" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
//     style="stroke: #6f7276;"/>
//     </g>
//     </svg>
// {% endif %}



            subscribersList.find('.no-subscribers').remove();
        } else if (action === 'unsubscribe') {
            subscriberItem.remove();
            if (subscribersList.children('li').length === 0) {
                subscribersList.append('<li class="no-subscribers">Нет подписчиков</li>');
            }
        }
    }

    $('#subscribe-unsubscribe-container').on('click', '.subscribe-btn', function() {
        $.ajax({
            type: 'POST',
            url: `/profile/${username}/subscribe/`,
            headers: {
                'X-CSRFToken': csrftoken
            },
            success: function(response) {
                if (response.success) {
                    updateSubscribersList(response.current_user, 'subscribe');
                    $('.subscribers-count').each(function() {let currentCount = parseInt($(this).text());$(this).text(currentCount + 1);});
                    $('#subscribe-btn').hide();
                    $('#unsubscribe-btn').show();
                    $('#subscribe-unsubscribe-container').html('<button class="unsubscribe-btn profile-social-button" id="unsubscribe-btn">Отписаться</button>');
                    window.subscribersItems = document.querySelectorAll('.subscriber-item');
                } else {
                    alert(response.error);
                }
            },
            error: function() {
                console.error(error);
                alert('Произошла ошибка при подписке.');
            }
        });
    });

    $('#subscribe-unsubscribe-container').on('click', '.unsubscribe-btn', function() {
        $.ajax({
            type: 'POST',
            url: `/profile/${username}/unsubscribe/`,
            headers: {
                'X-CSRFToken': csrftoken
            },
            success: function(response) {
                if (response.success) {
                    updateSubscribersList(response.current_user, 'unsubscribe');
                    $('.subscribers-count').each(function() {let currentCount = parseInt($(this).text());$(this).text(currentCount - 1);});
                    $('#unsubscribe-btn').hide();
                    $('#subscribe-btn').show();
                    $('#subscribe-unsubscribe-container').html('<button class="subscribe-btn profile-social-button" id="subscribe-btn">Подписаться</button>');
                    window.subscribersItems = document.querySelectorAll('.subscriber-item');
                } else {
                    alert(response.error);
                }
            },
            error: function() {
                alert('Произошла ошибка при отписке.');
            }
        });
    });
});


var panel_subscribers = document.getElementById("panel-subscribers");
var close_btn_subscribers = document.getElementById("closeBtn-subscribers");
var subscribe_btn = document.getElementById("subscribe-btn");
var unsubscribe_btn = document.getElementById("unsubscribe-btn");

function toggleDiv_subscribers() {
    if (panel_subscribers.classList.contains("show")) {
        panel_subscribers.classList.remove("show");
    } else {
        panel_subscribers.classList.add("show");
    }
}

function hidePanelSubscribers() {
    panel_subscribers.classList.remove("show");
    const searchInputSubscribersClose = document.getElementById('searchInputSubscribers');
    const subscribersItemsClose = document.querySelectorAll('.subscriber-item');
    const noResultsMessageSubscribersClose = document.getElementById('noResultsMessageSubscribers');

    if (!searchInputSubscribersClose || !subscribersItemsClose || !noResultsMessageSubscribersClose) return;
    searchInputSubscribersClose.value = '';
    subscribersItemsClose.forEach(item => {item.style.display = 'block';});
    noResultsMessageSubscribersClose.style.display = 'none';
}

if (panel_subscribers && close_btn_subscribers) {
    close_btn_subscribers.addEventListener("click", hidePanelSubscribers);
}

//document.addEventListener("click", function(event) {
//    if (
//        !panel_subscribers.contains(event.target) &&
//        event.target !== close_btn_subscribers &&
//        event.target !== moreBtn_subscribers &&
//        event.target !== subscribe_btn &&
//        event.target !== unsubscribe_btn
//    ) {
//        hidePanelSubscribers();
//    }
//});


var panel_subscriptions = document.getElementById("panel-subscriptions");
var close_btn_subscriptions = document.getElementById("closeBtn-subscriptions");

function toggleDiv_subscriptions() {
    if (panel_subscriptions.classList.contains("show")) {
        panel_subscriptions.classList.remove("show");
    } else {
        panel_subscriptions.classList.add("show");
    }
}

function hidePanelSubscriptions() {
    panel_subscriptions.classList.remove("show");
    const searchInputSubscriptionsClose = document.getElementById('searchInputSubscriptions');
    const subscriptionsItemsClose = document.querySelectorAll('.subscription-item');
    const noResultsMessageSubscriptionsClose = document.getElementById('noResultsMessageSubscriptions');

    if (!searchInputSubscriptionsClose || !subscriptionsItemsClose || !noResultsMessageSubscriptionsClose) return;
    searchInputSubscriptionsClose.value = '';
    subscriptionsItemsClose.forEach(item => {item.style.display = 'block';});
    noResultsMessageSubscriptionsClose.style.display = 'none';
}

if (panel_subscriptions && panel_subscriptions) {
    close_btn_subscriptions.addEventListener("click", hidePanelSubscriptions);
}

// document.addEventListener("click", function(event) {
//     if (
//         !panel_subscriptions.contains(event.target) &&
//         event.target !== close_btn_subscriptions &&
//         event.target !== moreBtn_subscriptions
//     ) {
//         hidePanelSubscriptions();
//     }
// });

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        hidePanelSubscribers();
        hidePanelSubscriptions();
    }
});

function checkOverflow() {
    var profileAboutContainer = document.querySelector('.profile-username-about-container');
    var profileAboutText = document.getElementById('profile-about');
    var profileAboutBtn = document.getElementById('profile-about-fullsize-btn');
    var profileAboutIcon = document.getElementById('hide-show-profile-about-icon');

    if (!profileAboutContainer) {
        return;
    }
    
    // Возвращение к исходной высоте при изменении окна
    profileAboutContainer.classList.remove("fullsize");
    profileAboutContainer.style.maxHeight = '67px';
    profileAboutIcon.classList.remove('rotate');

    if (profileAboutText.scrollHeight > profileAboutContainer.clientHeight) {
        profileAboutContainer.classList.add('overflowing');
        profileAboutBtn.classList.add('show');
    } else {
        profileAboutContainer.classList.remove('overflowing');
        profileAboutBtn.classList.remove('show');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
});

function resize_About() {
    var profileAboutContainer = document.getElementById("profile-username-about-container");
    var profileAboutText = document.getElementById('profile-about');
    var isFullsize = profileAboutContainer.classList.contains("fullsize");
    var profileAboutIcon = document.getElementById('hide-show-profile-about-icon');
  
    if (isFullsize) {
        // Сворачиваем контейнер (возвращаем к исходной высоте)
        profileAboutContainer.classList.remove("fullsize");
        profileAboutContainer.classList.add("overflowing");
        profileAboutContainer.style.maxHeight = '67px';
        profileAboutIcon.classList.remove('rotate');
    } else {
        // Разворачиваем контейнер
        profileAboutContainer.classList.add("fullsize");
        profileAboutContainer.classList.remove("overflowing");
        profileAboutContainer.style.maxHeight = profileAboutText.scrollHeight + 'px';
        profileAboutIcon.classList.add('rotate');
    }
}

function copyUsername() {
    const usernameElement = document.querySelector('.profile-username');
    const username = usernameElement.textContent;
  
    const textarea = document.createElement("textarea");
    textarea.value = username;
    textarea.style.position = "fixed";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
  
    try {
      document.execCommand('copy');
      alert('Имя пользователя скопировано!');
    } catch (err) {
      console.error('Не удалось скопировать имя пользователя', err);
    }
  
    document.body.removeChild(textarea);
  }

document.addEventListener('DOMContentLoaded', function () {
    // Получаем ссылки на элементы
    const searchInputSubscribers = document.getElementById('searchInputSubscribers');
    window.subscribersItems = document.querySelectorAll('.subscriber-item');
    const noResultsMessageSubscribers = document.getElementById('noResultsMessageSubscribers');

    if (!searchInputSubscribers) return;
    
    // Функция для фильтрации элементов
    function filterSubscribers() {
        const querySubscribers = searchInputSubscribers.value.toLowerCase(); // Текст из поля поиска
        let hasVisibleItemsSubscribers = false; // Флаг для проверки наличия видимых элементов

        subscribersItems.forEach(item => {
            const username = item.querySelector('.sub_username').textContent.toLowerCase();
            if (username.startsWith(querySubscribers)) {
                
                item.style.display = 'block'; // Показываем элемент
                hasVisibleItemsSubscribers = true; // Устанавливаем флаг в true
            } else {
                item.style.display = 'none'; // Скрываем элемент
            }
        });

        // Если нет видимых элементов, показываем сообщение "Ничего не найдено"
        if (!hasVisibleItemsSubscribers) {
            noResultsMessageSubscribers.style.display = 'block';
        } else {
            noResultsMessageSubscribers.style.display = 'none';
        }
    }

    // Обработчик события ввода текста
    searchInputSubscribers.addEventListener('input', filterSubscribers);
});


document.addEventListener('DOMContentLoaded', function () {
    // Получаем ссылки на элементы
    const searchInputSubscriptions = document.getElementById('searchInputSubscriptions');
    window.subscriptionsItems = document.querySelectorAll('.subscription-item');
    const noResultsMessageSubscriptions = document.getElementById('noResultsMessageSubscriptions');

    if (!searchInputSubscriptions) return;

    // Функция для фильтрации элементов
    function filterSubscriptions() {
        const querySubscriptions = searchInputSubscriptions.value.toLowerCase(); // Текст из поля поиска
        let hasVisibleItemsSubscriptions = false; // Флаг для проверки наличия видимых элементов

        subscriptionsItems.forEach(item => {
            const username = item.querySelector('.sub_username').textContent.toLowerCase();
            if (username.startsWith(querySubscriptions)) {
                item.style.display = 'block'; // Показываем элемент
                hasVisibleItemsSubscriptions = true; // Устанавливаем флаг в true
            } else {
                item.style.display = 'none'; // Скрываем элемент
            }
        });

        // Если нет видимых элементов, показываем сообщение "Ничего не найдено"
        if (!hasVisibleItemsSubscriptions) {
            noResultsMessageSubscriptions.style.display = 'block';
        } else {
            noResultsMessageSubscriptions.style.display = 'none';
        }
    }

    // Обработчик события ввода текста
    searchInputSubscriptions.addEventListener('input', filterSubscriptions);
});
