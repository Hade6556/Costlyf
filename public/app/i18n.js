/**
 * Landing page i18n: load messages and apply to [data-i18n] elements.
 */
(function () {
  'use strict';

  function get(obj, key) {
    if (!key || !obj) return undefined;
    var parts = String(key).split('.');
    for (var i = 0; i < parts.length; i++) {
      if (obj == null) return undefined;
      obj = obj[parts[i]];
    }
    return obj;
  }

  function apply(messages) {
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute('data-i18n');
      var value = get(messages, key);
      if (value != null) {
        value = String(value).replace(/\\n/g, '\n');
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          el.placeholder = value;
        } else {
          el.textContent = value;
        }
      }
    }
  }

  function run() {
    var locale = (typeof localStorage !== 'undefined' && localStorage.getItem('costlyf_locale')) || 'en';
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/messages/' + locale + '.json', true);
    xhr.onload = function () {
      if (xhr.status === 200) {
        try {
          var messages = JSON.parse(xhr.responseText);
          apply(messages);
        } catch (e) {}
      }
    };
    xhr.onerror = function () {};
    xhr.send();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
