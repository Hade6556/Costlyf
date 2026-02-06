(function () {
  'use strict';

  var subscriptions = [
    'Netflix',
    'Spotify',
    'Disney+',
    'YouTube Premium',
    'Viaplay',
    'Apple TV+',
    'Hulu',
    'HBO Max',
    'Amazon Prime',
    'Deezer',
    'Apple Music',
    'Mozilla VPN',
    'Bitdefender',
    'PureVPN',
    'NordVPN',
    'Snapchat+',
    'Gemini 2',
    'Microsoft 365',
    'Uber One',
    'Delfi',
    'Duolingo',
    'Apple One',
    'Google One',
    'iCloud'
  ];

  var track = document.querySelector('.hero-rotating-track');
  var items = document.querySelectorAll('.hero-rotating-item');
  if (!track || items.length < 2) return;

  var current = items[0];
  var nextEl = items[1];
  var index = 0;
  var duration = 1600;
  var rollDuration = 350;

  function getText(i) {
    return subscriptions[i % subscriptions.length];
  }

  function roll() {
    nextEl.textContent = getText(index);
    track.style.transition = 'transform ' + (rollDuration / 1000) + 's cubic-bezier(0.32, 0.72, 0, 1)';
    track.style.transform = 'translateY(-50%)';

    setTimeout(function () {
      current.textContent = getText(index);
      track.style.transition = 'none';
      track.style.transform = 'translateY(0)';
      index += 1;
    }, rollDuration);
  }

  current.textContent = getText(0);
  nextEl.textContent = getText(1);
  index = 1;

  setInterval(roll, duration);

  // Sticky header border on scroll
  var header = document.querySelector('.header');
  if (header) {
    function onScroll() {
      header.classList.toggle('scrolled', window.scrollY > 10);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // FAQ accordion: one open at a time
  var faqQuestions = document.querySelectorAll('.faq-question');
  faqQuestions.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.faq-item');
      var wasOpen = item.classList.contains('faq-item--open');
      document.querySelectorAll('.faq-item').forEach(function (el) {
        el.classList.remove('faq-item--open');
        el.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
      });
      if (!wasOpen) {
        item.classList.add('faq-item--open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
})();
