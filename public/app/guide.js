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

  function getSlugFromPath() {
    var path = (window.location.pathname || '').replace(/\/+$/, '');
    var match = path.match(/\/guides\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function findGuide(slug) {
    if (!slug) return null;
    var s = String(slug).toLowerCase();
    return GUIDES.filter(function (g) { return g.slug === s; })[0] || null;
  }

  function init() {
    var slug = getSlugFromPath();
    var guide = findGuide(slug);
    var titleEl = document.getElementById('guide-title');
    var categoryEl = document.getElementById('guide-category');
    var backEl = document.getElementById('guide-back');

    if (guide) {
      var title = 'How to share your ' + guide.name + ' subscription?';
      if (document.title !== undefined) document.title = title + ' – CostLyf';
      if (titleEl) titleEl.textContent = title;
      if (categoryEl) {
        categoryEl.textContent = guide.category;
        categoryEl.hidden = false;
      }
    } else {
      if (titleEl) titleEl.textContent = 'Guide not found';
      if (categoryEl) categoryEl.hidden = true;
    }
    if (backEl && !backEl.getAttribute('href')) backEl.setAttribute('href', '/guides');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
