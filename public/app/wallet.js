(function () {
  'use strict';

  function getToken() {
    return (window.Auth && window.Auth.getToken && window.Auth.getToken()) || (typeof localStorage !== 'undefined' ? localStorage.getItem('costlyf_access_token') : null) || '';
  }
  function fetchWithAuth(url, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    var token = getToken();
    if (token) opts.headers.Authorization = 'Bearer ' + token;
    return (window.Auth && window.Auth.fetchWithAuth) ? window.Auth.fetchWithAuth(url, opts) : fetch(url, opts);
  }

  var balanceEl = document.getElementById('wallet-balance-display');
  var modal = document.getElementById('wallet-topup-modal');
  var topupPayAmountEl = document.getElementById('wallet-topup-pay-amount');
  var stripeCardWrap = document.getElementById('wallet-stripe-card-wrap');
  var topupErrorEl = document.getElementById('wallet-topup-error');
  var payBtn = document.getElementById('wallet-topup-pay');
  var cancelBtn = document.getElementById('wallet-topup-cancel');
  var selectedCents = 5000;
  var stripeInstance = null;
  var cardElement = null;

  function formatEuros(cents) {
    if (cents == null) return '0€';
    return (cents / 100).toFixed(2).replace('.', ',') + '€';
  }

  function loadBalance() {
    if (!balanceEl) return;
    fetchWithAuth('/api/wallet/balance')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && data.balance_cents != null) {
          balanceEl.textContent = formatEuros(data.balance_cents);
        } else {
          balanceEl.textContent = '0€';
        }
      })
      .catch(function () { balanceEl.textContent = '0€'; });
  }

  function showError(msg) {
    if (topupErrorEl) {
      topupErrorEl.textContent = msg || '';
      topupErrorEl.hidden = !msg;
    }
  }

  function loadStripeScript() {
    return new Promise(function (resolve) {
      if (window.Stripe) {
        resolve(window.Stripe);
        return;
      }
      var s = document.createElement('script');
      s.src = 'https://js.stripe.com/v3/';
      s.async = true;
      s.onload = function () { resolve(window.Stripe); };
      document.head.appendChild(s);
    });
  }

  function openTopupModal() {
    if (!modal) return;
    selectedCents = 5000;
    if (topupPayAmountEl) topupPayAmountEl.textContent = (selectedCents / 100);
    document.querySelectorAll('.wallet-topup-amount-btn').forEach(function (btn) {
      btn.classList.toggle('wallet-topup-amount-btn--active', parseInt(btn.getAttribute('data-cents'), 10) === selectedCents);
    });
    showError('');
    stripeCardWrap.innerHTML = '';
    cardElement = null;
    modal.hidden = false;
  }

  function closeTopupModal() {
    if (modal) modal.hidden = true;
  }

  function doTopupPay() {
    if (!payBtn || !stripeCardWrap) return;
    payBtn.disabled = true;
    showError('');
    fetchWithAuth('/api/wallet/topup-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount_cents: selectedCents })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        if (!data.client_secret || !data.publishableKey) throw new Error('Missing Stripe keys');
        return loadStripeScript().then(function (Stripe) {
          stripeInstance = Stripe(data.publishableKey);
          if (!cardElement) {
            var elements = stripeInstance.elements();
            cardElement = elements.create('card', { style: { base: { fontSize: '16px' } } });
            cardElement.mount(stripeCardWrap);
          }
          return stripeInstance.confirmCardPayment(data.client_secret, {
            payment_method: { card: cardElement }
          });
        });
      })
      .then(function (result) {
        if (result.error) throw new Error(result.error.message || 'Payment failed');
        closeTopupModal();
        loadBalance();
      })
      .catch(function (e) {
        showError(e.message || 'Something went wrong');
      })
      .then(function () {
        if (payBtn) payBtn.disabled = false;
      });
  }

  loadBalance();

  var topupBtn = document.getElementById('wallet-topup-btn');
  if (topupBtn) topupBtn.addEventListener('click', openTopupModal);

  var bankBtn = document.getElementById('wallet-bank-btn');
  if (bankBtn) bankBtn.addEventListener('click', function () {
    alert('Bank transfer is not available yet. Please use Top-up with a card.');
  });

  if (cancelBtn) cancelBtn.addEventListener('click', closeTopupModal);
  if (modal && modal.querySelector('.wallet-modal-backdrop')) {
    modal.querySelector('.wallet-modal-backdrop').addEventListener('click', closeTopupModal);
  }
  if (payBtn) payBtn.addEventListener('click', doTopupPay);

  document.querySelectorAll('.wallet-topup-amount-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      selectedCents = parseInt(btn.getAttribute('data-cents'), 10);
      if (topupPayAmountEl) topupPayAmountEl.textContent = (selectedCents / 100);
      document.querySelectorAll('.wallet-topup-amount-btn').forEach(function (b) {
        b.classList.toggle('wallet-topup-amount-btn--active', parseInt(b.getAttribute('data-cents'), 10) === selectedCents);
      });
    });
  });
})();
