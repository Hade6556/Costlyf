(function () {
  'use strict';

  var TOKEN_KEY = 'costlyf_access_token';
  var REFRESH_KEY = 'costlyf_refresh_token';
  var path = typeof window !== 'undefined' && window.location ? window.location.pathname : '';
  if (path && path !== '/login' && path !== '/signup') {
    try {
      var hasToken = !!localStorage.getItem(TOKEN_KEY);
      var hasRefresh = !!localStorage.getItem(REFRESH_KEY);
      if (!hasToken && !hasRefresh) {
        var redirect = (path !== '/' ? '?redirect=' + encodeURIComponent(path + (window.location.search || '')) : '');
        window.location.replace('/login' + redirect);
        return;
      }
    } catch (e) {}
  }

  window.hideAppLoading = function () {};

  var HERO_AVATAR_COLORS = ['#a8e6cf', '#d4b5ff', '#a8d4f0', '#fff4b8', '#ffc8d4'];

  function getDefaultHeroIndex(userId) {
    if (!userId) return 1;
    var h = 0;
    var s = String(userId);
    for (var i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
    return (Math.abs(h) % 5) + 1;
  }

  function renderSidebarAvatar(containerEl, avatarUrl, userId) {
    if (!containerEl) return;
    var sizePx = 36;
    if (avatarUrl) {
      containerEl.className = 'sidebar-user-avatar sidebar-user-avatar--photo';
      containerEl.innerHTML = '<img src="' + avatarUrl.replace(/"/g, '&quot;') + '" alt="">';
    } else {
      var heroIndex = getDefaultHeroIndex(userId);
      var color = HERO_AVATAR_COLORS[heroIndex - 1] || HERO_AVATAR_COLORS[0];
      var heroSrc = '/media/hero-profiles/' + heroIndex + '.png';
      containerEl.className = 'sidebar-user-avatar sidebar-user-avatar--default';
      containerEl.innerHTML = '<span class="profile-avatar-circle" style="--circle-color:' + color + '"><img src="' + heroSrc + '" alt=""></span>';
    }
  }

  var navAvatarEl = document.getElementById('sidebar-nav-avatar');
  if (navAvatarEl) {
    var token = typeof window !== 'undefined' && window.Auth && window.Auth.getToken ? window.Auth.getToken() : (typeof localStorage !== 'undefined' ? localStorage.getItem('costlyf_access_token') : null);
    if (token) {
      var doFetch = (window.Auth && window.Auth.fetchWithAuth) ? function () { return window.Auth.fetchWithAuth('/api/auth/me', {}); } : function () { return fetch('/api/auth/me', { headers: { 'Authorization': 'Bearer ' + token } }); };
      doFetch()
        .then(function (r) { return r.status === 401 ? null : r.json(); })
        .then(function (data) {
          if (!data) { renderSidebarAvatar(navAvatarEl, '', null); return; }
          var avatarUrl = (data.profile && data.profile.avatar_url) ? data.profile.avatar_url : '';
          var userId = (data.user && data.user.id) ? data.user.id : null;
          renderSidebarAvatar(navAvatarEl, avatarUrl, userId);
        })
        .catch(function () { renderSidebarAvatar(navAvatarEl, '', null); });
    } else {
      renderSidebarAvatar(navAvatarEl, '', null);
    }
  }

  var sidebar = document.querySelector('.sidebar');
  var sidebarToggle = document.querySelector('.sidebar-toggle');
  if (sidebar && sidebarToggle) {
    sidebarToggle.addEventListener('click', function () {
      sidebar.classList.toggle('sidebar--collapsed');
    });
  }

  var pills = document.querySelectorAll('.filter-pill');
  var sections = document.querySelectorAll('.category-section');

  function setFilter(filter) {
    pills.forEach(function (pill) {
      var isActive = pill.getAttribute('data-filter') === filter;
      pill.classList.toggle('filter-pill--active', isActive);
    });

    sections.forEach(function (section) {
      var category = section.getAttribute('data-category');
      var show = filter === 'all' || category === filter;
      section.classList.toggle('category-section--hidden', !show);
    });
  }

  pills.forEach(function (pill) {
    pill.addEventListener('click', function () {
      setFilter(pill.getAttribute('data-filter'));
    });
  });

  var SCROLL_STEP = 180;
  document.querySelectorAll('.card-carousel').forEach(function (carousel) {
    var scrollEl = carousel.querySelector('.card-scroll');
    var prevBtn = carousel.querySelector('.carousel-btn--prev');
    var nextBtn = carousel.querySelector('.carousel-btn--next');
    if (!scrollEl) return;
    if (prevBtn) {
      prevBtn.addEventListener('click', function () {
        scrollEl.scrollBy({ left: -SCROLL_STEP, behavior: 'smooth' });
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        scrollEl.scrollBy({ left: SCROLL_STEP, behavior: 'smooth' });
      });
    }
  });
})();
