(function () {
  'use strict';

  var LOCALES = ['en', 'lt', 'lv', 'pl', 'es', 'de'];
  var LOCALE_NAMES = {
    en: 'English',
    lt: 'Lietuvių',
    lv: 'Latviešu',
    pl: 'Polski',
    es: 'Español',
    de: 'Deutsch'
  };
  var FLAG_SVGS = {
    en: '<svg width="20" height="14" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="20" height="14" fill="#012169"/><path d="M0 0l20 14M20 0L0 14" stroke="#fff" stroke-width="2"/><path d="M0 0l20 14M20 0L0 14" stroke="#C8102E" stroke-width="1.2"/><path d="M10 0v14M0 7h20" stroke="#fff" stroke-width="3.2"/><path d="M10 0v14M0 7h20" stroke="#C8102E" stroke-width="2"/></svg>',
    lt: '<svg width="20" height="14" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg"><rect y="0" width="20" height="4.67" fill="#FDB913"/><rect y="4.67" width="20" height="4.67" fill="#006A44"/><rect y="9.33" width="20" height="4.67" fill="#C1272D"/></svg>',
    lv: '<svg width="20" height="14" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="20" height="14" fill="#981E32"/><rect x="6.67" width="6.66" height="14" fill="#fff"/></svg>',
    pl: '<svg width="20" height="14" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="20" height="14" fill="#fff"/><rect y="7" width="20" height="7" fill="#DC143C"/></svg>',
    es: '<svg width="20" height="14" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="20" height="14" fill="#AA151B"/><rect y="3.5" width="20" height="7" fill="#F1BF00"/></svg>',
    de: '<svg width="20" height="14" viewBox="0 0 20 14" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="20" height="14" fill="#000"/><rect y="4.67" width="20" height="4.67" fill="#DD0000"/><rect y="9.33" width="20" height="4.67" fill="#FFCE00"/></svg>'
  };
  var COOKIE_NAME = 'NEXT_LOCALE';
  var COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
  var INTERNAL_PATHS = ['', 'home', 'join', 'share', 'wallet', 'offer', 'profile', 'subscription', 'help', 'guides', 'terms', 'privacy', 'legal', 'charter', 'inbox', 'login', 'signup'];

  function getLocaleFromPathname() {
    var pathname = window.location.pathname || '/';
    var segments = pathname.replace(/^\/+|\/+$/g, '').split('/');
    var first = segments[0];
    if (first && LOCALES.indexOf(first) >= 0) return { locale: first, pathWithoutLocale: '/' + segments.slice(1).join('/') };
    return { locale: 'en', pathWithoutLocale: pathname };
  }

  function setCookie(locale) {
    document.cookie = COOKIE_NAME + '=' + encodeURIComponent(locale) + '; path=/; max-age=' + COOKIE_MAX_AGE + '; SameSite=Lax';
  }

  var state = getLocaleFromPathname();
  window.__LOCALE__ = state.locale;
  window.__PATH_WITHOUT_LOCALE__ = state.pathWithoutLocale || '/';

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

  function loadMessages(locale, cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/messages/' + encodeURIComponent(locale) + '.json', true);
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
    var locale = window.__LOCALE__;
    document.documentElement.lang = locale;
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

  function rewriteInternalLinks() {
    var locale = window.__LOCALE__;
    document.querySelectorAll('a[href^="/"]').forEach(function (a) {
      var href = a.getAttribute('href');
      if (!href || href.indexOf('//') === 0) return;
      var path = href.split('?')[0].replace(/\/+$/, '') || '/';
      var pathSegments = path.replace(/^\/+/, '').split('/');
      var first = pathSegments[0];
      if (LOCALES.indexOf(first) >= 0) return;
      var isInternal = path === '/' || INTERNAL_PATHS.indexOf(pathSegments[0]) >= 0 ||
        (pathSegments[0] === 'guides' && pathSegments.length >= 1) ||
        (pathSegments[0] === 'join' && pathSegments.length >= 1);
      if (isInternal) a.setAttribute('href', '/' + locale + (path === '/' ? '' : path) + (href.indexOf('?') >= 0 ? href.slice(href.indexOf('?')) : ''));
    });
  }

  function renderLanguageSelector(container) {
    if (!container) return;
    var locale = window.__LOCALE__;
    var pathWithoutLocale = window.__PATH_WITHOUT_LOCALE__ || '/';
    var wrapper = document.createElement('div');
    wrapper.className = 'i18n-lang';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'i18n-lang-btn';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-label', 'Language');
    btn.setAttribute('aria-expanded', 'false');
    var flagSpan = document.createElement('span');
    flagSpan.className = 'i18n-lang-flag';
    flagSpan.innerHTML = FLAG_SVGS[locale] || '';
    var nameSpan = document.createElement('span');
    nameSpan.textContent = LOCALE_NAMES[locale] || locale;
    var chevron = document.createElement('svg');
    chevron.className = 'i18n-lang-chevron';
    chevron.setAttribute('width', '16');
    chevron.setAttribute('height', '16');
    chevron.setAttribute('viewBox', '0 0 24 24');
    chevron.setAttribute('fill', 'none');
    var poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', '6,9 18,9 12,15');
    poly.setAttribute('fill', '#6e6e73');
    chevron.appendChild(poly);
    btn.appendChild(flagSpan);
    btn.appendChild(nameSpan);
    btn.appendChild(chevron);
    var dropdown = document.createElement('div');
    dropdown.className = 'i18n-lang-dropdown';
    dropdown.setAttribute('role', 'listbox');
    dropdown.hidden = true;
    LOCALES.forEach(function (loc) {
      var opt = document.createElement('button');
      opt.type = 'button';
      opt.role = 'option';
      opt.className = 'i18n-lang-option' + (loc === locale ? ' i18n-lang-option--active' : '');
      opt.dataset.locale = loc;
      var f = document.createElement('span');
      f.className = 'i18n-lang-flag';
      f.innerHTML = FLAG_SVGS[loc] || '';
      var n = document.createElement('span');
      n.textContent = LOCALE_NAMES[loc] || loc;
      opt.appendChild(f);
      opt.appendChild(n);
      dropdown.appendChild(opt);
    });
    wrapper.appendChild(btn);
    wrapper.appendChild(dropdown);
    container.innerHTML = '';
    container.appendChild(wrapper);

    function go(loc) {
      setCookie(loc);
      var target = '/' + loc + (pathWithoutLocale === '/' ? '' : pathWithoutLocale);
      window.location.href = target;
    }

    function close() {
      dropdown.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
      wrapper.classList.remove('i18n-lang--open');
      document.removeEventListener('click', close);
    }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !dropdown.hidden;
      if (open) { close(); return; }
      dropdown.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
      wrapper.classList.add('i18n-lang--open');
      setTimeout(function () { document.addEventListener('click', close); }, 0);
    });

    dropdown.querySelectorAll('.i18n-lang-option').forEach(function (opt) {
      opt.addEventListener('click', function (e) {
        e.stopPropagation();
        go(opt.dataset.locale);
      });
    });
  }

  function init(cb) {
    loadMessages(window.__LOCALE__, function () {
      applyTranslations();
      rewriteInternalLinks();
      document.querySelectorAll('#i18n-language-selector, .i18n-language-selector').forEach(function (sel) {
        renderLanguageSelector(sel);
      });
      ready = true;
      try { document.dispatchEvent(new CustomEvent('i18n:ready')); } catch (e) {}
      if (typeof cb === 'function') cb();
    });
  }

  window.i18n = {
    t: t,
    locale: function () { return window.__LOCALE__; },
    pathWithoutLocale: function () { return window.__PATH_WITHOUT_LOCALE__; },
    ready: function () { return ready; },
    init: init,
    LOCALE_NAMES: LOCALE_NAMES,
    LOCALES: LOCALES
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { init(); });
  } else {
    init();
  }
})();
