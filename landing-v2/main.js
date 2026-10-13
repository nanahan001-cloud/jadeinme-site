(function () {
  'use strict';
  var d = document;
  window.__jadeReady = true; // tells the inline safety timer that main.js is running

  function revealAll() {
    var h = d.documentElement;
    h.classList.remove('js');
    h.classList.add('no-js-fallback');
  }
  try {
    init();
  } catch (err) {
    revealAll();
    if (window.console) console.error(err);
  }

  function init() {

  // header shadow on scroll
  var header = d.querySelector('.site-header');
  function onScroll() {
    if (header) header.classList.toggle('scrolled', window.scrollY > 8);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  if (/[?&]static/.test(location.search)) d.documentElement.classList.add('static'); // for screenshots

  // reveal on scroll (doodles + blocks)
  var targets = d.querySelectorAll('.reveal, .doodle');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
    targets.forEach(function (t) { io.observe(t); });
  } else {
    targets.forEach(function (t) { t.classList.add('in'); });
  }

  // teacher flyer dialog
  var dlg = d.getElementById('flyer-dialog');
  var dlgImg = d.getElementById('flyer-img');
  if (dlg && dlgImg) {
    d.querySelectorAll('[data-flyer]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        dlgImg.src = btn.getAttribute('data-flyer');
        dlgImg.alt = (btn.getAttribute('data-name') || '선생님') + ' 프로필 원본';
        if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
      });
    });
    dlg.addEventListener('click', function (e) {
      if (e.target === dlg && dlg.close) dlg.close();
    });
  }

  // mobile menu
  var toggle = d.querySelector('.nav-toggle');
  var nav = d.getElementById('site-nav');
  if (toggle && nav) {
    toggle.hidden = false;
    var setOpen = function (open) {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
    };
    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a')) setOpen(false);
    });
    d.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') { setOpen(false); toggle.focus(); }
    });
    d.addEventListener('click', function (e) {
      if (toggle.getAttribute('aria-expanded') === 'true' && !nav.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
    });
    if (window.matchMedia) {
      var mq = window.matchMedia('(min-width: 861px)');
      var onMq = function (m) { if (m.matches) setOpen(false); };
      if (mq.addEventListener) mq.addEventListener('change', onMq);
    }
  }
  }
})();
