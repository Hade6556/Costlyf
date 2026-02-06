(function () {
  'use strict';

  var currentProfile = {};
  var currentUserId = null;
  var HERO_AVATAR_COLORS = ['#a8e6cf', '#d4b5ff', '#a8d4f0', '#fff4b8', '#ffc8d4'];

  function getDefaultHeroIndex(userId) {
    if (!userId) return 1;
    var h = 0;
    var s = String(userId);
    for (var i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
    return (Math.abs(h) % 5) + 1;
  }

  function renderAvatar(containerEl, avatarUrl, size) {
    if (!containerEl) return;
    var isCard = size === 'card';
    var sizePx = isCard ? 64 : 56;
    if (avatarUrl) {
      containerEl.className = isCard ? 'profile-card-avatar profile-card-avatar--photo' : 'profile-avatar profile-avatar--photo';
      containerEl.innerHTML = '<img src="' + avatarUrl.replace(/"/g, '&quot;') + '" alt="">';
    } else {
      var heroIndex = getDefaultHeroIndex(currentUserId);
      var color = HERO_AVATAR_COLORS[heroIndex - 1] || HERO_AVATAR_COLORS[0];
      var heroSrc = '/media/hero-profiles/' + heroIndex + '.png';
      containerEl.className = isCard ? 'profile-card-avatar profile-card-avatar--default' : 'profile-avatar profile-avatar--default';
      containerEl.innerHTML = '<span class="profile-avatar-circle" style="--circle-color:' + color + '"><img src="' + heroSrc + '" alt=""></span>';
    }
  }

  function updateAvatars() {
    var url = currentProfile.avatar_url || '';
    renderAvatar(document.getElementById('profile-sidebar-avatar'), url, 'sidebar');
    renderAvatar(document.getElementById('profile-card-avatar'), url, 'card');
    var navEl = document.getElementById('sidebar-nav-avatar');
    if (navEl) {
      navEl.className = 'sidebar-user-avatar' + (url ? ' sidebar-user-avatar--photo' : ' sidebar-user-avatar--default');
      if (url) {
        navEl.innerHTML = '<img src="' + url.replace(/"/g, '&quot;') + '" alt="">';
      } else {
        var heroIndex = getDefaultHeroIndex(currentUserId);
        var color = HERO_AVATAR_COLORS[heroIndex - 1] || HERO_AVATAR_COLORS[0];
        navEl.innerHTML = '<span class="profile-avatar-circle" style="--circle-color:' + color + '"><img src="/media/hero-profiles/' + heroIndex + '.png" alt=""></span>';
      }
    }
  }

  function formatDate(str) {
    if (!str) return '—';
    try {
      var d = new Date(str);
      if (isNaN(d.getTime())) return str;
      var day = ('0' + d.getDate()).slice(-2);
      var month = ('0' + (d.getMonth() + 1)).slice(-2);
      var year = d.getFullYear();
      return day + '/' + month + '/' + year;
    } catch (e) {
      return str || '—';
    }
  }

  function dateToInputValue(str) {
    if (!str) return '';
    try {
      var d = new Date(str);
      if (isNaN(d.getTime())) return '';
      var y = d.getFullYear();
      var m = ('0' + (d.getMonth() + 1)).slice(-2);
      var day = ('0' + d.getDate()).slice(-2);
      return y + '-' + m + '-' + day;
    } catch (e) {
      return '';
    }
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value != null && value !== '' ? value : '—';
  }

  var trustStats = { first_subscription: false, subscription_12h: false, shared_30_days: false, invoices_count: 0 };

  function computeTrustCriteria() {
    var p = currentProfile;
    var done = {
      avatar: !!(p.avatar_url && p.avatar_url.trim()),
      phone: !!(p.phone && p.phone.trim()),
      email: true,
      date_of_birth: !!(p.date_of_birth && p.date_of_birth.trim()),
      first_subscription: trustStats.first_subscription,
      subscription_12h: trustStats.subscription_12h,
      shared_30_days: trustStats.shared_30_days,
      bank_account: false,
      identity_document: false,
      invoices: (trustStats.invoices_count || 0) >= 1
    };
    var total = 10;
    var score = [done.avatar, done.phone, done.email, done.date_of_birth, done.first_subscription, done.subscription_12h, done.shared_30_days, done.bank_account, done.identity_document, done.invoices].filter(Boolean).length;
    return { score: score, total: total, done: done };
  }

  function fillTrustScore() {
    var t = computeTrustCriteria();
    var scoreStr = t.score + '/' + t.total;
    setText('profile-trust-score-value', scoreStr);
    setText('profile-sidebar-trust-value', scoreStr);
    setText('profile-avatar-badge', String(t.score));
    var barEl = document.getElementById('profile-sidebar-trust-bar');
    if (barEl) barEl.style.width = (t.score / t.total * 100) + '%';
    var listEl = document.getElementById('profile-trust-criteria-list');
    if (listEl) {
      listEl.querySelectorAll('.profile-trust-criterion').forEach(function (li) {
        var key = li.getAttribute('data-criterion');
        var isDone = t.done[key];
        var isBanking = li.classList.contains('profile-trust-criterion--banking');
        var emojiEl = li.querySelector('.profile-trust-criterion-emoji');
        var statusEl = li.querySelector('.profile-trust-criterion-status');
        if (emojiEl) emojiEl.textContent = li.getAttribute('data-emoji') || '';
        if (statusEl) {
          if (isBanking) {
            statusEl.className = 'profile-trust-criterion-status profile-trust-criterion-status--disabled';
            statusEl.textContent = '—';
          } else {
            statusEl.className = 'profile-trust-criterion-status profile-trust-criterion-status--' + (isDone ? 'done' : 'pending');
            statusEl.textContent = isDone ? '✓' : '›';
          }
        }
        li.classList.toggle('profile-trust-criterion--done', isDone && !isBanking);
        li.classList.toggle('profile-trust-criterion--pending', !isDone && !isBanking);
        li.classList.toggle('profile-trust-criterion--clickable', !isBanking && li.getAttribute('data-action'));
      });
    }
    var invoicesMeta = document.getElementById('profile-trust-invoices-meta');
    if (invoicesMeta) invoicesMeta.textContent = ' (' + (trustStats.invoices_count || 0) + ' / 1)';
  }

  function showPanel(name) {
    var personal = document.getElementById('profile-panel-personal');
    var privacy = document.getElementById('profile-panel-privacy');
    var trust = document.getElementById('profile-panel-trust');
    var paymentPanel = document.getElementById('profile-panel-payment');
    var navItems = document.querySelectorAll('.profile-nav-item[data-panel]');
    var isPersonal = name === 'personal';
    var isPrivacy = name === 'privacy';
    var isTrust = name === 'trust';
    var isPayment = name === 'payment';
    if (personal) {
      personal.hidden = !isPersonal;
      personal.classList.toggle('profile-panel--active', isPersonal);
    }
    if (privacy) {
      privacy.hidden = !isPrivacy;
      privacy.classList.toggle('profile-panel--active', isPrivacy);
    }
    if (trust) {
      trust.hidden = !isTrust;
      trust.classList.toggle('profile-panel--active', isTrust);
      if (isTrust) fillTrustScore();
    }
    if (paymentPanel) {
      paymentPanel.hidden = !isPayment;
      paymentPanel.classList.toggle('profile-panel--active', isPayment);
    }
    navItems.forEach(function (item) {
      item.classList.toggle('profile-nav-item--active', item.getAttribute('data-panel') === name);
    });
    var cleanUrl = window.location.pathname + window.location.search;
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', cleanUrl);
    }
  }

  function fillProfileDisplay() {
    var p = currentProfile;
    var firstName = p.first_name || '';
    var lastName = p.last_name || '';
    var fullName = [firstName, lastName].filter(Boolean).join(' ') || '—';
    var email = p.email || '—';
    var username = p.alias || email || '—';
    var registeredStr = p.created_at ? 'Registered on Costlyf since ' + formatDate(p.created_at) : '—';

    setText('profile-username', username);
    setText('profile-registered', registeredStr);
    setText('profile-full-name', fullName);
    setText('profile-alias', p.alias);
    setText('profile-dob', p.date_of_birth ? formatDate(p.date_of_birth) : '—');
    setText('profile-email', email);
    setText('profile-phone', p.phone);
  }

  function exitEditMode(fieldWrap) {
    if (!fieldWrap) return;
    var field = fieldWrap.closest('.profile-field');
    if (field) field.classList.remove('profile-field-edit-mode');
    var wrap = field && field.querySelector('.profile-field-edit-wrap');
    if (wrap) wrap.remove();
  }

  function startEditMode(fieldEl) {
    var field = fieldEl.closest('.profile-field');
    var dataField = field && field.getAttribute('data-field');
    if (!dataField) return;
    if (field.classList.contains('profile-field-edit-mode')) return;

    var valueEl = field.querySelector('.profile-field-value');
    var wrap = document.createElement('div');
    wrap.className = 'profile-field-edit-wrap';

    if (dataField === 'full_name') {
      var first = (currentProfile.first_name || '').trim();
      var last = (currentProfile.last_name || '').trim();
      wrap.innerHTML = '<div class="profile-field-edit-row"><input type="text" data-key="first_name" placeholder="First name" value="' + (first ? first.replace(/"/g, '&quot;') : '') + '"><input type="text" data-key="last_name" placeholder="Last name" value="' + (last ? last.replace(/"/g, '&quot;') : '') + '"></div><div class="profile-edit-actions"><button type="button" class="profile-btn-save">Save</button><button type="button" class="profile-btn-cancel">Cancel</button></div>';
    } else if (dataField === 'date_of_birth') {
      var dobVal = dateToInputValue(currentProfile.date_of_birth || '');
      wrap.innerHTML = '<input type="date" data-key="date_of_birth" value="' + (dobVal ? dobVal.replace(/"/g, '&quot;') : '') + '"><div class="profile-edit-actions"><button type="button" class="profile-btn-save">Save</button><button type="button" class="profile-btn-cancel">Cancel</button></div>';
    } else {
      var key = dataField;
      var val = (currentProfile[key] || '').trim();
      var type = key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text';
      wrap.innerHTML = '<input type="' + type + '" data-key="' + key + '" value="' + (val ? val.replace(/"/g, '&quot;') : '') + '"><div class="profile-edit-actions"><button type="button" class="profile-btn-save">Save</button><button type="button" class="profile-btn-cancel">Cancel</button></div>';
    }

    valueEl.parentNode.insertBefore(wrap, valueEl.nextSibling);
    field.classList.add('profile-field-edit-mode');

    var saveBtn = wrap.querySelector('.profile-btn-save');
    var cancelBtn = wrap.querySelector('.profile-btn-cancel');

    cancelBtn.addEventListener('click', function () { exitEditMode(wrap); });

    saveBtn.addEventListener('click', function () {
      var payload = {};
      if (dataField === 'full_name') {
        var inputs = wrap.querySelectorAll('input[data-key]');
        inputs.forEach(function (inp) { payload[inp.getAttribute('data-key')] = inp.value.trim(); });
      } else {
        var input = wrap.querySelector('input[data-key]');
        if (input) payload[input.getAttribute('data-key')] = input.value.trim();
      }
      Auth.fetchWithAuth('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.error) return;
          if (data.first_name !== undefined) currentProfile.first_name = data.first_name;
          if (data.last_name !== undefined) currentProfile.last_name = data.last_name;
          if (data.alias !== undefined) currentProfile.alias = data.alias;
          if (data.date_of_birth !== undefined) currentProfile.date_of_birth = data.date_of_birth;
          if (data.email !== undefined) currentProfile.email = data.email;
          if (data.phone !== undefined) currentProfile.phone = data.phone;
          if (data.avatar_url !== undefined) currentProfile.avatar_url = data.avatar_url;
          fillProfileDisplay();
          fillTrustScore();
          exitEditMode(wrap);
        });
    });
  }

  (function init() {
    if (!window.Auth || !Auth.isLoggedIn()) {
      window.location.href = '/login';
      return;
    }

    var signOutBtn = document.getElementById('profile-sign-out');
    if (signOutBtn) {
      signOutBtn.addEventListener('click', function () {
        Auth.clearSession();
        window.location.href = '/';
      });
    }

    document.querySelectorAll('.profile-nav-item[data-panel]').forEach(function (item) {
      item.addEventListener('click', function (e) {
        e.preventDefault();
        var panel = item.getAttribute('data-panel');
        if (panel) showPanel(panel);
      });
    });
    var trustCardLink = document.getElementById('profile-trust-card-link');
    if (trustCardLink) {
      trustCardLink.addEventListener('click', function (e) {
        e.preventDefault();
        showPanel('trust');
      });
    }
    var trustCriteriaList = document.getElementById('profile-trust-criteria-list');
    if (trustCriteriaList) {
      trustCriteriaList.addEventListener('click', function (e) {
        var li = e.target.closest('.profile-trust-criterion--clickable');
        if (!li) return;
        var action = li.getAttribute('data-action');
        if (action === 'personal') {
          e.preventDefault();
          showPanel('personal');
        } else if (action === 'inbox') {
          window.location.href = '/inbox';
        } else if (action === 'wallet') {
          window.location.href = '/wallet';
        }
      });
    }

    showPanel('personal');

    var personalPanel = document.getElementById('profile-panel-personal');
    if (personalPanel) {
      personalPanel.addEventListener('click', function (e) {
        if (e.target.closest('.profile-field-edit')) startEditMode(e.target.closest('.profile-field-edit'));
      });
    }

    var passwordForm = document.getElementById('profile-change-password-form');
    if (passwordForm) {
      passwordForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var newPass = document.getElementById('profile-new-password').value;
        var confirmPass = document.getElementById('profile-confirm-password').value;
        var errEl = document.getElementById('profile-password-error');
        errEl.hidden = true;
        errEl.textContent = '';
        if (newPass.length < 6) {
          errEl.textContent = 'Password must be at least 6 characters.';
          errEl.hidden = false;
          return;
        }
        if (newPass !== confirmPass) {
          errEl.textContent = 'Passwords do not match.';
          errEl.hidden = false;
          return;
        }
        Auth.fetchWithAuth('/api/auth/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ new_password: newPass })
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data.error) {
              errEl.textContent = data.error;
              errEl.hidden = false;
              return;
            }
            errEl.textContent = '';
            errEl.hidden = true;
            passwordForm.reset();
            errEl.textContent = 'Password updated.';
            errEl.style.color = '#059669';
            errEl.hidden = false;
            setTimeout(function () { errEl.hidden = true; errEl.style.color = ''; }, 3000);
          });
      });
    }

    (function initPaymentPanel() {
      var cardWrap = document.getElementById('profile-payment-card-wrap');
      var errEl = document.getElementById('profile-payment-error');
      var successEl = document.getElementById('profile-payment-success');
      var addBtn = document.getElementById('profile-payment-add-card');
      if (!cardWrap || !addBtn) return;
      var paymentCardElement = null;
      var paymentStripe = null;
      var pendingSetupSecret = null;
      function showPaymentError(msg) {
        if (errEl) { errEl.textContent = msg || ''; errEl.hidden = !msg; }
        if (successEl) successEl.hidden = true;
      }
      function showPaymentSuccess(msg) {
        if (successEl) { successEl.textContent = msg || 'Card added.'; successEl.hidden = false; successEl.style.color = '#059669'; }
        if (errEl) errEl.hidden = true;
      }
      function loadStripeScript() {
        return new Promise(function (resolve) {
          if (window.Stripe) { resolve(window.Stripe); return; }
          var s = document.createElement('script');
          s.src = 'https://js.stripe.com/v3/';
          s.async = true;
          s.onload = function () { resolve(window.Stripe); };
          document.head.appendChild(s);
        });
      }
      addBtn.addEventListener('click', function () {
        if (pendingSetupSecret && paymentStripe && paymentCardElement) {
          addBtn.disabled = true;
          showPaymentError('');
          paymentStripe.confirmCardSetup(pendingSetupSecret, { payment_method: { card: paymentCardElement } })
            .then(function (result) {
              if (result.error) throw new Error(result.error.message || 'Failed to add card');
              showPaymentSuccess('Card added successfully.');
              cardWrap.innerHTML = '';
              paymentCardElement = null;
              paymentStripe = null;
              pendingSetupSecret = null;
              addBtn.textContent = 'Add card';
            })
            .catch(function (e) { showPaymentError(e.message || 'Could not add card'); })
            .then(function () { addBtn.disabled = false; });
          return;
        }
        addBtn.disabled = true;
        showPaymentError('');
        Auth.fetchWithAuth('/api/wallet/setup-intent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data.error) throw new Error(data.error);
            if (!data.client_secret || !data.publishableKey) throw new Error('Missing Stripe keys');
            return loadStripeScript().then(function (Stripe) {
              paymentStripe = Stripe(data.publishableKey);
              cardWrap.innerHTML = '';
              paymentCardElement = paymentStripe.elements().create('card', { style: { base: { fontSize: '16px' } }, disableLink: true });
              paymentCardElement.mount(cardWrap);
              pendingSetupSecret = data.client_secret;
              addBtn.textContent = 'Save card';
              addBtn.disabled = false;
            });
          })
          .catch(function (e) {
            showPaymentError(e.message || 'Could not add card.');
            addBtn.disabled = false;
          });
      });
    })();

    var avatarTrigger = document.getElementById('profile-card-avatar-trigger');
    var avatarInput = document.getElementById('profile-avatar-input');
    if (avatarTrigger && avatarInput) {
      avatarTrigger.addEventListener('click', function () { avatarInput.click(); });
      avatarInput.addEventListener('change', function () {
        var file = avatarInput.files && avatarInput.files[0];
        if (!file) return;
        var fd = new FormData();
        fd.append('avatar', file);
        var token = Auth.getToken && Auth.getToken();
        var headers = {};
        if (token) headers['Authorization'] = 'Bearer ' + token;
        fetch('/api/profile/avatar', { method: 'POST', headers: headers, body: fd })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (data.error) return;
            if (data.avatar_url) {
              currentProfile.avatar_url = data.avatar_url;
              updateAvatars();
              fillTrustScore();
            }
          });
        avatarInput.value = '';
      });
    }

    Auth.fetchWithAuth('/api/auth/me')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) {
          if (data.error.indexOf('token') !== -1 || data.error.indexOf('Unauthorized') !== -1) {
            Auth.clearSession();
            window.location.href = '/login';
          }
          return;
        }
        var profile = data.profile || {};
        var user = data.user || {};
        currentUserId = user.id || null;
        if (data.trust_stats) {
          trustStats.first_subscription = !!data.trust_stats.first_subscription;
          trustStats.subscription_12h = !!data.trust_stats.subscription_12h;
          trustStats.shared_30_days = !!data.trust_stats.shared_30_days;
          trustStats.invoices_count = parseInt(data.trust_stats.invoices_count, 10) || 0;
        }
        currentProfile = {
          email: profile.email || user.email || '',
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          alias: profile.alias || '',
          phone: profile.phone || '',
          date_of_birth: profile.date_of_birth || '',
          created_at: profile.created_at,
          avatar_url: profile.avatar_url || ''
        };
        var username = currentProfile.alias || currentProfile.email || '—';
        var registeredStr = currentProfile.created_at ? 'Registered on Costlyf since ' + formatDate(currentProfile.created_at) : '—';

        setText('profile-username', username);
        setText('profile-registered', registeredStr);
        fillProfileDisplay();
        updateAvatars();
        fillTrustScore();
      })
      .catch(function () {
        Auth.clearSession();
        window.location.href = '/login';
      });
  })();
})();
