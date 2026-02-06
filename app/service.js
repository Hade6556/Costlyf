(function () {
  'use strict';

  var serviceSlug = (function () {
    var path = window.location.pathname;
    var match = path.match(/\/join\/([^/]+)/);
    return match ? match[1] : 'netflix';
  })();

  var serviceNames = {
    netflix: 'Netflix',
    'youtube-premium': 'YouTube Premium',
    spotify: 'Spotify',
    disney: 'Disney+',
    crunchyroll: 'Crunchyroll',
    'prime-video': 'Prime Video'
  };

  var serviceDescriptions = {
    netflix: 'Watch Netflix films & TV series online or stream right to your smart TV, game console, PC, Mac, mobile, tablet and more.',
    'youtube-premium': 'Enjoy ad-free videos, background play, and YouTube Music with a Premium membership.',
    spotify: 'Listen to millions of songs, podcasts, and playlists with Spotify. Stream anywhere, anytime.',
    disney: 'Stream Disney, Pixar, Marvel, Star Wars and National Geographic. One subscription for your whole family.',
    crunchyroll: 'Watch the latest anime and read manga. Thousands of episodes and series available.',
    'prime-video': 'Watch movies and TV series with Prime Video. Included with Prime or standalone.'
  };

  var name = serviceNames[serviceSlug] || serviceSlug.replace(/-/g, ' ');
  var desc = serviceDescriptions[serviceSlug] || 'Find co-subscribers and save on your subscription.';

  document.title = 'CostLyf – ' + name;

  var titleEl = document.getElementById('service-title');
  if (titleEl) titleEl.textContent = name;

  var descEl = document.getElementById('service-desc');
  if (descEl) descEl.textContent = desc;

  var filterTitle = document.getElementById('service-title-filter');
  if (filterTitle) filterTitle.textContent = name;

  var ownerTitle = document.getElementById('service-title-owner');
  if (ownerTitle) ownerTitle.textContent = name;

  var shareTitle = document.getElementById('service-title-share');
  if (shareTitle) shareTitle.textContent = name;

  var shareBtn = document.getElementById('service-share-btn');
  if (shareBtn) shareBtn.href = '/share?service=' + encodeURIComponent(serviceSlug);

  // Filters and sort state
  var filterState = {
    plan: 'all',
    verified: false,
    instant: false,
    sortBy: 'trust'
  };

  var offersListEl = document.getElementById('service-offers-list');
  var offersLoadingEl = document.getElementById('service-offers-loading');
  var offersEmptyEl = document.getElementById('service-offers-empty');
  var planPills = document.querySelectorAll('.service-plan-pill');
  var filterVerified = document.getElementById('filter-verified');
  var filterInstant = document.getElementById('filter-instant');
  var sortItems = document.querySelectorAll('.service-sort-item');

  var allOffers = [];
  var joinedOfferIds = new Set();
  var currentUserId = null;

  function escapeHtml(str) {
    if (!str) return '';
    var s = String(str);
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function trustRingClass(trust) {
    var t = Math.min(10, Math.max(0, parseInt(trust, 10) || 0));
    return 'service-offer-trust-ring--' + t;
  }

  function renderOffersList(offers) {
    if (!offersListEl) return;
    var filtered = offers.filter(function (o) {
      var plan = (o.plan || 'premium').toLowerCase();
      if (filterState.plan !== 'all' && plan !== filterState.plan) return false;
      if (filterState.verified && !o.verified) return false;
      if (filterState.instant && !o.instant) return false;
      return true;
    });
    filtered.sort(function (a, b) {
      if (filterState.sortBy === 'trust') return (b.trust_score || 0) - (a.trust_score || 0);
      if (filterState.sortBy === 'price') return (a.contribution_per_month || 0) - (b.contribution_per_month || 0);
      return 0;
    });

    if (offersLoadingEl) offersLoadingEl.hidden = true;
    if (offersEmptyEl) offersEmptyEl.hidden = filtered.length > 0;

    var priceStr = function (o) {
      var c = o.contribution_per_month;
      return (c == null || c === 0) ? '0' : (typeof c === 'number' ? c.toFixed(2) : String(c));
    };
    var html = filtered.map(function (o) {
      var plan = (o.plan || 'premium').toLowerCase();
      var trust = o.trust_score != null ? o.trust_score : 0;
      var trustDisplay = (trust > 0) ? String(trust) : '—';
      var trustRing = trust > 0 ? trustRingClass(trust) : '';
      var displayName = o.owner_name || 'Host';
      var avatarSrc = (o.owner_avatar_url && o.owner_avatar_url.trim()) ? o.owner_avatar_url : '/media/hero-profiles/1.png';
      var badges = '';
      if (o.verified) badges += '<span class="service-offer-badge service-offer-badge--verified"><img src="/media/icons/ic--round-verified.svg" alt="" width="12" height="12" class="service-offer-badge-icon"> VERIFIED SUBSCRIPTION</span>';
      if (o.instant) badges += ' <span class="service-offer-badge service-offer-badge--instant"><img src="/media/icons/ic--round-bolt.svg" alt="" width="12" height="12" class="service-offer-badge-icon"> Instant</span>';
      var isOwner = currentUserId && o.owner_id === currentUserId;
      var isJoined = joinedOfferIds.has(o.id);
      var joinBtn;
      if (isOwner) {
        joinBtn = '<a href="/offer?id=' + encodeURIComponent(o.id || '') + '" class="service-offer-join service-offer-join--manage">Manage</a>';
      } else {
        var joinBtnClass = 'service-offer-join' + (isJoined ? ' service-offer-join--joined' : '');
        var joinBtnLabel = isJoined ? 'Joined' : 'Join';
        joinBtn = '<button type="button" class="' + joinBtnClass + '"' + (isJoined ? ' disabled aria-disabled="true"' : '') + '>' + joinBtnLabel + '</button>';
      }
      return (
        '<article class="service-offer-card" data-offer-id="' + (o.id || '') + '" data-plan="' + plan + '" data-verified="' + (o.verified ? 'true' : 'false') + '" data-instant="' + (o.instant ? 'true' : 'false') + '" data-trust="' + trust + '" data-price="' + (o.contribution_per_month || 0) + '">' +
          '<div class="service-offer-avatar-wrap ' + trustRing + '">' +
            '<div class="service-offer-avatar service-offer-avatar--img"><img src="' + avatarSrc + '" alt=""></div>' +
            '<span class="service-offer-trust">' + escapeHtml(trustDisplay) + '</span>' +
          '</div>' +
          '<div class="service-offer-body">' +
            '<p class="service-offer-text"><strong>' + escapeHtml(displayName) + '</strong> is sharing ' + (o.service_name || o.service) + ' ' + (o.plan || 'Premium') + ' <span class="service-tv-icon">[🚫TV]</span></p>' +
            '<div class="service-offer-badges">' + badges + '</div>' +
          '</div>' +
          '<div class="service-offer-right">' +
            '<span class="service-offer-price">' + priceStr(o) + '€ <span class="service-offer-period">/month</span></span>' +
            joinBtn +
          '</div>' +
        '</article>'
      );
    }).join('');
    offersListEl.innerHTML = html;

    offersListEl.querySelectorAll('.service-offer-join:not(.service-offer-join--joined):not(.service-offer-join--manage)').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.service-offer-card');
        var offerId = card && card.getAttribute('data-offer-id');
        if (offerId) openJoinOfferModal(offerId);
      });
    });
  }

  function applyFiltersAndSort() {
    renderOffersList(allOffers);
  }

  function loadJoinedOffers() {
    var token = (window.Auth && window.Auth.getToken) ? window.Auth.getToken() : (typeof localStorage !== 'undefined' ? localStorage.getItem('costlyf_access_token') : null);
    if (!token) {
      renderOffersList(allOffers);
      if (window.hideAppLoading) window.hideAppLoading();
      return;
    }
    var authHeaders = { headers: { Authorization: 'Bearer ' + token } };
    var fetchAuth = (window.Auth && window.Auth.fetchWithAuth) ? function (url) { return window.Auth.fetchWithAuth(url, {}); } : function (url) { return fetch(url, authHeaders); };
    Promise.all([
      fetchAuth('/api/auth/me').then(function (r) { return r.ok ? r.json() : null; }).then(function (data) { return data && data.user && data.user.id ? data.user.id : null; }),
      fetchAuth('/api/offers/joined').then(function (r) { return r.ok ? r.json() : []; })
    ])
      .then(function (results) {
        currentUserId = results[0] || null;
        joinedOfferIds = new Set((Array.isArray(results[1]) ? results[1] : []).map(function (j) { return j.id; }));
        renderOffersList(allOffers);
        if (window.hideAppLoading) window.hideAppLoading();
      })
      .catch(function () {
        currentUserId = null;
        joinedOfferIds = new Set();
        renderOffersList(allOffers);
        if (window.hideAppLoading) window.hideAppLoading();
      });
  }

  fetch('/api/offers?service=' + encodeURIComponent(serviceSlug) + '&minSeats=1')
    .then(function (r) { return r.ok ? r.json() : []; })
    .then(function (data) {
      allOffers = Array.isArray(data) ? data : [];
      loadJoinedOffers();
    })
    .catch(function () {
      allOffers = [];
      if (offersLoadingEl) offersLoadingEl.hidden = true;
      if (offersEmptyEl) offersEmptyEl.hidden = false;
      if (offersListEl) offersListEl.innerHTML = '';
      if (window.hideAppLoading) window.hideAppLoading();
    });

  planPills.forEach(function (pill) {
    pill.addEventListener('click', function () {
      var plan = pill.getAttribute('data-plan-filter') || 'all';
      filterState.plan = plan;
      planPills.forEach(function (p) { p.classList.remove('service-plan-pill--active'); });
      pill.classList.add('service-plan-pill--active');
      applyFiltersAndSort();
    });
  });

  if (filterVerified) {
    filterVerified.addEventListener('change', function () {
      filterState.verified = filterVerified.checked;
      applyFiltersAndSort();
    });
  }
  if (filterInstant) {
    filterInstant.addEventListener('change', function () {
      filterState.instant = filterInstant.checked;
      applyFiltersAndSort();
    });
  }

  sortItems.forEach(function (item) {
    item.addEventListener('click', function () {
      var sort = item.getAttribute('data-sort') || 'trust';
      filterState.sortBy = sort;
      sortItems.forEach(function (s) { s.classList.remove('service-sort-item--active'); });
      item.classList.add('service-sort-item--active');
      applyFiltersAndSort();
    });
  });

  // Join offer modal (when pressing Join on an offer card)
  var overlay = document.getElementById('join-offer-overlay');
  var backdrop = document.getElementById('join-offer-backdrop');
  var serviceLogoMap = {
    netflix: '/media/brand-logos/netflix.svg',
    'youtube-premium': '/media/brand-logos/youtube.svg',
    spotify: '/media/brand-logos/spotify.svg',
    disney: '/media/brand-logos/disney.svg',
    crunchyroll: '/media/brand-logos/disney.svg',
    'prime-video': '/media/brand-logos/prime-video.svg'
  };

  var currentJoinOffer = null;

  function getToken() {
    if (typeof window !== 'undefined' && window.Auth && window.Auth.getToken) return window.Auth.getToken();
    try { return localStorage.getItem('costlyf_access_token'); } catch (e) { return null; }
  }
  function fetchWithAuth(url, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    var token = getToken();
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    return (window.Auth && window.Auth.fetchWithAuth) ? window.Auth.fetchWithAuth(url, opts) : fetch(url, opts);
  }

  function saveSubscriptionAndGoHome() {
    if (!currentJoinOffer || !currentJoinOffer.offerId || !currentJoinOffer.slotIndex) {
      closeJoinOfferModal();
      window.location.href = '/home';
      return;
    }
    var token = getToken();
    if (!token) {
      alert('Please log in to join an offer.');
      return;
    }
    var url = '/api/offers/' + encodeURIComponent(currentJoinOffer.offerId) + '/slots/' + currentJoinOffer.slotIndex + '/reserve';
    fetchWithAuth(url, { method: 'POST' })
      .then(function (r) {
        if (r.ok) {
          closeJoinOfferModal();
          window.location.href = '/offer?id=' + encodeURIComponent(currentJoinOffer.offerId);
          return;
        }
        return r.json().then(function (d) { throw new Error(d.error || 'Could not reserve slot'); });
      })
      .catch(function (e) {
        alert(e.message || 'Could not join. Try again.');
      });
  }

  function openJoinOfferModal(offerId) {
    var token = getToken();
    if (!token) {
      alert('Please log in to join an offer.');
      return;
    }
    fetchWithAuth('/api/offers/' + encodeURIComponent(offerId), {})
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (offer) {
        if (!offer) {
          alert('Offer not found.');
          return;
        }
        var slots = offer.slots || [];
        var available = slots.filter(function (s) { return s.status === 'available'; });
        if (available.length === 0) {
          alert('No seats left for this offer.');
          return;
        }
        var slotIndex = available[0].slot_index;
        var price = (offer.contribution_per_month != null && offer.contribution_per_month > 0)
          ? offer.contribution_per_month.toFixed(2) + '€'
          : '0€';

        var ownerName = offer.owner_name || 'Host';
        var ownerAvatar = (offer.owner_avatar_url && offer.owner_avatar_url.trim()) ? offer.owner_avatar_url : '/media/hero-profiles/2.png';
        var trustScore = offer.trust_score != null ? offer.trust_score : 0;
        var scoreDisplay = (trustScore > 0) ? String(trustScore) : '—';

        var wrapEl = document.getElementById('join-offer-avatar-wrap');
        if (wrapEl) {
          wrapEl.classList.remove('service-offer-trust-ring--1', 'service-offer-trust-ring--2', 'service-offer-trust-ring--3', 'service-offer-trust-ring--4', 'service-offer-trust-ring--5', 'service-offer-trust-ring--6', 'service-offer-trust-ring--7', 'service-offer-trust-ring--8', 'service-offer-trust-ring--9', 'service-offer-trust-ring--10');
          if (trustScore >= 1 && trustScore <= 10) wrapEl.classList.add('service-offer-trust-ring--' + Math.min(10, Math.max(1, parseInt(trustScore, 10))));
        }
        var serviceNameEl = document.getElementById('join-offer-service-name');
        var planEl = document.getElementById('join-offer-plan');
        var priceDisplayEl = document.getElementById('join-offer-price');
        var ownerEl = document.getElementById('join-offer-owner-name');
        var scoreEl = document.getElementById('join-offer-score');
        var avatarEl = document.getElementById('join-offer-avatar');
        var serviceIcon = overlay && overlay.querySelector('.join-offer-service-icon');
        if (serviceIcon) serviceIcon.src = serviceLogoMap[serviceSlug] || serviceLogoMap.netflix;
        if (serviceNameEl) serviceNameEl.textContent = offer.service_name || name;
        if (planEl) planEl.textContent = offer.plan || 'Premium';
        if (priceDisplayEl) priceDisplayEl.textContent = price.replace('€', '');
        if (ownerEl) ownerEl.textContent = ownerName;
        if (scoreEl) scoreEl.textContent = scoreDisplay;
        if (avatarEl) {
          var img = avatarEl.querySelector('img');
          if (img) img.src = ownerAvatar;
        }
        currentJoinOffer = {
          offerId: offerId,
          slotIndex: slotIndex,
          service: offer.service,
          serviceName: offer.service_name || name,
          offerName: offer.plan || 'Premium',
          price: price,
          ownerName: ownerName
        };
        showJoinStep(1);
        var breakdown = document.getElementById('join-offer-price-breakdown');
        if (breakdown) breakdown.hidden = true;
        var toggleBtn = document.getElementById('join-offer-price-toggle');
        if (toggleBtn) {
          toggleBtn.setAttribute('aria-expanded', 'false');
          var arrowSvg = toggleBtn.querySelector('svg');
          if (arrowSvg) arrowSvg.style.transform = '';
        }
        var box = document.getElementById('join-offer-box');
        if (box) box.classList.add('join-offer-box--collapsed');
        var boxToggle = document.getElementById('join-offer-box-toggle');
        if (boxToggle) boxToggle.setAttribute('aria-expanded', 'false');
        if (overlay) overlay.hidden = false;
      })
      .catch(function () {
        alert('Could not load offer.');
      });
  }

  function parsePriceEuro(str) {
    if (!str || typeof str !== 'string') return 0;
    var m = str.replace(/\s/g, '').replace(',', '.').match(/[\d.]+/);
    return m ? parseFloat(m[0], 10) : 0;
  }

  function updatePriceBreakdown() {
    var priceEl = document.getElementById('join-offer-price');
    var total = priceEl ? parsePriceEuro(priceEl.textContent) : 0;
    var ownerRatio = 5.10 / 6.24;
    var operatingRatio = 1.14 / 6.24;
    var toOwner = total * ownerRatio;
    var operating = total * operatingRatio;
    var ownerVal = document.getElementById('join-breakdown-owner');
    var operatingVal = document.getElementById('join-breakdown-operating');
    if (ownerVal) ownerVal.textContent = toOwner.toFixed(2) + '€';
    if (operatingVal) operatingVal.textContent = operating.toFixed(2) + '€';
  }

  function togglePriceBreakdown() {
    var breakdown = document.getElementById('join-offer-price-breakdown');
    var toggleBtn = document.getElementById('join-offer-price-toggle');
    if (!breakdown || !toggleBtn) return;
    var willBeOpen = breakdown.hidden;
    breakdown.hidden = !willBeOpen;
    toggleBtn.setAttribute('aria-expanded', willBeOpen ? 'true' : 'false');
    if (willBeOpen) {
      updatePriceBreakdown();
      var svg = toggleBtn.querySelector('svg');
      if (svg) svg.style.transform = 'rotate(180deg)';
    } else {
      var s = toggleBtn.querySelector('svg');
      if (s) s.style.transform = '';
    }
  }

  var priceToggle = document.getElementById('join-offer-price-toggle');
  if (priceToggle) {
    priceToggle.addEventListener('click', function (e) {
      e.preventDefault();
      togglePriceBreakdown();
    });
  }

  var offerBox = document.getElementById('join-offer-box');
  var offerBoxToggle = document.getElementById('join-offer-box-toggle');
  var offerBoxBody = document.getElementById('join-offer-box-body');
  if (offerBoxToggle && offerBoxBody) {
    offerBoxToggle.addEventListener('click', function () {
      var collapsed = offerBox && offerBox.classList.contains('join-offer-box--collapsed');
      if (offerBox) offerBox.classList.toggle('join-offer-box--collapsed', !collapsed);
      offerBoxToggle.setAttribute('aria-expanded', collapsed ? 'true' : 'false');
    });
  }

  function closeJoinOfferModal() {
    if (overlay) overlay.hidden = true;
    showJoinStep(1);
  }

  var step1 = document.getElementById('join-offer-step-1');
  var step2 = document.getElementById('join-offer-step-2');
  var step3 = document.getElementById('join-offer-step-3');
  var step4 = document.getElementById('join-offer-step-4');

  var topupAmount = 20;
  var TOPUP_MIN = 10;
  var TOPUP_MAX = 150;

  function showJoinStep(step) {
    if (step1) step1.classList.toggle('join-offer-step--hidden', step !== 1);
    if (step2) step2.classList.toggle('join-offer-step--hidden', step !== 2);
    if (step3) step3.classList.toggle('join-offer-step--hidden', step !== 3);
    if (step4) step4.classList.toggle('join-offer-step--hidden', step !== 4);
    if (step === 2) {
      var payBtn = document.getElementById('join-offer-pay');
      var payLabel = document.getElementById('join-offer-pay-label');
      if (payBtn) {
        payBtn.disabled = true;
        if (payLabel) payLabel.textContent = 'Next';
        var radios = document.querySelectorAll('.join-offer-payment-radio');
        if (radios.length) radios[0].checked = false;
        if (radios.length > 1) radios[1].checked = false;
      }
    }
    if (step === 3) {
      topupAmount = 20;
      updateTopupDisplay();
      document.querySelectorAll('.join-offer-topup-preset').forEach(function (btn) {
        btn.classList.toggle('join-offer-topup-preset--active', parseInt(btn.getAttribute('data-amount'), 10) === topupAmount);
      });
    }
    if (step === 4) {
      var payAmountEl = document.getElementById('join-offer-topup-pay-amount');
      if (payAmountEl) payAmountEl.textContent = topupAmount;
      updateTopupPayFormVisibility();
    }
  }

  function updateTopupPayFormVisibility() {
    var form = document.getElementById('join-offer-card-form');
    var gpayNext = document.getElementById('join-offer-gpay-next');
    var checked = document.querySelector('.join-offer-pay-method-radio:checked');
    var isCard = checked && checked.value === 'card';
    if (form) form.classList.toggle('join-offer-card-form--hidden', !isCard);
    if (gpayNext) gpayNext.classList.toggle('join-offer-gpay-next--visible', !isCard);
  }

  function updateTopupDisplay() {
    var el = document.getElementById('join-offer-topup-value');
    if (el) el.textContent = topupAmount + '€';
    document.querySelectorAll('.join-offer-topup-preset').forEach(function (btn) {
      btn.classList.toggle('join-offer-topup-preset--active', parseInt(btn.getAttribute('data-amount'), 10) === topupAmount);
    });
  }

  function updateJoinPayButton() {
    var payBtn = document.getElementById('join-offer-pay');
    var payLabel = document.getElementById('join-offer-pay-label');
    var checked = document.querySelector('.join-offer-payment-radio:checked');
    if (!payBtn || !payLabel) return;
    payBtn.disabled = !checked;
    if (checked && checked.value === 'card') {
      var priceDisplay = document.getElementById('join-offer-price');
      payLabel.textContent = 'Pay ' + (priceDisplay ? priceDisplay.textContent : '4.14€');
    } else {
      payLabel.textContent = 'Next';
    }
  }

  document.querySelectorAll('.service-offer-join:not(.service-offer-join--joined):not(.service-offer-join--manage)').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var card = btn.closest('.service-offer-card');
      if (card) openJoinOfferModal(card.getAttribute('data-offer-id'));
    });
  });
  if (backdrop) backdrop.addEventListener('click', closeJoinOfferModal);
  var closeBtn = document.getElementById('join-offer-close');
  if (closeBtn) closeBtn.addEventListener('click', closeJoinOfferModal);
  var nextBtn = document.getElementById('join-offer-next');
  if (nextBtn) nextBtn.addEventListener('click', function () { showJoinStep(2); });
  var backBtn = document.getElementById('join-offer-back');
  if (backBtn) backBtn.addEventListener('click', function () { showJoinStep(1); });

  var backBtn3 = document.getElementById('join-offer-back-3');
  if (backBtn3) backBtn3.addEventListener('click', function () { showJoinStep(2); });

  var backBtn4 = document.getElementById('join-offer-back-4');
  if (backBtn4) backBtn4.addEventListener('click', function () { showJoinStep(3); });

  var topupNextBtn = document.getElementById('join-offer-topup-next');
  if (topupNextBtn) topupNextBtn.addEventListener('click', function () { showJoinStep(4); });

  var payBtn = document.getElementById('join-offer-pay');
  if (payBtn) {
    payBtn.addEventListener('click', function () {
      var checked = document.querySelector('.join-offer-payment-radio:checked');
      if (checked && checked.value === 'wallet') {
        showJoinStep(3);
      } else if (checked && checked.value === 'card') {
        saveSubscriptionAndGoHome();
      }
    });
  }

  var topupMinus = document.getElementById('join-offer-topup-minus');
  var topupPlus = document.getElementById('join-offer-topup-plus');
  if (topupMinus) topupMinus.addEventListener('click', function () { if (topupAmount > TOPUP_MIN) { topupAmount -= 1; updateTopupDisplay(); } });
  if (topupPlus) topupPlus.addEventListener('click', function () { if (topupAmount < TOPUP_MAX) { topupAmount += 1; updateTopupDisplay(); } });

  document.querySelectorAll('.join-offer-topup-preset').forEach(function (btn) {
    btn.addEventListener('click', function () {
      topupAmount = parseInt(btn.getAttribute('data-amount'), 10);
      updateTopupDisplay();
    });
  });

  document.querySelectorAll('.join-offer-pay-method-radio').forEach(function (radio) {
    radio.addEventListener('change', updateTopupPayFormVisibility);
  });

  var topupPayBtn = document.getElementById('join-offer-topup-pay');
  if (topupPayBtn) topupPayBtn.addEventListener('click', saveSubscriptionAndGoHome);
  var gpayNextBtn = document.getElementById('join-offer-gpay-next');
  if (gpayNextBtn) gpayNextBtn.addEventListener('click', saveSubscriptionAndGoHome);

  document.querySelectorAll('.join-offer-payment-radio').forEach(function (radio) {
    radio.addEventListener('change', updateJoinPayButton);
  });
})();
