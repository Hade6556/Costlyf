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

  var balanceEl, modal, step1, step2, topupPayAmountEl, step2AmountEl, stripeCardWrap, stripeCardNumberWrap, stripeCardExpiryWrap, stripeCardCvcWrap, topupErrorEl, payBtn, cancelBtn, nextBtn, backBtn;
  var selectedCents = 5000;
  var stripeInstance = null;
  var cardNumberElement = null;
  var pendingClientSecret = null;

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

  function showStep1() {
    if (nextBtn) nextBtn.focus();
    if (step2) step2.classList.add('wallet-topup-step--hidden');
    if (step1) step1.classList.remove('wallet-topup-step--hidden');
  }

  function showStep2() {
    if (backBtn) backBtn.focus();
    if (step1) step1.classList.add('wallet-topup-step--hidden');
    if (step2) step2.classList.remove('wallet-topup-step--hidden');
  }

  function openTopupModal() {
    if (!modal) return;
    selectedCents = 5000;
    pendingClientSecret = null;
    if (topupPayAmountEl) topupPayAmountEl.textContent = (selectedCents / 100);
    if (step2AmountEl) step2AmountEl.textContent = (selectedCents / 100);
    document.querySelectorAll('.wallet-topup-amount-btn').forEach(function (btn) {
      btn.classList.toggle('wallet-topup-amount-btn--active', parseInt(btn.getAttribute('data-cents'), 10) === selectedCents);
    });
    showError('');
    if (stripeCardNumberWrap) stripeCardNumberWrap.innerHTML = '';
    if (stripeCardExpiryWrap) stripeCardExpiryWrap.innerHTML = '';
    if (stripeCardCvcWrap) stripeCardCvcWrap.innerHTML = '';
    cardNumberElement = null;
    stripeInstance = null;
    showStep1();
    modal.hidden = false;
  }

  function closeTopupModal() {
    if (modal) modal.hidden = true;
    showStep1();
  }

  function doTopupNext() {
    if (!nextBtn || !stripeCardNumberWrap) return;
    nextBtn.disabled = true;
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
          if (stripeCardNumberWrap) stripeCardNumberWrap.innerHTML = '';
          if (stripeCardExpiryWrap) stripeCardExpiryWrap.innerHTML = '';
          if (stripeCardCvcWrap) stripeCardCvcWrap.innerHTML = '';
          stripeInstance = Stripe(data.publishableKey);
          var elements = stripeInstance.elements();
          var style = { base: { fontSize: '16px' } };
          cardNumberElement = elements.create('cardNumber', { style: style, disableLink: true });
          var cardExpiry = elements.create('cardExpiry', { style: style });
          var cardCvc = elements.create('cardCvc', { style: style });
          cardNumberElement.mount(stripeCardNumberWrap);
          cardExpiry.mount(stripeCardExpiryWrap);
          cardCvc.mount(stripeCardCvcWrap);
          pendingClientSecret = data.client_secret;
          if (step2AmountEl) step2AmountEl.textContent = (selectedCents / 100);
          if (topupPayAmountEl) topupPayAmountEl.textContent = (selectedCents / 100);
          showStep2();
          nextBtn.disabled = false;
        });
      })
      .catch(function (e) {
        showError(e.message || 'Something went wrong');
        nextBtn.disabled = false;
      });
  }

  function doTopupPay() {
    if (!payBtn) return;
    if (!pendingClientSecret || !stripeInstance || !cardNumberElement) return;
    payBtn.disabled = true;
    showError('');
    stripeInstance.confirmCardPayment(pendingClientSecret, {
      payment_method: { card: cardNumberElement }
    })
      .then(function (result) {
        if (result.error) throw new Error(result.error.message || 'Payment failed');
        closeTopupModal();
        loadBalance();
        pendingClientSecret = null;
      })
      .catch(function (e) {
        showError(e.message || 'Something went wrong');
      })
      .then(function () { payBtn.disabled = false; });
  }

  function doTopupBack() {
    if (stripeCardNumberWrap) stripeCardNumberWrap.innerHTML = '';
    if (stripeCardExpiryWrap) stripeCardExpiryWrap.innerHTML = '';
    if (stripeCardCvcWrap) stripeCardCvcWrap.innerHTML = '';
    cardNumberElement = null;
    stripeInstance = null;
    pendingClientSecret = null;
    showError('');
    showStep1();
  }

  function selectAmount(cents) {
    selectedCents = cents;
    if (topupPayAmountEl) topupPayAmountEl.textContent = (cents / 100);
    if (step2AmountEl) step2AmountEl.textContent = (cents / 100);
    document.querySelectorAll('.wallet-topup-amount-btn').forEach(function (b) {
      b.classList.toggle('wallet-topup-amount-btn--active', parseInt(b.getAttribute('data-cents'), 10) === cents);
    });
  }

  function refreshRefs() {
    balanceEl = document.getElementById('wallet-balance-display');
    modal = document.getElementById('wallet-topup-modal');
    step1 = document.getElementById('wallet-topup-step-1');
    step2 = document.getElementById('wallet-topup-step-2');
    topupPayAmountEl = document.getElementById('wallet-topup-pay-amount');
    step2AmountEl = document.getElementById('wallet-topup-step2-amount');
    stripeCardNumberWrap = document.getElementById('wallet-stripe-card-number');
    stripeCardExpiryWrap = document.getElementById('wallet-stripe-card-expiry');
    stripeCardCvcWrap = document.getElementById('wallet-stripe-card-cvc');
    topupErrorEl = document.getElementById('wallet-topup-error');
    payBtn = document.getElementById('wallet-topup-pay');
    cancelBtn = document.getElementById('wallet-topup-cancel');
    nextBtn = document.getElementById('wallet-topup-next');
    backBtn = document.getElementById('wallet-topup-back');
  }

  function init() {
    refreshRefs();
    loadBalance();
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.id === 'wallet-topup-btn' || t.closest && t.closest('#wallet-topup-btn')) {
      e.preventDefault();
      init();
      openTopupModal();
      return;
    }
    if (t.id === 'wallet-bank-btn' || t.closest && t.closest('#wallet-bank-btn')) {
      e.preventDefault();
      alert('Bank transfer is not available yet. Please use Top-up with a card.');
      return;
    }
    if (t.id === 'wallet-topup-cancel' || (t.closest && t.closest('#wallet-topup-cancel')) || (t.closest && t.closest('.wallet-modal-backdrop'))) {
      e.preventDefault();
      closeTopupModal();
      return;
    }
    if (t.id === 'wallet-topup-next' || (t.closest && t.closest('#wallet-topup-next'))) {
      e.preventDefault();
      doTopupNext();
      return;
    }
    if (t.id === 'wallet-topup-back' || (t.closest && t.closest('#wallet-topup-back'))) {
      e.preventDefault();
      doTopupBack();
      return;
    }
    if (t.id === 'wallet-topup-pay' || (t.closest && t.closest('#wallet-topup-pay'))) {
      e.preventDefault();
      doTopupPay();
      return;
    }
    var amountBtn = t.closest && t.closest('.wallet-topup-amount-btn');
    if (amountBtn) {
      e.preventDefault();
      var cents = parseInt(amountBtn.getAttribute('data-cents'), 10);
      if (!isNaN(cents)) selectAmount(cents);
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  window.addEventListener('pageshow', init);
})();
