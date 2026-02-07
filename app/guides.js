(function () {
  'use strict';

  var GUIDES = [
    { slug: 'netflix', name: 'Netflix', category: 'Movies & Series' },
    { slug: 'disney-plus', name: 'Disney+', category: 'Movies & Series' },
    { slug: 'viaplay', name: 'Viaplay', category: 'Movies & Series' },
    { slug: 'apple-tv-plus', name: 'Apple TV+', category: 'Movies & Series' },
    { slug: 'hulu', name: 'Hulu', category: 'Movies & Series' },
    { slug: 'hbo-max', name: 'HBO Max', category: 'Movies & Series' },
    { slug: 'amazon-prime', name: 'Amazon Prime', category: 'Movies & Series' },
    { slug: 'spotify', name: 'Spotify', category: 'Music' },
    { slug: 'deezer', name: 'Deezer', category: 'Music' },
    { slug: 'apple-music', name: 'Apple Music', category: 'Music' },
    { slug: 'youtube-premium', name: 'YouTube Premium', category: 'Music' },
    { slug: 'mozilla-vpn', name: 'Mozilla VPN', category: 'Security & VPN' },
    { slug: 'bitdefender', name: 'Bitdefender', category: 'Security & VPN' },
    { slug: 'purevpn', name: 'PureVPN', category: 'Security & VPN' },
    { slug: 'nordvpn', name: 'NordVPN', category: 'Security & VPN' },
    { slug: 'icloud', name: 'iCloud', category: 'Cloud' },
    { slug: 'google-one', name: 'Google One', category: 'Cloud' },
    { slug: 'apple-one', name: 'Apple One', category: 'Cloud' },
    { slug: 'duolingo', name: 'Duolingo', category: 'Education' },
    { slug: 'microsoft-365', name: 'Microsoft 365', category: 'Education' },
    { slug: 'gemini-2', name: 'Gemini 2', category: 'Education' },
    { slug: 'snapchat-plus', name: 'Snapchat+', category: 'Education' },
    { slug: 'uber-one', name: 'Uber One', category: 'Education' },
    { slug: 'delfi', name: 'Delfi', category: 'Education' }
  ];

  var currentCategory = 'all';
  var searchQuery = '';

  function escapeHtml(str) {
    if (!str) return '';
    var s = String(str);
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function cardTitle(guide) {
    return 'How to share your ' + guide.name + ' subscription?';
  }

  function renderCards() {
    var grid = document.getElementById('guides-grid');
    var emptyEl = document.getElementById('guides-empty');
    if (!grid) return;

    var q = (searchQuery || '').toLowerCase().trim();
    var filtered = GUIDES.filter(function (g) {
      if (currentCategory !== 'all' && g.category !== currentCategory) return false;
      if (q && g.name.toLowerCase().indexOf(q) === -1 && g.category.toLowerCase().indexOf(q) === -1) return false;
      return true;
    });

    var readLabel = (typeof window !== 'undefined' && window.i18n && window.i18n.t) ? window.i18n.t('guides.readArticle') : 'Read the article';
    grid.innerHTML = filtered.map(function (g) {
      var title = cardTitle(g);
      return (
        '<article class="guide-card" role="listitem">' +
          '<span class="guide-card-tag">' + escapeHtml(g.category) + '</span>' +
          '<h2 class="guide-card-title">' + escapeHtml(title) + '</h2>' +
          '<a href="/guides/' + encodeURIComponent(g.slug) + '" class="guide-card-cta">' + escapeHtml(readLabel) + '</a>' +
        '</article>'
      );
    }).join('');

    if (emptyEl) {
      emptyEl.hidden = filtered.length > 0;
      emptyEl.textContent = (typeof window !== 'undefined' && window.i18n && window.i18n.t) ? window.i18n.t('guides.noResults') : 'No guides match your search.';
    }
  }

  function init() {
    var searchEl = document.getElementById('guides-search');
    var pills = document.querySelectorAll('.guides-cat-pill');

    document.addEventListener('i18n:ready', function () { renderCards(); });

    if (searchEl) {
      searchEl.addEventListener('input', function () {
        searchQuery = searchEl.value || '';
        renderCards();
      });
    }

    pills.forEach(function (btn) {
      btn.addEventListener('click', function () {
        currentCategory = btn.getAttribute('data-category') || 'all';
        pills.forEach(function (b) { b.classList.remove('guides-cat-pill--active'); });
        btn.classList.add('guides-cat-pill--active');
        renderCards();
      });
    });

    renderCards();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
