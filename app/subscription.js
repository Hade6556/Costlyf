(function () {
  'use strict';

  var SUBSCRIPTIONS_KEY = 'costlyf_my_subscriptions';
  var COUNTDOWN_SECONDS = 5;

  function getSubscriptions() {
    try {
      var raw = localStorage.getItem(SUBSCRIPTIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveSubscriptions(list) {
    try {
      localStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function getIndexFromHash() {
    var hash = window.location.hash ? window.location.hash.slice(1) : '';
    var n = parseInt(hash, 10);
    return isNaN(n) || n < 0 ? null : n;
  }

  function getCurrentSubscription() {
    var index = getIndexFromHash();
    var list = getSubscriptions();
    if (index == null || index >= list.length) return null;
    return { subscription: list[index], index: index };
  }

  /** Same contact grouping as inbox: returns contact index for a given owner name, or 0. */
  function getInboxContactIndexForOwner(ownerName) {
    var subs = getSubscriptions();
    var byName = {};
    for (var i = 0; i < subs.length; i++) {
      var name = (subs[i].ownerName || 'Owner').trim() || 'Owner';
      if (!byName[name]) byName[name] = true;
    }
    var names = Object.keys(byName).sort();
    var key = (ownerName || 'Owner').trim() || 'Owner';
    var idx = names.indexOf(key);
    return idx >= 0 ? idx : 0;
  }

  var HERO_AVATAR_COLORS = ['#a8e6cf', '#d4b5ff', '#a8d4f0', '#fff4b8', '#ffc8d4'];
  function getDefaultHeroIndex(seed) {
    if (seed == null || seed === '') return 1;
    var h = 0;
    var s = String(seed);
    for (var i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
    return (Math.abs(h) % 5) + 1;
  }

  function renderOwnerBlock(sub, index) {
    var ownerName = (sub && sub.ownerName) ? sub.ownerName.trim() : 'Owner';
    if (!ownerName) ownerName = 'Owner';
    var avatarEl = document.getElementById('subscription-owner-avatar');
    var nameEl = document.getElementById('subscription-owner-name');
    var chatLink = document.getElementById('subscription-open-chat');
    if (nameEl) nameEl.textContent = ownerName;
    if (chatLink) {
      var contactIndex = getInboxContactIndexForOwner(ownerName);
      chatLink.href = '/inbox#' + contactIndex;
    }
    if (!avatarEl) return;
    var avatarUrl = sub && sub.ownerAvatarUrl && sub.ownerAvatarUrl.trim();
    if (avatarUrl) {
      avatarEl.className = 'subscription-owner-avatar subscription-owner-avatar--img';
      avatarEl.innerHTML = '<img src="' + escapeHtml(avatarUrl) + '" alt="">';
    } else {
      var heroIndex = getDefaultHeroIndex(ownerName);
      var color = HERO_AVATAR_COLORS[heroIndex - 1] || HERO_AVATAR_COLORS[0];
      avatarEl.className = 'subscription-owner-avatar subscription-owner-avatar--default';
      avatarEl.innerHTML = '<span class="inbox-avatar-circle" style="--circle-color:' + escapeHtml(color) + '"><img src="/media/hero-profiles/' + heroIndex + '.png" alt=""></span>';
    }
  }

  function escapeHtml(s) {
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function setFirstTimeFalse(index) {
    var list = getSubscriptions();
    if (index >= 0 && index < list.length) {
      list[index].firstTime = false;
      saveSubscriptions(list);
    }
  }

  function removeSubscription(index) {
    var list = getSubscriptions();
    if (index < 0 || index >= list.length) return;
    list.splice(index, 1);
    saveSubscriptions(list);
    window.location.href = '/home';
  }

  function getNextPaymentDate(joinedIso) {
    var d = new Date(joinedIso);
    d.setMonth(d.getMonth() + 1);
    return d;
  }

  function formatCountdown(ms) {
    if (ms <= 0) return 'Due now';
    var days = Math.floor(ms / (24 * 60 * 60 * 1000));
    var hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    if (days > 0) return days + 'd ' + hours + 'h';
    if (hours > 0) return hours + 'h';
    var mins = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    return mins + 'm';
  }

  function init() {
    var data = getCurrentSubscription();
    if (!data) {
      window.location.href = '/home';
      return;
    }

    var sub = data.subscription;
    var index = data.index;
    var serviceName = sub.serviceName || sub.service || 'Subscription';

    document.getElementById('subscription-title').textContent = serviceName;
    renderOwnerBlock(sub, index);

    var firstTimeEl = document.getElementById('subscription-first-time');
    var returningEl = document.getElementById('subscription-returning');

    if (sub.firstTime) {
      firstTimeEl.hidden = false;
      returningEl.hidden = true;
      initFirstTimeView(sub, index);
    } else {
      firstTimeEl.hidden = true;
      returningEl.hidden = false;
      initReturningView(sub, index);
    }
  }

  function initFirstTimeView(sub, index) {
    var detailsEl = document.getElementById('subscription-login-details');
    var usernameEl = document.getElementById('sub-username');
    var passwordEl = document.getElementById('sub-password');
    var btnReveal = document.getElementById('btn-reveal');
    var btnIssue = document.getElementById('btn-issue-first');

    usernameEl.textContent = sub.loginUsername || '—';
    var pwd = sub.loginPassword || '—';
    if (pwd === '••••••••') pwd = 'SharedPass1!';
    passwordEl.textContent = pwd;

    var countdownTimer = null;

    btnReveal.addEventListener('click', function () {
      if (detailsEl.hidden) {
        detailsEl.hidden = false;
        btnReveal.textContent = COUNTDOWN_SECONDS + 's';
        btnReveal.disabled = true;
        var left = COUNTDOWN_SECONDS;
        countdownTimer = setInterval(function () {
          left--;
          if (left <= 0) {
            clearInterval(countdownTimer);
            countdownTimer = null;
            btnReveal.disabled = false;
            btnReveal.textContent = 'Verify the account is working';
            btnReveal.classList.add('subscription-btn--verify');
            btnReveal.dataset.ready = '1';
            return;
          }
          btnReveal.textContent = left + 's';
        }, 1000);
        return;
      }
      if (btnReveal.dataset.ready === '1') {
        setFirstTimeFalse(index);
        window.location.href = '/home';
      }
    });

    btnIssue.addEventListener('click', function () {
      var returnTo = '/subscription#' + index;
      window.location.href = '/help?from=' + encodeURIComponent(returnTo);
    });

    var cancelConfirmEl = document.getElementById('subscription-cancel-confirm-first');
    var cancelBtnFirst = document.getElementById('btn-cancel-sub-first');
    var keepBtnFirst = document.getElementById('btn-cancel-keep-first');
    var confirmBtnFirst = document.getElementById('btn-cancel-confirm-first');
    if (cancelBtnFirst && cancelConfirmEl) {
      cancelBtnFirst.addEventListener('click', function () {
        cancelConfirmEl.hidden = false;
      });
    }
    if (keepBtnFirst && cancelConfirmEl) {
      keepBtnFirst.addEventListener('click', function () {
        cancelConfirmEl.hidden = true;
      });
    }
    if (confirmBtnFirst) {
      confirmBtnFirst.addEventListener('click', function () {
        removeSubscription(index);
      });
    }
  }

  function initReturningView(sub, index) {
    var countdownEl = document.getElementById('subscription-countdown-value');
    var toggleEl = document.getElementById('subscription-toggle-pay');
    var btnIssue = document.getElementById('btn-issue-return');
    var payKey = 'costlyf_sub_willpay_' + index;

    toggleEl.checked = localStorage.getItem(payKey) !== 'false';
    toggleEl.addEventListener('change', function () {
      localStorage.setItem(payKey, toggleEl.checked ? 'true' : 'false');
    });

    function updateCountdown() {
      var next = getNextPaymentDate(sub.joined);
      var now = new Date();
      var ms = next.getTime() - now.getTime();
      countdownEl.textContent = formatCountdown(ms);
    }
    updateCountdown();
    setInterval(updateCountdown, 60000);

    btnIssue.addEventListener('click', function () {
      var returnTo = '/subscription#' + index;
      window.location.href = '/help?from=' + encodeURIComponent(returnTo);
    });

    var cancelConfirmEl = document.getElementById('subscription-cancel-confirm');
    var cancelBtn = document.getElementById('btn-cancel-sub');
    var keepBtn = document.getElementById('btn-cancel-keep');
    var confirmBtn = document.getElementById('btn-cancel-confirm');
    if (cancelBtn && cancelConfirmEl) {
      cancelBtn.addEventListener('click', function () {
        cancelConfirmEl.hidden = false;
      });
    }
    if (keepBtn && cancelConfirmEl) {
      keepBtn.addEventListener('click', function () {
        cancelConfirmEl.hidden = true;
      });
    }
    if (confirmBtn) {
      confirmBtn.addEventListener('click', function () {
        removeSubscription(index);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
