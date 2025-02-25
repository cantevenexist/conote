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
                            <div class="sub_avatar_container"><a href="/profile/${current_user}/"></a></div>
                            <div class="sub_username"><a href="/profile/${current_user}/">${current_user}</a></div>
                        </div>
                    </div>
                </li>`);

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
