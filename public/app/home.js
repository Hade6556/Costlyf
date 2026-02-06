(function () {
  'use strict';

  var logoMap = {
    youtube: '/media/brand-logos/youtube.svg',
    'youtube-premium': '/media/brand-logos/youtube.svg',
    spotify: '/media/brand-logos/spotify.svg',
    netflix: '/media/brand-logos/netflix.svg',
    disney: '/media/brand-logos/netflix.svg',
    duolingo: '/media/brand-logos/deezer.svg'
  };

  function fetchWithAuth(url, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    var token = (window.Auth && window.Auth.getToken) ? window.Auth.getToken() : localStorage.getItem('costlyf_access_token');
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    return (window.Auth && window.Auth.fetchWithAuth) ? window.Auth.fetchWithAuth(url, opts) : fetch(url, opts);
  }

  function renderOffers(offers) {
    var section = document.getElementById('my-offers-section');
    var list = document.getElementById('my-offers-list');
    if (!section || !list) return;
    offers = offers || [];
    if (offers.length === 0) {
      section.style.display = 'none';
      return;
    }
    section.style.display = 'block';
    list.innerHTML = offers.map(function (offer) {
      var logo = logoMap[offer.service] || '/media/logo.svg';
      var filled = offer.seats_taken || 0;
      var total = offer.max_slots || 1;
      var slotsHtml = '';
      for (var i = 0; i < total; i++) {
        slotsHtml += '<span class="my-offer-slot' + (i < filled ? ' my-offer-slot--filled' : '') + '" aria-hidden="true">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="' + (i < filled ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span>';
      }
      var visLabel = (offer.visibility || 'private') === 'public' ? 'Public' : 'Private';
      var visIcon = (offer.visibility || 'private') === 'public'
        ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'
        : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
      return (
        '<a href="/offer?id=' + encodeURIComponent(offer.id) + '" class="my-offer-card">' +
          '<img src="' + logo + '" alt="" class="my-offer-logo">' +
          '<div class="my-offer-info">' +
            '<span class="my-offer-name">' + (offer.service_name || offer.service || 'Offer') + '</span>' +
            '<div class="my-offer-slots">' + slotsHtml + '</div>' +
          '</div>' +
          '<span class="my-offer-tag">' + visLabel + ' ' + visIcon + '</span>' +
          '<span class="my-offer-chevron">›</span>' +
        '</a>'
      );
    }).join('');
  }

  function getDaysLeftInMonth() {
    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth();
    var lastDay = new Date(year, month + 1, 0).getDate();
    var today = now.getDate();
    return Math.max(0, lastDay - today);
  }

  function getDaysInMonth() {
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  }

  function getMonthProgressColor(fractionLeft) {
    var hue = Math.round(120 * fractionLeft);
    return 'hsl(' + hue + ', 65%, 42%)';
  }

  function renderSubscriptions(joined) {
    var section = document.getElementById('my-subscriptions-section');
    var list = document.getElementById('my-subscriptions-list');
    if (!section || !list) return;
    joined = joined || [];
    if (joined.length === 0) {
      section.style.display = 'block';
      list.innerHTML = '<p class="my-offers-empty">No subscriptions yet.</p>';
      return;
    }
    section.style.display = 'block';
    var circumference = 2 * Math.PI * 18;
    var maxDays = 30;

    list.innerHTML = joined.map(function (sub) {
      var logo = logoMap[sub.service] || '/media/logo.svg';
      var daysLeft = typeof sub.days_left === 'number' ? Math.max(0, sub.days_left) : 0;
      var isTaken = sub.my_slot_status === 'taken';
      var statusLine = isTaken ? 'Active · ' + daysLeft + ' days left' : 'Pending';
      var fractionLeft = maxDays > 0 ? Math.min(1, daysLeft / maxDays) : 0;
      var progressColor = getMonthProgressColor(fractionLeft);
      var strokeDash = circumference * fractionLeft;
      return (
        '<a href="/offer?id=' + encodeURIComponent(sub.id) + '" class="my-offer-card">' +
          '<img src="' + logo + '" alt="" class="my-offer-logo">' +
          '<div class="my-offer-info">' +
            '<span class="my-offer-name">' + (sub.service_name || sub.service || 'Subscription') + '</span>' +
            '<span class="my-sub-status">' + statusLine + '</span>' +
          '</div>' +
          '<div class="my-sub-days" aria-label="' + daysLeft + ' days left">' +
            '<div class="my-sub-days-wheel" style="--sub-progress-color:' + progressColor + ';--sub-stroke-dash:' + strokeDash + ';--sub-stroke-circumference:' + circumference + '">' +
              '<svg class="my-sub-days-svg" viewBox="0 0 40 40" aria-hidden="true">' +
                '<circle class="my-sub-days-bg" cx="20" cy="20" r="18" fill="none" stroke-width="3"/>' +
                '<circle class="my-sub-days-fill" cx="20" cy="20" r="18" fill="none" stroke-width="3" stroke="var(--sub-progress-color)" stroke-dasharray="' + strokeDash + ' ' + circumference + '" stroke-dashoffset="0" transform="rotate(-90 20 20)"/>' +
              '</svg>' +
              '<span class="my-sub-days-num" style="color:var(--sub-progress-color)">' + daysLeft + '</span>' +
            '</div>' +
          '</div>' +
          '<span class="my-offer-chevron">›</span>' +
        '</a>'
      );
    }).join('');
  }

  var homeLoaded = { offers: false, subs: false };
  function homeMaybeHideLoading() {
    if (homeLoaded.offers && homeLoaded.subs && window.hideAppLoading) window.hideAppLoading();
  }
  fetchWithAuth('/api/offers/mine')
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (data) { renderOffers(Array.isArray(data) ? data : []); })
    .catch(function () { renderOffers([]); })
    .then(function () { homeLoaded.offers = true; homeMaybeHideLoading(); });
  fetchWithAuth('/api/offers/joined')
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (data) { renderSubscriptions(Array.isArray(data) ? data : []); })
    .catch(function () { renderSubscriptions([]); })
    .then(function () { homeLoaded.subs = true; homeMaybeHideLoading(); });
})();
