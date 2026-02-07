(function () {
  'use strict';

  // English only: no locale in URL, no language selector
  window.__LOCALE__ = 'en';
  window.__PATH_WITHOUT_LOCALE__ = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname || '/' : '/';

  var messages = {};
  var ready = null;

  function get(obj, key) {
    var parts = key.split('.');
    for (var i = 0; i < parts.length; i++) {
      if (obj == null) return undefined;
      obj = obj[parts[i]];
    }
    return obj;
  }

  function t(key) {
    var value = get(messages, key);
    return value != null ? String(value) : key;
  }

  function loadMessages(cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/messages/en.json', true);
    xhr.onload = function () {
      if (xhr.status === 200) {
        try {
          messages = JSON.parse(xhr.responseText);
        } catch (e) {
          messages = {};
        }
      }
      if (typeof cb === 'function') cb();
    };
    xhr.onerror = function () { if (typeof cb === 'function') cb(); };
    xhr.send();
  }

  function applyTranslations() {
    document.documentElement.lang = 'en';
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
      var attr = el.getAttribute('data-i18n-attr');
      if (attr && key) el.setAttribute(attr, t(key));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-placeholder');
      if (key) el.placeholder = t(key);
    });
  }

  function init(cb) {
    loadMessages(function () {
      applyTranslations();
      ready = true;
      try { document.dispatchEvent(new CustomEvent('i18n:ready')); } catch (e) {}
      if (typeof cb === 'function') cb();
    });
  }

  window.i18n = {
    t: t,
    locale: function () { return 'en'; },
    pathWithoutLocale: function () { return window.__PATH_WITHOUT_LOCALE__ || '/'; },
    ready: function () { return ready; },
    init: init,
    LOCALES: ['en'],
    LOCALE_NAMES: { en: 'English' }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); });
  } else {
    init();
  }
})();
