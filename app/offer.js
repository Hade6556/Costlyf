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

  var currentOffer = null;
  var currentUserId = null;

  function getOfferId() {
    var params = new URLSearchParams(window.location.search);
    return params.get('id') || null;
  }

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

  function escapeHtml(str) {
    if (str == null) return '';
    var s = String(str);
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      var day = ('0' + d.getDate()).slice(-2);
      var month = ('0' + (d.getMonth() + 1)).slice(-2);
      var year = d.getFullYear();
      return day + '/' + month + '/' + year;
    } catch (e) {
      return '—';
    }
  }

  function daysLeftUntil(iso) {
    if (!iso) return 0;
    try {
      var end = new Date(iso);
      var now = new Date();
      now.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      var diff = Math.ceil((end - now) / (24 * 60 * 60 * 1000));
      return Math.max(0, diff);
    } catch (e) {
      return 0;
    }
  }

  function render(offer) {
    if (!offer) return;
    currentOffer = offer;

    var logo = logoMap[offer.service] || '/media/logo.svg';
    var contribution = (offer.contribution_per_month != null) ? Number(offer.contribution_per_month) : 0;
    var taken = offer.seats_taken != null ? offer.seats_taken : 0;
    var total = offer.max_slots != null ? offer.max_slots : 1;

    var logoEl = document.getElementById('offer-logo');
    var nameEl = document.getElementById('offer-service-name');
    var contributionEl = document.getElementById('offer-contribution');
    var filledEl = document.getElementById('offer-cosubs-filled');
    var totalEl = document.getElementById('offer-cosubs-total');
    var detailServiceEl = document.getElementById('offer-detail-service');
    var detailPlanEl = document.getElementById('offer-detail-plan');
    var ownerSinceEl = document.getElementById('offer-owner-since');

    if (logoEl) logoEl.src = logo;
    if (logoEl) logoEl.alt = offer.service_name || offer.service || '';
    if (nameEl) nameEl.textContent = offer.service_name || offer.service || 'Offer';
    if (contributionEl) contributionEl.textContent = (contribution === 0 ? '0' : contribution.toFixed(2));
    if (filledEl) filledEl.textContent = String(taken);
    if (totalEl) totalEl.textContent = String(total);
    if (detailServiceEl) detailServiceEl.textContent = offer.service_name || offer.service || '—';
    if (detailPlanEl) detailPlanEl.textContent = offer.plan || '—';
    if (ownerSinceEl) ownerSinceEl.textContent = formatDate(offer.created_at);

    var isPrivate = (offer.visibility || 'private') === 'private';
    var privateOpt = document.getElementById('offer-visibility-private');
    var publicOpt = document.getElementById('offer-visibility-public');
    if (privateOpt) {
      privateOpt.classList.toggle('offer-visibility-option--active', isPrivate);
      privateOpt.setAttribute('aria-pressed', isPrivate ? 'true' : 'false');
    }
    if (publicOpt) {
      publicOpt.classList.toggle('offer-visibility-option--active', !isPrivate);
      publicOpt.setAttribute('aria-pressed', !isPrivate ? 'true' : 'false');
    }
  }

  var charterAccepted = false;
  function updateCharterRow() {
    var statusEl = document.getElementById('offer-charter-status');
    var descEl = document.getElementById('offer-charter-desc');
    if (statusEl) {
      if (charterAccepted) {
        statusEl.innerHTML = '<span class="offer-charter-check" aria-hidden="true">✓</span> Read and approved';
        statusEl.classList.remove('offer-charter-status--pending');
      } else {
        statusEl.textContent = 'Not approved';
        statusEl.classList.add('offer-charter-status--pending');
      }
    }
    if (descEl) descEl.textContent = charterAccepted ? 'Read the CostLyf charter' : 'Read and accept the charter to go public with your offer.';
  }

  function fetchCharterStatus(done) {
    if (!getToken()) {
      charterAccepted = false;
      updateCharterRow();
      if (done) done();
      return;
    }
    fetchWithAuth('/api/auth/me', {})
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        charterAccepted = !!(data && data.profile && data.profile.charter_accepted_at);
        updateCharterRow();
        if (done) done();
      })
      .catch(function () {
        charterAccepted = false;
        updateCharterRow();
        if (done) done();
      });
  }

  function loadOffer(id, done) {
    fetchWithAuth('/api/offers/' + encodeURIComponent(id), {})
      .then(function (r) {
        if (!r.ok) return null;
        return r.json();
      })
      .then(function (data) {
        if (done) done(null, data);
      })
      .catch(function (err) {
        if (done) done(err || 'Failed to load offer', null);
      });
  }

  function refreshOffer(done) {
    var id = getOfferId();
    if (!id) { if (done) done(); return; }
    loadOffer(id, function (err, offer) {
      if (!err && offer) render(offer);
      if (done) done();
    });
  }

  function updateVisibility(visibility) {
    var id = getOfferId();
    if (!id || !currentOffer) return;
    fetchWithAuth('/api/offers/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibility: visibility })
    })
      .then(function (r) {
        if (r.ok) refreshOffer();
        else return r.json().then(function (d) { throw new Error(d.error || 'Update failed'); });
      })
      .catch(function (e) { alert(e.message || 'Update failed'); });
  }

  function stopOffer() {
    var id = getOfferId();
    if (!id) return;
    fetchWithAuth('/api/offers/' + encodeURIComponent(id), { method: 'DELETE' })
      .then(function (r) {
        if (r.ok) window.location.href = '/home';
        else return r.json().then(function (d) { throw new Error(d.error || 'Delete failed'); });
      })
      .catch(function (e) { alert(e.message || 'Could not stop share'); });
  }

  function renderCosubsModal() {
    var list = document.getElementById('offer-cosubs-list');
    var countEl = document.getElementById('offer-cosubs-count');
    var maxEl = document.getElementById('offer-cosubs-max');
    if (!list || !currentOffer) return;
    var slots = currentOffer.slots || [];
    var taken = currentOffer.seats_taken != null ? currentOffer.seats_taken : 0;
    var maxSlots = currentOffer.max_slots || 0;
    var isOwner = currentUserId && currentOffer.owner_id === currentUserId;

    if (maxEl) maxEl.textContent = String(maxSlots);
    if (countEl) countEl.textContent = String(taken);

    list.innerHTML = slots.map(function (slot) {
      var status = slot.status || 'available';
      var scheduledRemoval = slot.removal_effective_at && String(slot.removal_effective_at).trim();
      var isMine = currentUserId && slot.user_id === currentUserId;
      var reservedByOwner = isOwner && slot.user_id && String(slot.user_id) === String(currentUserId);
      var statusLabel = status === 'available' ? 'Available' : status === 'reserved' ? (reservedByOwner ? 'Reserved' : 'Pending') : (scheduledRemoval ? 'Canceled' : 'Active');
      var canReserve = status === 'available' && currentUserId;
      var canUnreserve = status === 'reserved' && isMine;
      var canRequestRemoval = status === 'taken' && isMine;
      var canAcceptDecline = isOwner && status === 'reserved' && slot.user_id && !reservedByOwner;
      var canOwnerRemove = isOwner && status === 'taken' && slot.user_id && !reservedByOwner && !scheduledRemoval;
      var slotUserName = (slot.slot_user_name && slot.slot_user_name.trim()) ? slot.slot_user_name : (slot.user_id ? 'User' : '');
      var removalInfo = slot.removal_effective_at ? ' (removal ' + formatDate(slot.removal_effective_at) + ')' : '';

      var actions = [];
      if (canReserve) {
        actions.push('<button type="button" class="offer-cosubs-slot-btn offer-cosubs-slot-btn--primary" data-action="reserve" data-slot="' + slot.slot_index + '">Reserve</button>');
      }
      if (canAcceptDecline) {
        actions.push('<button type="button" class="offer-cosubs-slot-btn offer-cosubs-slot-btn--primary" data-action="accept" data-slot="' + slot.slot_index + '">Accept</button>');
        actions.push('<button type="button" class="offer-cosubs-slot-btn offer-cosubs-slot-btn--danger" data-action="decline" data-slot="' + slot.slot_index + '">Decline</button>');
      }
      if (canUnreserve) {
        actions.push('<button type="button" class="offer-cosubs-slot-btn offer-cosubs-slot-btn--secondary" data-action="unreserve" data-slot="' + slot.slot_index + '">Unreserve</button>');
      }
      if (canRequestRemoval) {
        actions.push('<button type="button" class="offer-cosubs-slot-btn offer-cosubs-slot-btn--danger" data-action="request-removal" data-slot="' + slot.slot_index + '">Request removal' + removalInfo + '</button>');
      }
      if (canOwnerRemove) {
        actions.push('<button type="button" class="offer-cosubs-slot-btn offer-cosubs-slot-btn--danger" data-action="schedule-removal" data-slot="' + slot.slot_index + '">Remove</button>');
      }

      var slotUserLine = (status === 'reserved' || status === 'taken') && slotUserName ? '<div class="offer-cosubs-slot-user">' + escapeHtml(slotUserName) + '</div>' : '';
      var slotTakenMeta = '';
      if (status === 'taken' && slotUserName) {
        var sinceText = slot.reserved_at ? 'Since ' + formatDate(slot.reserved_at) : '';
        var stateText = scheduledRemoval ? 'Canceled (removal ' + formatDate(slot.removal_effective_at) + ')' : '';
        slotTakenMeta = '<div class="offer-cosubs-slot-taken-meta">' + (sinceText ? escapeHtml(sinceText) : '') + (sinceText && stateText ? ' · ' : '') + stateText + '</div>';
      }
      var acceptDeclineHint = canAcceptDecline ? '<div class="offer-cosubs-slot-hint">Accept to add them as a co-subscriber; Decline to cancel their request.</div>' : '';
      return (
        '<div class="offer-cosubs-slot offer-cosubs-slot--' + status + '" data-slot-index="' + slot.slot_index + '">' +
          '<div><span class="offer-cosubs-slot-label">Slot ' + slot.slot_index + '</span><span class="offer-cosubs-slot-status">' + statusLabel + '</span>' + slotUserLine + slotTakenMeta + '</div>' +
          acceptDeclineHint +
          '<div class="offer-cosubs-slot-actions">' + actions.join('') + '</div>' +
        '</div>'
      );
    }).join('');

    list.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var action = btn.getAttribute('data-action');
        var slotIndex = btn.getAttribute('data-slot');
        if (!action || !slotIndex) return;
        var id = getOfferId();
        if (!id) return;
        var url = '/api/offers/' + encodeURIComponent(id) + '/slots/' + slotIndex;
        var method = 'POST';
        if (action === 'unreserve') {
          url += '/reserve';
          method = 'DELETE';
        } else if (action === 'accept') {
          url += '/accept';
        } else if (action === 'decline') {
          url += '/decline';
        } else if (action === 'request-removal') {
          url += '/request-removal';
        } else if (action === 'schedule-removal') {
          url += '/schedule-removal';
        } else {
          url += '/reserve';
        }
        fetchWithAuth(url, { method: method })
          .then(function (r) {
            if (r.ok) {
              refreshOffer(function () {
                render(currentOffer);
                renderCosubsModal();
              });
            } else {
              return r.json().then(function (d) { throw new Error(d.error || 'Action failed'); });
            }
          })
          .catch(function (e) { alert(e.message || 'Action failed'); });
      });
    });
  }

  function renderOwnerRow(offer) {
    var nameEl = document.getElementById('offer-owner-name');
    var avatarEl = document.getElementById('offer-owner-avatar');
    var chatBtn = document.getElementById('offer-open-chat-btn');
    if (!offer || !nameEl) return;
    var name = offer.owner_name || offer.owner_alias || 'Owner';
    nameEl.textContent = name;
    if (avatarEl) {
      var avatarUrl = offer.owner_avatar_url;
      if (avatarUrl && avatarUrl.trim()) {
        avatarEl.className = 'offer-owner-avatar subscription-owner-avatar subscription-owner-avatar--img';
        avatarEl.innerHTML = '<img src="' + String(avatarUrl).replace(/"/g, '&quot;') + '" alt="">';
      } else {
        var colors = ['#a8e6cf', '#d4b5ff', '#a8d4f0', '#fff4b8', '#ffc8d4'];
        var h = 0;
        for (var i = 0; i < (name || '').length; i++) h = ((h << 5) - h) + (name || '').charCodeAt(i) | 0;
        var idx = (Math.abs(h) % 5) + 1;
        var color = colors[idx - 1] || colors[0];
        avatarEl.className = 'offer-owner-avatar subscription-owner-avatar subscription-owner-avatar--default';
        avatarEl.style.setProperty('--circle-color', color);
        avatarEl.innerHTML = '<span class="inbox-avatar-circle"><img src="/media/hero-profiles/' + idx + '.png" alt=""></span>';
      }
    }
    if (chatBtn) {
      chatBtn.href = '/inbox?offerId=' + encodeURIComponent(offer.id);
    }
  }

  (function init() {
    var id = getOfferId();
    if (!id) {
      window.location.href = '/home';
      return;
    }

    var offerData = null;
    var userResolved = !getToken();

    function tryPaint() {
      if (!offerData || !userResolved) return;
      var loadingEl = document.getElementById('offer-loading-placeholder');
      var offerCard = document.getElementById('offer-card');
      if (loadingEl) {
        loadingEl.setAttribute('hidden', '');
        loadingEl.style.display = 'none';
      }
      if (offerCard) {
        offerCard.removeAttribute('hidden');
        offerCard.style.display = '';
      }
      currentOffer = offerData;
      render(currentOffer);
      applyViewMode();
      if (window.hideAppLoading) window.hideAppLoading();
    }

    function applyViewMode() {
      var offer = currentOffer;
      if (!offer) return;
      var offerCard = document.getElementById('offer-card');
      if (!offerCard) return;
      var isOwner = currentUserId && offer.owner_id === currentUserId;
      offerCard.classList.remove('offer-view-pending');
      if (isOwner) {
        offerCard.classList.remove('offer-view-member');
        offerCard.classList.add('offer-view-owner');
        var ownerRow = document.getElementById('offer-owner-row');
        var mySlotRow = document.getElementById('offer-my-slot-row');
        if (ownerRow) ownerRow.hidden = true;
        if (mySlotRow) mySlotRow.hidden = true;
        return;
      }
      offerCard.classList.remove('offer-view-owner');
      if (!currentUserId) return;
      var slots = offer.slots || [];
      var mySlot = slots.filter(function (s) { return s.user_id === currentUserId; })[0];
      if (!mySlot) {
        window.location.href = '/home';
        return;
      }
      offerCard.classList.remove('offer-view-owner');
      offerCard.classList.add('offer-view-member');
      renderOwnerRow(offer);
      var mySlotRow = document.getElementById('offer-my-slot-row');
      var mySlotStatusEl = document.getElementById('offer-my-slot-status');
      var cancelEffectiveEl = document.getElementById('offer-cancel-effective');
      var cancelBtn = document.getElementById('offer-cancel-subscription-btn');
      if (mySlotRow) {
        mySlotRow.hidden = false;
        mySlotRow.classList.add('offer-row--static');
      }
      var mySlotScheduledRemoval = mySlot.removal_effective_at && String(mySlot.removal_effective_at).trim();
      if (mySlotStatusEl) {
        var statusText = mySlot.status === 'taken' ? (mySlotScheduledRemoval ? 'Canceled' : 'Active') : 'Pending';
        var daysLeft = typeof mySlot.days_left === 'number' ? mySlot.days_left : daysLeftUntil(mySlot.period_end || mySlot.removal_effective_at);
        var statusDisplay = statusText === 'Active' && daysLeft >= 0 ? statusText + ' · ' + daysLeft + ' days left' : statusText;
        mySlotStatusEl.textContent = statusDisplay;
        mySlotStatusEl.classList.toggle('offer-my-slot-status--active', statusText === 'Active');
      }
      var pendingHintEl = document.getElementById('offer-my-slot-pending-hint');
      if (pendingHintEl) pendingHintEl.hidden = mySlot.status !== 'reserved';
      var hasCancellationScheduled = mySlot.removal_effective_at && mySlot.removal_effective_at.trim();
      if (cancelEffectiveEl) {
        if (hasCancellationScheduled) {
          var daysLeft = daysLeftUntil(mySlot.removal_effective_at);
          cancelEffectiveEl.innerHTML = 'Cancels on ' + formatDate(mySlot.removal_effective_at) + '. <strong>' + daysLeft + ' days left.</strong>';
          cancelEffectiveEl.hidden = false;
          cancelEffectiveEl.classList.add('offer-cancel-effective--scheduled');
        } else {
          cancelEffectiveEl.textContent = '';
          cancelEffectiveEl.hidden = true;
          cancelEffectiveEl.classList.remove('offer-cancel-effective--scheduled');
        }
      }
      if (cancelBtn) {
        if (hasCancellationScheduled) {
          cancelBtn.hidden = true;
        } else {
          cancelBtn.textContent = 'Cancel subscription';
          cancelBtn.classList.remove('offer-row-btn--success');
          cancelBtn.classList.add('offer-row-btn--danger');
          cancelBtn.onclick = function () { showCancelSubscriptionConfirm(mySlot.slot_index); };
          cancelBtn.hidden = (mySlot.status !== 'taken' && mySlot.status !== 'reserved');
        }
      }
    }

    if (getToken()) {
      fetchWithAuth('/api/auth/me', {})
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (data && data.user && data.user.id) currentUserId = data.user.id;
          userResolved = true;
          tryPaint();
        })
        .catch(function () {
          userResolved = true;
          tryPaint();
        });
    }

    loadOffer(id, function (err, offer) {
      if (err || !offer) {
        var loadingEl = document.getElementById('offer-loading-placeholder');
        if (loadingEl) { loadingEl.setAttribute('hidden', ''); loadingEl.style.display = 'none'; }
        window.location.href = '/home';
        return;
      }
      offerData = offer;
      tryPaint();
    });

    var params = new URLSearchParams(window.location.search);
    if (params.get('charter') === 'accepted') {
      charterAccepted = true;
      updateCharterRow();
      if (window.history && window.history.replaceState) window.history.replaceState({}, '', window.location.pathname + '?id=' + encodeURIComponent(id));
    } else {
      fetchCharterStatus();
    }

    var overlay = document.getElementById('offer-stop-overlay');
    var stopBtn = document.getElementById('offer-stop-btn');
    var cancelBtn = document.getElementById('offer-stop-cancel');
    var confirmBtn = document.getElementById('offer-stop-confirm');
    var backdrop = document.getElementById('offer-stop-backdrop');
    function showStopConfirm() { if (overlay) overlay.hidden = false; }
    function hideStopConfirm() { if (overlay) overlay.hidden = true; }
    if (stopBtn) stopBtn.addEventListener('click', showStopConfirm);
    if (cancelBtn) cancelBtn.addEventListener('click', hideStopConfirm);
    if (confirmBtn) confirmBtn.addEventListener('click', function () { hideStopConfirm(); stopOffer(); });
    if (backdrop) backdrop.addEventListener('click', hideStopConfirm);

    var cancelOverlay = document.getElementById('offer-cancel-overlay');
    var cancelSubCancelBtn = document.getElementById('offer-cancel-cancel');
    var cancelSubConfirmBtn = document.getElementById('offer-cancel-confirm');
    var cancelSubBackdrop = document.getElementById('offer-cancel-backdrop');
    function showCancelSubscriptionConfirm(slotIndex) {
      if (cancelOverlay) cancelOverlay.hidden = false;
      if (cancelSubConfirmBtn) cancelSubConfirmBtn.onclick = function () {
        var offerId = getOfferId();
        if (!offerId) return;
        if (cancelOverlay) cancelOverlay.hidden = true;
        fetchWithAuth('/api/offers/' + encodeURIComponent(offerId) + '/slots/' + slotIndex + '/cancel-subscription', { method: 'POST' })
          .then(function (r) {
            if (r.ok) { refreshOffer(function () { applyViewMode(); }); }
            else return r.json().then(function (d) { throw new Error(d.error || 'Failed'); });
          })
          .catch(function (e) { alert(e.message || 'Could not cancel subscription'); });
      };
    }
    function hideCancelOverlay() { if (cancelOverlay) cancelOverlay.hidden = true; }
    if (cancelSubCancelBtn) cancelSubCancelBtn.addEventListener('click', hideCancelOverlay);
    if (cancelSubBackdrop) cancelSubBackdrop.addEventListener('click', hideCancelOverlay);

    var privateOpt = document.getElementById('offer-visibility-private');
    var publicOpt = document.getElementById('offer-visibility-public');
    var publishOverlay = document.getElementById('offer-publish-overlay');
    var publishBackdrop = document.getElementById('offer-publish-backdrop');
    var publishConfirm = document.getElementById('offer-publish-confirm');
    var publishNevermind = document.getElementById('offer-publish-nevermind');

    if (privateOpt) {
      privateOpt.addEventListener('click', function () {
        updateVisibility('private');
      });
    }
    if (publicOpt) {
      publicOpt.addEventListener('click', function () {
        if (currentOffer && (currentOffer.visibility || 'private') === 'public') return;
        if (!charterAccepted) {
          window.location.href = '/charter?from=offer&id=' + encodeURIComponent(getOfferId());
          return;
        }
        var serviceName = (currentOffer && currentOffer.service_name) || currentOffer.service || 'the service';
        var slots = (currentOffer && currentOffer.max_slots) || 0;
        var taken = (currentOffer && currentOffer.seats_taken) || 0;
        var contribution = (currentOffer && currentOffer.contribution_per_month) != null ? currentOffer.contribution_per_month : 0;
        var priceStr = (contribution === 0 ? '0' : contribution.toFixed(2)) + '€';
        document.getElementById('offer-publish-service').textContent = serviceName + ' ' + ((currentOffer && currentOffer.plan) || '');
        document.getElementById('offer-publish-slots').textContent = String(slots);
        document.getElementById('offer-publish-price').textContent = priceStr;
        document.getElementById('offer-publish-terms-service').textContent = serviceName;
        document.getElementById('offer-publish-terms-service-2').textContent = serviceName;
        if (publishOverlay) publishOverlay.hidden = false;
      });
    }

    function hidePublishOverlay() { if (publishOverlay) publishOverlay.hidden = true; }
    if (publishConfirm) {
      publishConfirm.addEventListener('click', function () {
        updateVisibility('public');
        hidePublishOverlay();
      });
    }
    if (publishBackdrop) publishBackdrop.addEventListener('click', hidePublishOverlay);
    if (publishNevermind) publishNevermind.addEventListener('click', hidePublishOverlay);

    var cosubsOverlay = document.getElementById('offer-cosubs-overlay');
    var cosubsBackdrop = document.getElementById('offer-cosubs-backdrop');
    var cosubsClose = document.getElementById('offer-cosubs-close');
    var cosubsRow = document.getElementById('offer-cosubs-row');
    if (cosubsRow) {
      cosubsRow.addEventListener('click', function (e) {
        e.preventDefault();
        if (currentOffer) {
          renderCosubsModal();
          if (cosubsOverlay) cosubsOverlay.hidden = false;
        }
      });
    }
    function hideCosubsOverlay() { if (cosubsOverlay) cosubsOverlay.hidden = true; }
    if (cosubsBackdrop) cosubsBackdrop.addEventListener('click', hideCosubsOverlay);
    if (cosubsClose) cosubsClose.addEventListener('click', hideCosubsOverlay);

    [ 'offer-support-btn-owner', 'offer-support-btn-member' ].forEach(function (id) {
      var btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', function () {});
    });
  })();
})();
