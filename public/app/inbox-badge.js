(function () {
  'use strict';
  function getToken() {
    try {
      if (typeof window !== 'undefined' && window.Auth && window.Auth.getToken) return window.Auth.getToken();
      return localStorage.getItem('costlyf_access_token');
    } catch (e) { return null; }
  }
  function updateBadges() {
    var token = getToken();
    if (!token) {
      document.querySelectorAll('.inbox-unread-badge').forEach(function (el) { el.hidden = true; });
      return;
    }
    fetch('/api/chat/unread-count', { headers: { Authorization: 'Bearer ' + token } })
      .then(function (r) { return r.ok ? r.json() : { count: 0 }; })
      .catch(function () { return { count: 0 }; })
      .then(function (data) {
        var n = (data && typeof data.count === 'number') ? data.count : 0;
        document.querySelectorAll('.inbox-unread-badge').forEach(function (el) {
          if (n === 0) {
            el.hidden = true;
            el.textContent = '';
          } else {
            el.textContent = n > 99 ? '99+' : String(n);
            el.hidden = false;
          }
        });
      });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateBadges);
  } else {
    updateBadges();
  }
  window.updateInboxUnreadBadge = updateBadges;
})();
