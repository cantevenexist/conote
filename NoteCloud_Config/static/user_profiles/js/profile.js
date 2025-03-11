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
        var avatarOwnerHtml = id_owner_profile_avatar ? id_owner_profile_avatar.innerHTML : '';
        if (action === 'subscribe') {
            subscribersList.append(
                `<li id="subscriber-${current_user}">
                    <div class="subscriber-item">
                        <div class="sub_container">
                            <div class="sub_avatar_container">
                                <a href="/profile/${current_user}/">
                                    ${avatarOwnerHtml}
                                </a>
                            </div>
                            <div class="sub_username"><p>
                                <a href="/profile/${current_user}/"class="selectable">
                                    ${current_user}
                                </p></a>
                            </div>
                        </div>
                    </div>
                </li>`);
            subscribersList.find('.no-subscribers').remove();
            window.subscribersItems = document.querySelectorAll('.subscriber-item');
        } else if (action === 'unsubscribe') {
            subscriberItem.remove();}

        if (subscribersList.children('li').length === 0) {
            subscribersList.append('<li class="no-subscribers"><div class="panel_subs-box-sign"><svg width="2000" height="2000" viewBox="0 0 2000 2000" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_192_102)"><circle cx="1000" cy="1000" r="875" fill="#6495ED"/><mask id="mask0_192_102" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="1000" y="-216" width="1036" height="2432"><rect x="1000" y="-216" width="1036" height="2432" fill="black"/></mask><g mask="url(#mask0_192_102)"><circle cx="1000" cy="1000" r="875" fill="#5F8BDA"/></g><path d="M1293 1366.5C1293 1258.62 1161.82 1171.17 1000 1171.17C838.18 1171.17 707 1258.62 707 1366.5M1000 1024.67C892.12 1024.67 804.667 937.211 804.667 829.333C804.667 721.454 892.12 634 1000 634C1107.88 634 1195.33 721.454 1195.33 829.333C1195.33 937.211 1107.88 1024.67 1000 1024.67Z" stroke="white" stroke-width="75" stroke-linecap="round" stroke-linejoin="round"/><rect x="1505.54" y="500" width="75" height="300.569" rx="30" transform="rotate(45 1505.54 500)" fill="white"/><rect x="1293" y="553.033" width="75" height="300.569" rx="30" transform="rotate(-45 1293 553.033)" fill="white"/></g><defs><clipPath id="clip0_192_102"><rect width="2000" height="2000" fill="white"/></clipPath></defs></svg></div><div class="panel_subs-box-sign-text">Нет подписчиков</div></li>');
            if(document.getElementById('searchSubContainerSubscribers')){document.getElementById('searchSubContainerSubscribers').style.display='none';}}
        else{if(document.getElementById('searchSubContainerSubscribers')){document.getElementById('searchSubContainerSubscribers').style.display='block';}}
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
                    $('.subscribers-count').each(function() {let currentCount = parseInt($(this).text());$(this).text(currentCount + 1);});
                    $('#subscribe-btn').hide();
                    $('#unsubscribe-btn').show();
                    $('#subscribe-unsubscribe-container').html('<button class="unsubscribe-btn profile-social-button" id="unsubscribe-btn">Отписаться</button>');
                    window.subscribersItems = document.querySelectorAll('.subscriber-item');
                    updateSubscribersList(response.current_user, 'subscribe');
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
                    $('.subscribers-count').each(function() {let currentCount = parseInt($(this).text());$(this).text(currentCount - 1);});
                    $('#unsubscribe-btn').hide();
                    $('#subscribe-btn').show();
                    $('#subscribe-unsubscribe-container').html('<button class="subscribe-btn profile-social-button" id="subscribe-btn">Подписаться</button>');
                    window.subscribersItems = document.querySelectorAll('.subscriber-item');
                    updateSubscribersList(response.current_user, 'unsubscribe');
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

var fullsize_avatar_panel = document.getElementById("profile-fullsize-avatar-panel");
var close_btn_fullsize_avatar_panel = document.getElementById("closeBtn-fullsize-avatar-panel");

function toggleDiv_fullsize_avatar_panel() {
    if (fullsize_avatar_panel.classList.contains("show")) {fullsize_avatar_panel.classList.remove("show");}
    else {fullsize_avatar_panel.classList.add("show");}
}
function hideFullsizeAvatarPanel() {fullsize_avatar_panel.classList.remove("show")}

if (fullsize_avatar_panel && close_btn_fullsize_avatar_panel) {close_btn_fullsize_avatar_panel.addEventListener("click", hideFullsizeAvatarPanel);}



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


document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        hidePanelSubscribers();
        hidePanelSubscriptions();
        hideFullsizeAvatarPanel();
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
        profileAboutContainer.classList.remove("fullsize");
        profileAboutContainer.classList.add("overflowing");
        profileAboutContainer.style.maxHeight = '67px';
        profileAboutIcon.classList.remove('rotate');
    } else {
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
    const searchInputSubscribers = document.getElementById('searchInputSubscribers');
    window.subscribersItems = document.querySelectorAll('.subscriber-item');
    const noResultsMessageSubscribers = document.getElementById('noResultsMessageSubscribers');
    const clearSearchInputSubscribers = document.getElementById('clearSearchInputSubscribersBtn');

    if (!searchInputSubscribers) return;
    
    function filterSubscribers() {
        const querySubscribers = searchInputSubscribers.value.toLowerCase();
        let hasVisibleItemsSubscribers = false; 

        subscribersItems.forEach(item => {
            const username = item.querySelector('.sub_username').textContent.toLowerCase();
            if (username.startsWith(querySubscribers)) {
                item.style.display = 'block'; 
                hasVisibleItemsSubscribers = true; 
            } else {
                item.style.display = 'none'; 
            }
        });

        if (!hasVisibleItemsSubscribers) {
            noResultsMessageSubscribers.style.display = 'block';
        } else {
            noResultsMessageSubscribers.style.display = 'none';
        }
    }

    function clearSearchInputSubscribersFunction () {
        searchInputSubscribers.value = ''; 
        searchInputSubscribers.focus();   
        toggleClearSearchInputSubscribersBtn(); 
        filterSubscribers();
      }
      
    function toggleClearSearchInputSubscribersBtn() {
        if (searchInputSubscribers.value.trim() !== '') {clearSearchInputSubscribers.style.display = 'block';}
        else {clearSearchInputSubscribers.style.display = 'none';}
    }

    searchInputSubscribers.addEventListener('input', function () {filterSubscribers(),toggleClearSearchInputSubscribersBtn()});
    clearSearchInputSubscribers.addEventListener('click', clearSearchInputSubscribersFunction);
});


document.addEventListener('DOMContentLoaded', function () {
    const searchInputSubscriptions = document.getElementById('searchInputSubscriptions');
    window.subscriptionsItems = document.querySelectorAll('.subscription-item');
    const noResultsMessageSubscriptions = document.getElementById('noResultsMessageSubscriptions');
    const clearSearchInputSubscriptions = document.getElementById('clearSearchInputSubscriptionsBtn');

    if (!searchInputSubscriptions) return;

    function filterSubscriptions() {
        const querySubscriptions = searchInputSubscriptions.value.toLowerCase();
        let hasVisibleItemsSubscriptions = false; 

        subscriptionsItems.forEach(item => {
            const username = item.querySelector('.sub_username').textContent.toLowerCase();
            if (username.startsWith(querySubscriptions)) {
                item.style.display = 'block';
                hasVisibleItemsSubscriptions = true;
            } else {
                item.style.display = 'none'; 
            }
        });

        if (!hasVisibleItemsSubscriptions) {noResultsMessageSubscriptions.style.display = 'block';}
        else {noResultsMessageSubscriptions.style.display = 'none';}
    }

    function clearSearchInputSubscriptionsFunction () {
        searchInputSubscriptions.value = ''; 
        searchInputSubscriptions.focus();
        toggleClearSearchInputSubscriptionsBtn(); 
        filterSubscriptions();
      }
      
    function toggleClearSearchInputSubscriptionsBtn() {        
        if (searchInputSubscriptions.value.trim() !== '') {clearSearchInputSubscriptions.style.display = 'block'; }
        else {clearSearchInputSubscriptions.style.display = 'none';}
    }

    searchInputSubscriptions.addEventListener('input', function () {filterSubscriptions(),toggleClearSearchInputSubscriptionsBtn()});
    clearSearchInputSubscriptions.addEventListener("click", clearSearchInputSubscriptionsFunction);
});
