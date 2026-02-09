(function () {
  'use strict';

  // Hero: on mobile, reveal second CTA after first scroll
  var heroSecondaryWrap = document.querySelector('.hero-cta-secondary-wrap');
  if (heroSecondaryWrap && window.matchMedia('(max-width: 767px)').matches) {
    function checkScroll() {
      if (window.scrollY > 80) {
        heroSecondaryWrap.classList.add('hero-cta-secondary-wrap--visible');
        window.removeEventListener('scroll', checkScroll, { passive: true });
      }
    }
    window.addEventListener('scroll', checkScroll, { passive: true });
  }

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
