(function () {
  'use strict';

  var acceptBlock = document.getElementById('charter-accept-block');
  var alreadyEl = document.getElementById('charter-already');
  var checkbox = document.getElementById('charter-accept-checkbox');
  var acceptBtn = document.getElementById('charter-accept-btn');
  var errorEl = document.getElementById('charter-error');
  var backLink = document.getElementById('charter-back');

  var TOKEN_KEY = 'costlyf_access_token';
  function getToken() {
    if (typeof window !== 'undefined' && window.Auth && window.Auth.getToken) return window.Auth.getToken();
    try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }

  function getReturnUrl(afterAccept) {
    var params = new URLSearchParams(window.location.search);
    var from = params.get('from');
    var id = params.get('id');
    if (from === 'offer') {
      var offerUrl = '/offer';
      if (id) offerUrl += '?id=' + encodeURIComponent(id);
      return offerUrl;
    }
    if (from === 'share') {
      var service = params.get('service');
      var serviceName = params.get('serviceName');
      var shareUrl = '/share';
      var sep = '?';
      if (afterAccept) { shareUrl += '?charter=accepted'; sep = '&'; }
      if (service) { shareUrl += sep + 'service=' + encodeURIComponent(service); sep = '&'; }
      if (serviceName) shareUrl += sep + 'serviceName=' + encodeURIComponent(serviceName);
      return shareUrl;
    }
    return '/home';
  }

  function setBackLink() {
    if (backLink) backLink.href = getReturnUrl(false);
  }

  function showError(msg) {
    if (errorEl) {
      errorEl.textContent = msg || '';
      errorEl.style.display = msg ? 'block' : 'none';
    }
  }

  function init() {
    setBackLink();
    if (checkbox) {
      checkbox.addEventListener('change', function () {
        if (acceptBtn) acceptBtn.disabled = !checkbox.checked;
        showError('');
      });
    }
    if (acceptBtn) {
      acceptBtn.addEventListener('click', function () {
        if (!checkbox || !checkbox.checked) return;
        var token = getToken();
        if (!token) {
          showError('Please log in to accept the charter.');
          return;
        }
        acceptBtn.disabled = true;
        showError('');
        var profileOpts = { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ charter_accepted_at: new Date().toISOString() }) };
        var profileFetch = (window.Auth && window.Auth.fetchWithAuth) ? window.Auth.fetchWithAuth.bind(window.Auth) : fetch;
        profileFetch('/api/profile', profileOpts)
          .then(function (r) {
            if (!r.ok) throw new Error(r.statusText || 'Update failed');
            return r.json();
          })
          .then(function () {
            var url = getReturnUrl(true);
            if (url.indexOf('/offer') !== -1) url += (url.indexOf('?') !== -1 ? '&' : '?') + 'charter=accepted';
            window.location.href = url;
          })
          .catch(function (err) {
            showError(err.message || 'Could not save. Try again.');
            acceptBtn.disabled = false;
          });
      });
    }

    // If logged in, check current charter status
    var token = getToken();
    if (token) {
      var meOpts = { headers: { 'Authorization': 'Bearer ' + token } };
      var meFetch = (window.Auth && window.Auth.fetchWithAuth) ? window.Auth.fetchWithAuth.bind(window.Auth) : fetch;
      meFetch('/api/auth/me', meOpts)
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (data && data.profile && data.profile.charter_accepted_at) {
            if (acceptBlock) acceptBlock.hidden = true;
            if (alreadyEl) alreadyEl.hidden = false;
          }
        })
        .catch(function () {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
