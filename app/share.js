(function () {
  'use strict';

  var steps = ['service', 'how', 'offer', 'slots', 'confirm'];
  var currentStep = 0;
  var state = {
    service: null,
    serviceName: '',
    type: null,
    offerName: 'Family',
    offerPrice: 19.99,
    offerMaxUsers: 6,
    slots: 5
  };

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
  function checkCharterAccepted(cb) {
    var token = getToken();
    if (!token) { if (cb) cb(false); return; }
    fetchWithAuth('/api/auth/me', {})
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) { if (cb) cb(!!(data && data.profile && data.profile.charter_accepted_at)); })
      .catch(function () { if (cb) cb(false); });
  }

  function getStepEl(step) {
    return document.querySelector('.share-step[data-step="' + step + '"]');
  }

  function showStep(stepIndex) {
    currentStep = stepIndex;
    var stepName = steps[stepIndex];
    document.querySelectorAll('.share-step').forEach(function (el) {
      el.classList.add('share-step--hidden');
    });
    var el = getStepEl(stepName);
    if (el) el.classList.remove('share-step--hidden');
    if (stepName === 'slots') updateSlotsButtons();
    if (stepName === 'confirm') updateTermsServiceName();
  }

  function updateTermsServiceName() {
    var serviceName = state.serviceName || 'the service';
    var el1 = document.getElementById('share-terms-service');
    var el2 = document.getElementById('share-terms-service-2');
    if (el1) el1.textContent = serviceName;
    if (el2) el2.textContent = serviceName;
  }

  function goBack() {
    if (currentStep > 0) showStep(currentStep - 1);
  }

  function updateSlotsPrice() {
    var slotsEl = document.getElementById('share-slots-value');
    var priceEl = document.getElementById('share-slots-price');
    if (!slotsEl || !priceEl) return;
    var slots = state.slots;
    var perSlot = state.offerPrice / state.offerMaxUsers;
    var earnings = (Math.round(perSlot * slots * 100) / 100).toFixed(2);
    slotsEl.textContent = slots;
    priceEl.textContent = earnings + ' €';
    updateSlotsButtons();
  }

  function updateSlotsButtons() {
    var slotsMinus = document.getElementById('share-slots-minus');
    var slotsPlus = document.getElementById('share-slots-plus');
    if (!slotsMinus || !slotsPlus) return;
    var atMin = state.slots <= 1;
    var atMax = state.slots >= state.offerMaxUsers - 1;
    slotsMinus.disabled = atMin;
    slotsPlus.disabled = atMax;
    slotsMinus.classList.toggle('share-slots-btn--disabled', atMin);
    slotsPlus.classList.toggle('share-slots-btn--disabled', atMax);
  }

  function createOfferOnServer(done) {
    var token = getToken();
    if (!token) {
      if (done) done('Please log in to create an offer.', null);
      return;
    }
    var visibility = state.type === 'public' ? 'public' : 'private';
    var body = {
      service: state.service,
      service_name: state.serviceName,
      plan: state.offerName,
      price: state.offerPrice,
      max_slots: state.slots,
      visibility: visibility,
      instant: false,
      verified: false
    };
    fetchWithAuth('/api/offers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (r) { return r.json().then(function (data) { return { status: r.status, data: data }; }); })
      .then(function (result) {
        if (result.status === 201 && result.data && result.data.id) {
          if (done) done(null, result.data.id);
          return;
        }
        var msg = (result.data && result.data.error) ? result.data.error : 'Could not create offer.';
        if (done) done(msg, null);
      })
      .catch(function () { if (done) done('Network error.', null); });
  }

  // Step 1: service list and search / category filter
  var shareSearchInput = document.getElementById('share-search');
  var shareServiceList = document.getElementById('share-service-list');
  var shareCatPills = document.querySelectorAll('.share-cat-pill');

  function applyShareFilters() {
    if (!shareServiceList) return;
    var query = (shareSearchInput && shareSearchInput.value) ? shareSearchInput.value.trim().toLowerCase() : '';
    var activePill = document.querySelector('.share-cat-pill--active');
    var category = (activePill && activePill.getAttribute('data-cat')) || 'popular';

    shareServiceList.querySelectorAll('li').forEach(function (li) {
      var row = li.querySelector('.share-service-row');
      if (!row) return;
      var nameEl = row.querySelector('.share-service-name');
      var name = (nameEl && nameEl.textContent) ? nameEl.textContent.trim().toLowerCase() : '';
      var rowCat = row.getAttribute('data-cat') || '';

      var matchSearch = !query || name.indexOf(query) !== -1;
      var matchCat = category === 'popular' || rowCat === category;
      li.hidden = !(matchSearch && matchCat);
    });
  }

  if (shareSearchInput) {
    shareSearchInput.addEventListener('input', applyShareFilters);
    shareSearchInput.addEventListener('keyup', applyShareFilters);
  }

  document.querySelectorAll('.share-service-row').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.service = btn.getAttribute('data-service');
      state.serviceName = btn.querySelector('.share-service-name').textContent;
      showStep(1);
    });
  });

  shareCatPills.forEach(function (pill) {
    pill.addEventListener('click', function () {
      shareCatPills.forEach(function (p) { p.classList.remove('share-cat-pill--active'); });
      pill.classList.add('share-cat-pill--active');
      applyShareFilters();
    });
  });

  // Back buttons
  document.querySelectorAll('.share-back').forEach(function (btn) {
    btn.addEventListener('click', goBack);
  });

  // Step 2: public / private (charter required for public)
  document.querySelectorAll('.share-option-card').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.type = btn.getAttribute('data-type');
      if (state.type === 'public') {
        checkCharterAccepted(function (accepted) {
          if (!accepted) {
            var charterUrl = '/charter?from=share&service=' + encodeURIComponent(state.service || '') + '&serviceName=' + encodeURIComponent(state.serviceName || '');
            window.location.href = charterUrl;
            return;
          }
          if (offerTitle) offerTitle.textContent = 'What ' + state.serviceName + ' offer do you want to share?';
          showStep(2);
        });
      } else {
        if (offerTitle) offerTitle.textContent = 'What ' + state.serviceName + ' offer do you want to share?';
        showStep(2);
      }
    });
  });

  // Step 3: offer (go to slots)
  var offerTitle = document.getElementById('share-offer-title');
  document.querySelectorAll('.share-offer-row').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.offerName = btn.querySelector('.share-offer-name').textContent;
      showStep(3);
      updateSlotsPrice();
    });
  });

  // Step 4: slots counter
  var slotsValue = document.getElementById('share-slots-value');
  var slotsMinus = document.getElementById('share-slots-minus');
  var slotsPlus = document.getElementById('share-slots-plus');
  if (slotsMinus) {
    slotsMinus.addEventListener('click', function () {
      if (state.slots > 1) {
        state.slots--;
        updateSlotsPrice();
      }
    });
  }
  if (slotsPlus) {
    slotsPlus.addEventListener('click', function () {
      if (state.slots < state.offerMaxUsers - 1) {
        state.slots++;
        updateSlotsPrice();
      }
    });
  }
  document.getElementById('share-slots-next').addEventListener('click', function () {
    showStep(4);
  });

  // Step 5: Phone (digits only), terms, create offer
  var sharePhone = document.getElementById('share-phone');
  if (sharePhone) {
    sharePhone.addEventListener('input', function () {
      this.value = this.value.replace(/[^\d+]/g, '');
    });
  }

  // Step 5: Create offer (POST /api/offers, then redirect to /offer?id=)
  var shareCreateBtn = document.getElementById('share-create-btn');
  shareCreateBtn.addEventListener('click', function () {
    var phone = document.getElementById('share-phone');
    var terms = document.getElementById('share-terms');
    if (phone && !phone.value.trim()) {
      phone.focus();
      return;
    }
    if (terms && !terms.checked) {
      var termsLabel = terms.closest('.share-terms-label');
      if (termsLabel) {
        termsLabel.classList.remove('share-terms-label--wiggle');
        termsLabel.offsetHeight;
        termsLabel.classList.add('share-terms-label--wiggle');
        termsLabel.addEventListener('animationend', function once() {
          termsLabel.classList.remove('share-terms-label--wiggle');
          termsLabel.removeEventListener('animationend', once);
        });
      }
      terms.focus();
      return;
    }
    shareCreateBtn.disabled = true;
    shareCreateBtn.textContent = 'Creating…';
    createOfferOnServer(function (err, offerId) {
      if (err) {
        shareCreateBtn.disabled = false;
        shareCreateBtn.textContent = 'Create offer';
        alert(err);
        return;
      }
      window.location.href = '/offer?id=' + encodeURIComponent(offerId);
    });
  });

  // Restore state when returning from charter (share flow continuation)
  var urlParams = new URLSearchParams(window.location.search);
  var charterAccepted = urlParams.get('charter') === 'accepted';
  var urlService = urlParams.get('service');
  var urlServiceName = urlParams.get('serviceName');
  if (charterAccepted && urlService) {
    state.service = urlService;
    state.serviceName = urlServiceName || urlService;
    state.type = 'public';
    if (offerTitle) offerTitle.textContent = 'What ' + state.serviceName + ' offer do you want to share?';
    showStep(2);
  } else {
    // Restore step from hash (optional)
    var hash = window.location.hash.slice(1);
    var idx = steps.indexOf(hash);
    if (idx >= 0) showStep(idx);
  }
})();
