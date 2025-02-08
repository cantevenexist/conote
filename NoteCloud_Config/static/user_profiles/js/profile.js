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
            subscribersList.append(`<li id="subscriber-${current_user}"><a href="/profile/${current_user}/">${current_user}</a></li>`);
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
                    $('#subscribers-count').text(parseInt($('#subscribers-count').text()) + 1);
                    $('#subscribe-btn').hide();
                    $('#unsubscribe-btn').show();
                    $('#subscribe-unsubscribe-container').html('<button class="unsubscribe-btn" id="unsubscribe-btn">Отписаться</button>');
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
                    $('#subscribers-count').text(parseInt($('#subscribers-count').text()) - 1);
                    $('#unsubscribe-btn').hide();
                    $('#subscribe-btn').show();
                    $('#subscribe-unsubscribe-container').html('<button class="subscribe-btn" id="subscribe-btn">Подписаться</button>');
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
var moreBtn_subscribers = document.getElementById("moreBtn-subscribers");
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
}

close_btn_subscribers.addEventListener("click", hidePanelSubscribers);

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
var moreBtn_subscriptions = document.getElementById("moreBtn-subscriptions");

function toggleDiv_subscriptions() {
    if (panel_subscriptions.classList.contains("show")) {
        panel_subscriptions.classList.remove("show");
    } else {
        panel_subscriptions.classList.add("show");
    }
}

function hidePanelSubscriptions() {
    panel_subscriptions.classList.remove("show");
}

close_btn_subscriptions.addEventListener("click", hidePanelSubscriptions);

document.addEventListener("click", function(event) {
    if (
        !panel_subscriptions.contains(event.target) &&
        event.target !== close_btn_subscriptions &&
        event.target !== moreBtn_subscriptions
    ) {
        hidePanelSubscriptions();
    }
});