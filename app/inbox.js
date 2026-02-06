(function () {
  'use strict';

  function getToken() {
    return (window.Auth && window.Auth.getToken) ? window.Auth.getToken() : (typeof localStorage !== 'undefined' ? localStorage.getItem('costlyf_access_token') : null);
  }
  function fetchWithAuth(url, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    var token = getToken();
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    return (window.Auth && window.Auth.fetchWithAuth) ? window.Auth.fetchWithAuth(url, opts) : fetch(url, opts);
  }

  var SYSTEM_THREAD_ID = 'system';

  function getThreadIdFromHash() {
    var hash = (window.location.hash || '').slice(1);
    if (hash === 'thread-' + SYSTEM_THREAD_ID) return SYSTEM_THREAD_ID;
    if (hash.indexOf('thread-') === 0) return hash.slice(7);
    return null;
  }

  var listView = document.getElementById('inbox-list-view');
  var chatView = document.getElementById('inbox-chat-view');
  var contactsEl = document.getElementById('inbox-contacts');
  var emptyEl = document.getElementById('inbox-empty');
  var chatNameEl = document.getElementById('inbox-chat-name');
  var chatSubEl = document.getElementById('inbox-chat-subscription');
  var messagesEl = document.getElementById('inbox-chat-messages');
  var inputEl = document.getElementById('inbox-chat-input');
  var sendBtn = document.getElementById('inbox-chat-send');
  var inputBarEl = document.getElementById('inbox-chat-input-bar');

  var threads = [];
  var currentThreadId = null;
  var currentThread = null;
  var systemUnreadCount = 0;
  var myAvatarUrl = '';
  var myUserId = null;
  var HERO_AVATAR_COLORS = ['#a8e6cf', '#d4b5ff', '#a8d4f0', '#fff4b8', '#ffc8d4'];
  var SENT_CHECK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" class="subscription-chat-msg-check-svg"><g fill="none" fill-rule="evenodd"><path d="m12.593 23.258l-.011.002l-.071.035l-.02.004l-.014-.004l-.071-.035q-.016-.005-.024.005l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.017-.018m.265-.113l-.013.002l-.185.093l-.01.01l-.003.011l.018.43l.005.012l.008.007l.201.093q.019.005.029-.008l.004-.014l-.034-.614q-.005-.018-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.004-.011l.017-.43l-.003-.012l-.01-.01z"/><path fill="currentColor" d="M21.546 5.111a1.5 1.5 0 0 1 0 2.121L10.303 18.475a1.6 1.6 0 0 1-2.263 0L2.454 12.89a1.5 1.5 0 1 1 2.121-2.121l4.596 4.596L19.424 5.111a1.5 1.5 0 0 1 2.122 0"/></g></svg>';
  var SEEN_CHECK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" class="subscription-chat-msg-check-svg"><g fill="none"><path d="m12.594 23.258l-.012.002l-.071.035l-.02.004l-.014-.004l-.071-.036q-.016-.004-.024.006l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.016-.018m.264-.113l-.014.002l-.184.093l-.01.01l-.003.011l.018.43l.005.012l.008.008l.201.092q.019.005.029-.008l.004-.014l-.034-.614q-.005-.019-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.003-.011l.018-.43l-.003-.012l-.01-.01z"/><path fill="currentColor" d="M2.222 11.121a1 1 0 0 1 1.32-.083l.094.083l4.242 4.243a1 1 0 0 1-1.32 1.497l-.094-.083l-4.242-4.242a1 1 0 0 1 0-1.415m20.556-5.656a1 1 0 0 1 .083 1.32l-.083.094l-9.829 9.828a1.1 1.1 0 0 1-1.46.086l-.096-.085l-4.171-4.172a1 1 0 0 1 1.32-1.498l.094.083l3.535 3.536l9.193-9.192a1 1 0 0 1 1.414 0m-5 0a1 1 0 0 1 .083 1.32l-.083.094l-4.95 4.95a1 1 0 0 1-1.497-1.32l.083-.095l4.95-4.95a1 1 0 0 1 1.414 0Z"/></g></svg>';

  function getDefaultHeroIndex(seed) {
    if (seed == null || seed === '') return 1;
    var h = 0;
    var s = String(seed);
    for (var i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0;
    return (Math.abs(h) % 5) + 1;
  }

  function buildAvatarHtml(avatarUrl, seed) {
    if (avatarUrl && avatarUrl.trim()) {
      return '<span class="subscription-chat-msg-avatar subscription-chat-msg-avatar--img"><img src="' + escapeHtml(avatarUrl) + '" alt=""></span>';
    }
    var heroIndex = getDefaultHeroIndex(seed);
    var color = HERO_AVATAR_COLORS[heroIndex - 1] || HERO_AVATAR_COLORS[0];
    var heroSrc = '/media/hero-profiles/' + heroIndex + '.png';
    return '<span class="subscription-chat-msg-avatar subscription-chat-msg-avatar--default" style="--circle-color:' + escapeHtml(color) + '"><span class="inbox-avatar-circle"><img src="' + heroSrc + '" alt=""></span></span>';
  }

  function buildContactAvatarHtml(t) {
    var avatarUrl = t && t.other_avatar_url && t.other_avatar_url.trim();
    if (avatarUrl) {
      return '<span class="inbox-contact-avatar inbox-contact-avatar--img" aria-hidden="true"><img src="' + escapeHtml(avatarUrl) + '" alt=""></span>';
    }
    var heroIndex = getDefaultHeroIndex(t && t.other_name);
    var color = HERO_AVATAR_COLORS[heroIndex - 1] || HERO_AVATAR_COLORS[0];
    var heroSrc = '/media/hero-profiles/' + heroIndex + '.png';
    return '<span class="inbox-contact-avatar inbox-contact-avatar--default" aria-hidden="true" style="--circle-color:' + escapeHtml(color) + '"><span class="inbox-avatar-circle"><img src="' + escapeHtml(heroSrc) + '" alt=""></span></span>';
  }

  function escapeHtml(s) {
    var div = document.createElement('div');
    div.textContent = s == null ? '' : s;
    return div.innerHTML;
  }

  function formatTime(date) {
    var d = date instanceof Date ? date : new Date(date);
    var h = d.getHours();
    var m = d.getMinutes();
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  function loadThreads(done) {
    fetchWithAuth('/api/chat/threads', {})
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) {
        threads = Array.isArray(data) ? data : [];
        if (done) done();
      })
      .catch(function () {
        threads = [];
        if (done) done();
      });
  }

  function loadSystemUnread(done) {
    fetchWithAuth('/api/chat/system-messages', {})
      .then(function (r) { return r.ok ? r.json() : { messages: [], unread_count: 0 }; })
      .then(function (data) {
        systemUnreadCount = data.unread_count != null ? data.unread_count : 0;
        if (done) done();
      })
      .catch(function () {
        systemUnreadCount = 0;
        if (done) done();
      });
  }

  function loadSystemMessages(markRead, done) {
    var url = '/api/chat/system-messages';
    if (markRead) url += '?mark_read=1';
    fetchWithAuth(url, {})
      .then(function (r) { return r.ok ? r.json() : { messages: [], unread_count: 0 }; })
      .then(function (data) {
        if (markRead) systemUnreadCount = 0;
        else systemUnreadCount = data.unread_count != null ? data.unread_count : 0;
        if (done) done(data.messages || []);
      })
      .catch(function () {
        if (done) done([]);
      });
  }

  function renderSystemMessages(messages) {
    if (!messagesEl) return;
    if (!messages || messages.length === 0) {
      messagesEl.innerHTML = '<p class="subscription-chat-placeholder">No system messages yet.</p>';
      return;
    }
    messagesEl.innerHTML = messages.map(function (m) {
      return '<div class="subscription-chat-msg subscription-chat-msg--system"><div class="subscription-chat-msg-content">' +
        '<span class="subscription-chat-msg-text">' + escapeHtml(m.content || '') + '</span></div></div>';
    }).join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function setInputLocked(locked) {
    if (inputBarEl) inputBarEl.classList.toggle('inbox-chat-input-bar--locked', locked);
    if (inputEl) {
      inputEl.disabled = locked;
      inputEl.placeholder = locked ? "You can't reply to the system." : 'Just Type Something.';
    }
  }

  function renderList() {
    var systemCard = '<a href="/inbox#thread-' + SYSTEM_THREAD_ID + '" class="inbox-contact-card">' +
      '<span class="inbox-contact-avatar inbox-contact-avatar--default" aria-hidden="true" style="--circle-color:#ffc8d4"><span class="inbox-avatar-circle"><img src="/media/hero-profiles/5.png" alt=""></span></span>' +
      '<span class="inbox-contact-info"><span class="inbox-contact-name">CostLyf Team</span><span class="inbox-contact-subscription">Notifications and updates</span></span>' +
      (systemUnreadCount > 0 ? '<span class="inbox-contact-unread">' + (systemUnreadCount > 99 ? '99+' : systemUnreadCount) + '</span>' : '') +
      '<span class="inbox-contact-chevron">›</span></a>';
    if (threads.length === 0 && systemUnreadCount === 0) {
      if (emptyEl) emptyEl.hidden = false;
      if (contactsEl) contactsEl.innerHTML = systemCard;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;
    contactsEl.innerHTML = systemCard + threads.map(function (t) {
      var subHtml = (t.subscription_label && t.subscription_label.trim())
        ? '<span class="inbox-contact-subscription">' + escapeHtml(t.subscription_label) + '</span>'
        : '';
      var unreadHtml = (t.unread_count > 0) ? '<span class="inbox-contact-unread">' + (t.unread_count > 99 ? '99+' : t.unread_count) + '</span>' : '';
      return (
        '<a href="/inbox#thread-' + escapeHtml(t.id) + '" class="inbox-contact-card">' +
          buildContactAvatarHtml(t) +
          '<span class="inbox-contact-info">' +
            '<span class="inbox-contact-name">' + escapeHtml(t.other_name || 'User') + '</span>' +
            subHtml +
          '</span>' +
          unreadHtml +
          '<span class="inbox-contact-chevron">›</span>' +
        '</a>'
      );
    }).join('');
  }

  function renderMessagesFromApi(messages) {
    if (!messagesEl) return;
    if (!messages || messages.length === 0) {
      messagesEl.innerHTML = '<p class="subscription-chat-placeholder">No messages yet. Say hello.</p>';
      return;
    }
    messagesEl.innerHTML = messages.map(function (m) {
      var isSystem = m.is_system || m.sender_id == null;
      if (isSystem) {
        return '<div class="subscription-chat-msg subscription-chat-msg--system"><div class="subscription-chat-msg-content">' +
          '<span class="subscription-chat-msg-text">' + escapeHtml(m.content || '') + '</span></div></div>';
      }
      var isMe = m.sender_id === myUserId;
      var cls = isMe ? 'subscription-chat-msg subscription-chat-msg--me' : 'subscription-chat-msg subscription-chat-msg--owner';
      var time = formatTime(m.created_at);
      var avatar = isMe ? buildAvatarHtml(myAvatarUrl, myUserId) : buildAvatarHtml(currentThread && currentThread.other_avatar_url, currentThread && currentThread.other_name);
      var bubble = '<span class="subscription-chat-msg-text">' + escapeHtml(m.content || '') + '</span>';
      var checksHtml = '';
      if (isMe) {
        var seen = m.read_at && m.read_at.trim();
        var checkSvg = seen ? SEEN_CHECK_SVG : SENT_CHECK_SVG;
        var checkClass = seen ? 'subscription-chat-msg-check subscription-chat-msg-check--seen' : 'subscription-chat-msg-check';
        checksHtml = '<span class="subscription-chat-msg-checks" aria-hidden="true"><span class="' + checkClass + '">' + checkSvg + '</span></span>';
      }
      var meta = '<span class="subscription-chat-msg-meta"><span class="subscription-chat-msg-time">' + escapeHtml(time) + '</span>' + checksHtml + '</span>';
      return '<div class="' + cls + '">' + avatar + '<div class="subscription-chat-msg-content">' + bubble + meta + '</div></div>';
    }).join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function loadMessagesForThread(threadId, done) {
    fetchWithAuth('/api/chat/threads/' + encodeURIComponent(threadId) + '/messages', {})
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) {
        currentThreadMessages = Array.isArray(data) ? data : [];
        renderMessagesFromApi(currentThreadMessages);
        renderChatActions();
        loadThreads(function () {
          renderList();
          if (window.updateInboxUnreadBadge) window.updateInboxUnreadBadge();
        });
        if (done) done();
      })
      .catch(function () {
        currentThreadMessages = [];
        renderMessagesFromApi([]);
        renderChatActions();
        if (done) done();
      });
  }

  function updateChatHeaderAvatar() {
    var headerAvatarEl = document.getElementById('inbox-chat-header-avatar');
    if (!headerAvatarEl) return;
    if (!currentThread) {
      headerAvatarEl.innerHTML = '';
      headerAvatarEl.className = 'inbox-chat-header-avatar';
      return;
    }
    var avatarUrl = currentThread.other_avatar_url;
    var seed = currentThread.other_name;
    if (avatarUrl && avatarUrl.trim()) {
      headerAvatarEl.className = 'inbox-chat-header-avatar inbox-chat-header-avatar--img';
      headerAvatarEl.innerHTML = '<img src="' + escapeHtml(avatarUrl) + '" alt="">';
    } else {
      var heroIndex = (currentThreadId === SYSTEM_THREAD_ID) ? 5 : getDefaultHeroIndex(seed);
      var color = HERO_AVATAR_COLORS[heroIndex - 1] || HERO_AVATAR_COLORS[0];
      headerAvatarEl.className = 'inbox-chat-header-avatar inbox-chat-header-avatar--default';
      headerAvatarEl.innerHTML = '<span class="inbox-avatar-circle" style="--circle-color:' + escapeHtml(color) + '"><img src="/media/hero-profiles/' + heroIndex + '.png" alt=""></span>';
    }
  }

  function updateSendVisibility() {
    if (!sendBtn) return;
    if (currentThreadId === SYSTEM_THREAD_ID) return;
    var hasText = (inputEl.value || '').trim().length > 0;
    sendBtn.classList.toggle('subscription-chat-send--hidden', !hasText);
  }

  function sendMessage() {
    if (currentThreadId === SYSTEM_THREAD_ID) return;
    var text = (inputEl.value || '').trim();
    if (!text || !currentThreadId) return;
    fetchWithAuth('/api/chat/threads/' + encodeURIComponent(currentThreadId) + '/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text })
    })
      .then(function (r) {
        if (r.ok) return r.json();
        return r.json().then(function (d) { throw new Error(d.error || 'Send failed'); });
      })
      .then(function (msg) {
        inputEl.value = '';
        updateSendVisibility();
        loadMessagesForThread(currentThreadId);
      })
      .catch(function (e) {
        alert(e.message || 'Could not send message');
      });
  }

  var currentOfferForThread = null;
  var currentThreadMessages = [];

  var CONFIRM_CREDENTIALS_TEXT = 'I confirm I received the credentials and everything is working.';

  function hasUserConfirmedCredentials(messages) {
    if (!messages || !myUserId) return false;
    var myId = String(myUserId);
    return messages.some(function (m) {
      return m.sender_id && String(m.sender_id) === myId && (m.content || '').indexOf('I confirm I received the credentials') !== -1;
    });
  }

  function renderChatActions() {
    var actionsEl = document.getElementById('inbox-chat-actions');
    if (!actionsEl || !currentThread || !currentOfferForThread) {
      if (actionsEl) { actionsEl.hidden = true; actionsEl.innerHTML = ''; }
      return;
    }
    var offer = currentOfferForThread;
    var slots = offer.slots || [];
    var myId = myUserId != null ? String(myUserId) : '';
    var otherId = (currentThread && currentThread.other_user_id) != null ? String(currentThread.other_user_id) : '';
    var ownerId = (offer.owner_id != null) ? String(offer.owner_id) : '';
    var isOwner = ownerId && myId && ownerId === myId;
    var reservedSlotForOther = slots.filter(function (s) { return s.status === 'reserved' && s.user_id && String(s.user_id) === otherId; })[0];
    var mySlot = slots.filter(function (s) { return (s.status === 'reserved' || s.status === 'taken') && s.user_id && String(s.user_id) === myId; })[0];
    var slotBelongsToMe = !!mySlot;
    var alreadyConfirmed = hasUserConfirmedCredentials(currentThreadMessages);
    actionsEl.hidden = false;
    if (isOwner && reservedSlotForOther) {
      actionsEl.innerHTML = '<p class="inbox-chat-actions-hint">Accept to add this person as a co-subscriber; Decline to cancel their request.</p>' +
        '<div class="inbox-chat-actions-buttons">' +
        '<button type="button" class="inbox-chat-action-btn inbox-chat-action-btn--primary" id="inbox-chat-accept">Accept</button>' +
        '<button type="button" class="inbox-chat-action-btn inbox-chat-action-btn--danger" id="inbox-chat-decline">Decline</button>' +
        '</div>';
      var acceptBtn = document.getElementById('inbox-chat-accept');
      var declineBtn = document.getElementById('inbox-chat-decline');
      if (acceptBtn) acceptBtn.addEventListener('click', function () {
        fetchWithAuth('/api/offers/' + encodeURIComponent(offer.id) + '/slots/' + reservedSlotForOther.slot_index + '/accept', { method: 'POST' })
          .then(function (r) {
            if (r.ok) {
              loadOfferAndActions();
              loadMessagesForThread(currentThreadId);
              loadThreads(function () { renderList(); });
              if (window.updateInboxUnreadBadge) window.updateInboxUnreadBadge();
            } else return r.json().then(function (d) { throw new Error(d.error); });
          })
          .catch(function (e) { alert(e.message); });
      });
      if (declineBtn) declineBtn.addEventListener('click', function () {
        fetchWithAuth('/api/offers/' + encodeURIComponent(offer.id) + '/slots/' + reservedSlotForOther.slot_index + '/decline', { method: 'POST' })
          .then(function (r) { if (r.ok) { loadOfferAndActions(); loadThreads(function () { renderList(); }); if (window.updateInboxUnreadBadge) window.updateInboxUnreadBadge(); } else return r.json().then(function (d) { throw new Error(d.error); }); })
          .catch(function (e) { alert(e.message); });
      });
    } else if (!isOwner && slotBelongsToMe && !alreadyConfirmed) {
      actionsEl.innerHTML = '<p class="inbox-chat-actions-hint">Confirm that you received the credentials and everything works, or contact Support if you need help.</p>' +
        '<div class="inbox-chat-actions-buttons">' +
        '<button type="button" class="inbox-chat-action-btn inbox-chat-action-btn--primary" id="inbox-chat-confirm">Confirm</button>' +
        '<a href="/help" class="inbox-chat-action-btn inbox-chat-action-btn--secondary" id="inbox-chat-support">Support</a>' +
        '</div>';
      var confirmBtn = document.getElementById('inbox-chat-confirm');
      if (confirmBtn) confirmBtn.addEventListener('click', function () {
        fetchWithAuth('/api/chat/threads/' + encodeURIComponent(currentThreadId) + '/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: CONFIRM_CREDENTIALS_TEXT })
        }).then(function (r) {
          if (r.ok) loadMessagesForThread(currentThreadId, function () { renderChatActions(); });
        });
      });
    } else {
      actionsEl.hidden = true;
      actionsEl.innerHTML = '';
    }
  }

  function loadOfferAndActions() {
    if (!currentThread || !currentThread.offer_id) { currentOfferForThread = null; renderChatActions(); return; }
    fetchWithAuth('/api/offers/' + encodeURIComponent(currentThread.offer_id), {})
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (offer) {
        currentOfferForThread = offer;
        renderChatActions();
      });
  }

  function showChat(threadId) {
    var t = threads.filter(function (x) { return x.id === threadId; })[0];
    if (!t) {
      showList();
      return;
    }
    currentThreadId = threadId;
    currentThread = t;
    currentOfferForThread = null;
    setInputLocked(false);
    if (chatNameEl) chatNameEl.textContent = t.other_name || '—';
    if (chatSubEl) {
      chatSubEl.textContent = t.subscription_label || '';
      chatSubEl.hidden = !(t.subscription_label && t.subscription_label.trim());
    }
    listView.hidden = true;
    chatView.hidden = false;
    updateChatHeaderAvatar();
    loadMessagesForThread(threadId);
    loadOfferAndActions();
    if (inputEl) inputEl.value = '';
    updateSendVisibility();
  }

  function showSystemChat() {
    currentThreadId = SYSTEM_THREAD_ID;
    currentThread = { other_name: 'CostLyf Team', other_avatar_url: null };
    currentOfferForThread = null;
    setInputLocked(true);
    if (chatNameEl) chatNameEl.textContent = 'CostLyf Team';
    if (chatSubEl) { chatSubEl.textContent = ''; chatSubEl.hidden = true; }
    listView.hidden = true;
    chatView.hidden = false;
    updateChatHeaderAvatar();
    var actionsEl = document.getElementById('inbox-chat-actions');
    if (actionsEl) { actionsEl.hidden = true; actionsEl.innerHTML = ''; }
    loadSystemMessages(true, function (messages) {
      renderSystemMessages(messages);
      renderList();
      if (window.updateInboxUnreadBadge) window.updateInboxUnreadBadge();
    });
    if (inputEl) inputEl.value = '';
    if (sendBtn) sendBtn.classList.add('subscription-chat-send--hidden');
  }

  function showList() {
    currentThreadId = null;
    currentThread = null;
    currentThreadMessages = [];
    setInputLocked(false);
    listView.hidden = false;
    chatView.hidden = true;
  }

  function updateView() {
    var threadId = getThreadIdFromHash();
    if (threadId === SYSTEM_THREAD_ID) {
      showSystemChat();
      return;
    }
    if (threadId && threads.some(function (t) { return t.id === threadId; })) {
      showChat(threadId);
    } else {
      showList();
      if (threadId) window.history.replaceState(null, '', '/inbox');
    }
  }

  function loadThreadsAndSystemThenRender(done) {
    loadThreads(function () {
      loadSystemUnread(function () {
        renderList();
        if (done) done();
      });
    });
  }

  function ensureThreadForOffer(offerId, done) {
    fetchWithAuth('/api/offers/' + encodeURIComponent(offerId), {})
      .then(function (r) {
        if (!r.ok) throw new Error('Offer not found');
        return r.json();
      })
      .then(function (offer) {
        var ownerId = offer.owner_id;
        if (!ownerId) throw new Error('Invalid offer');
        return fetchWithAuth('/api/chat/threads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offer_id: offerId, other_user_id: ownerId })
        });
      })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || 'Failed'); });
        return r.json();
      })
      .then(function (thread) {
        var exists = threads.some(function (t) { return t.id === thread.id; });
        if (!exists) threads.unshift(thread);
        if (done) done(thread);
      })
      .catch(function (e) {
        alert(e.message || 'Could not open chat');
        if (done) done(null);
      });
  }

  inputEl.addEventListener('input', updateSendVisibility);
  sendBtn.addEventListener('click', sendMessage);
  var emojiOkBtn = document.getElementById('inbox-chat-emoji-ok');
  if (emojiOkBtn) {
    emojiOkBtn.addEventListener('click', function () {
      if (!currentThreadId) return;
      inputEl.value = '👌';
      sendMessage();
    });
  }
  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  });

  window.addEventListener('hashchange', updateView);

  var INBOX_POLL_INTERVAL_MS = 5000;
  var inboxPollTimerId = null;

  function pollInbox() {
    loadThreads(function () {
      loadSystemUnread(function () {
        renderList();
        if (currentThreadId && chatView && !chatView.hidden) {
          if (currentThreadId === SYSTEM_THREAD_ID) {
            loadSystemMessages(false, function (messages) { renderSystemMessages(messages); });
          } else {
            var updated = threads.filter(function (t) { return t.id === currentThreadId; })[0];
            if (updated) currentThread = updated;
            loadMessagesForThread(currentThreadId);
            loadOfferAndActions();
          }
        }
      });
      if (window.updateInboxUnreadBadge) window.updateInboxUnreadBadge();
    });
  }

  function startInboxPolling() {
    if (inboxPollTimerId) return;
    inboxPollTimerId = setInterval(pollInbox, INBOX_POLL_INTERVAL_MS);
  }

  function stopInboxPolling() {
    if (inboxPollTimerId) {
      clearInterval(inboxPollTimerId);
      inboxPollTimerId = null;
    }
  }

  function init() {
    var params = new URLSearchParams(window.location.search);
    var offerId = params.get('offerId');

    function afterThreadsAndSystem() {
      if (offerId && offerId.trim()) {
        ensureThreadForOffer(offerId.trim(), function (thread) {
          if (thread) {
            window.location.hash = 'thread-' + thread.id;
            updateView();
            if (window.history && window.history.replaceState) {
              window.history.replaceState(null, '', '/inbox#thread-' + thread.id);
            }
          }
          startInboxPolling();
          if (window.hideAppLoading) window.hideAppLoading();
        });
        return;
      }
      updateView();
      startInboxPolling();
      if (window.hideAppLoading) window.hideAppLoading();
    }

    if (getToken()) {
      fetchWithAuth('/api/auth/me', {})
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (data && data.profile && data.profile.avatar_url) myAvatarUrl = data.profile.avatar_url;
          if (data && data.user && data.user.id) myUserId = data.user.id;
          loadThreadsAndSystemThenRender(afterThreadsAndSystem);
        })
        .catch(function () {
          loadThreadsAndSystemThenRender(afterThreadsAndSystem);
        });
    } else {
      loadThreadsAndSystemThenRender(afterThreadsAndSystem);
    }
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopInboxPolling();
    else startInboxPolling();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
