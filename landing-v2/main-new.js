const CONSULT_ENDPOINT = 'https://script.google.com/macros/s/AKfycbw73cdMA7vRvjlFv9mr1z9Ur-K0nQRm-1gK5OmuapXnN8C3F3xSW9kqMtnOGsfYMPb1dQ/exec'; // Google Apps Script 웹앱 주소 (apps-script.gs 배포 후 여기에)

(function () {
  'use strict';
  var d = document;
  window.__jadeReady = true; // tells the inline safety timer that main.js is running

  var ATTR_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ad_id', 'fbclid'];
  function readAttr() {
    try { return JSON.parse(localStorage.getItem('jim_attr') || '{}') || {}; } catch (e) { return {}; }
  }
  function getCookie(name) {
    var m = d.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

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

  // ---- 유입 추적 (Meta 광고 -> 신청 연결) ----
  function captureAttribution() {
    var q;
    try { q = new URLSearchParams(location.search); } catch (e) { return; }
    var saved = readAttr();
    var cur = {}, fresh = false;
    ATTR_KEYS.forEach(function (k) { var v = q.get(k); if (v) { cur[k] = v; fresh = true; } });
    var ext = d.referrer && d.referrer.indexOf(location.origin) !== 0 ? d.referrer : '';
    if (fresh) { // 새 광고 클릭 = 덮어쓰기(마지막 클릭 기준)
      ATTR_KEYS.forEach(function (k) { saved[k] = cur[k] || ''; });
      if (ext) saved.referrer = ext;
    } else if (ext && !saved.referrer) {
      saved.referrer = ext;
    }
    if (!saved.first_seen) saved.first_seen = new Date().toISOString();
    try { localStorage.setItem('jim_attr', JSON.stringify(saved)); } catch (e) {}
    if (cur.fbclid) { // 새 fbclid = 덮어쓰기(마지막 클릭 기준)
      try {
        d.cookie = '_fbc=' + encodeURIComponent('fb.1.' + Date.now() + '.' + cur.fbclid) +
          '; max-age=' + 90 * 24 * 3600 + '; path=/; SameSite=Lax';
      } catch (e) {}
    }
  }
  captureAttribution();

  // 전화·네이버 링크 클릭 (픽셀/gtag 있을 때만)
  d.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var h = a.getAttribute('href') || '';
    var kind = h.indexOf('tel:') === 0 ? 'phone' : (/naver\.(me|com)/.test(h) ? 'naver' : '');
    if (!kind) return;
    try {
      if (window.fbq) fbq('track', 'Contact');
      if (window.gtag) gtag('event', 'contact', { method: kind });
    } catch (err) {}
  });

  // CTA -> consult form (smooth scroll + focus)
  d.querySelectorAll('a[href="#consult-form"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var t = d.getElementById('consult-form');
      if (!t) return;
      e.preventDefault();
      var pre = a.getAttribute('data-type');
      var pr = pre && d.querySelector('input[name="type"][value="' + pre + '"]');
      if (pr) { pr.checked = true; pr.dispatchEvent(new Event('input', { bubbles: true })); }
      var rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      t.scrollIntoView({ behavior: rm ? 'auto' : 'smooth', block: 'start' });
      if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
      t.focus({ preventScroll: true });
      if (history.replaceState) history.replaceState(null, '', '#consult-form');
    });
  });

  initConsultForm();
  }

  function initConsultForm() {
    var form = d.getElementById('cf-form');
    if (!form) return;
    var done = d.getElementById('cf-done');
    var status = d.getElementById('cf-status');
    var btn = form.querySelector('.cf-submit');
    var sending = false;
    var cfDone = false;
    var bar = d.querySelector('.sticky-bar');
    var sect = d.getElementById('consult-form');
    if (bar && sect && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) { bar.classList.toggle('is-hidden', e.isIntersecting || cfDone); });
      }).observe(sect);
    }

    function setErr(id, msg, field) {
      var el = d.getElementById(id);
      if (!el) return;
      el.textContent = msg || '';
      el.hidden = !msg;
      if (field) { if (msg) field.setAttribute('aria-invalid', 'true'); else field.removeAttribute('aria-invalid'); }
    }
    function normPhone(v) {
      var n = String(v || '').replace(/[\s.\-]/g, '');
      if (/^\+?82/.test(n)) n = '0' + n.replace(/^\+?82/, '').replace(/^0/, '');
      if (!/^010\d{8}$/.test(n)) return '';
      return n.slice(0, 3) + '-' + n.slice(3, 7) + '-' + n.slice(7);
    }
    function checkedList(name) {
      return [].map.call(form.querySelectorAll('input[name="' + name + '"]:checked'), function (x) { return x.value; }).join(',');
    }
    function val(name) {
      var c = form.querySelector('input[name="' + name + '"]:checked');
      return c ? c.value : '';
    }
    function showStatus(html, isFail) { status.innerHTML = html; status.classList.toggle('is-fail', !!isFail); status.hidden = false; }
    function query(k) {
      try { return new URLSearchParams(location.search).get(k) || ''; } catch (e) { return ''; }
    }
    function success() {
      cfDone = true;
      if (bar) bar.classList.add('is-hidden');
      form.hidden = true;
      done.hidden = false;
      done.focus();
      if (done.scrollIntoView) done.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    function fireLead(p) {
      try {
        if (window.fbq) fbq('track', 'Lead', { content_name: '상담신청', goal: p.goal, teacher: p.teacher }, { eventID: p.event_id });
        if (window.gtag) gtag('event', 'generate_lead', { goal: p.goal, teacher: p.teacher, event_id: p.event_id });
      } catch (err) {}
    }
    function fail() {
      showStatus('앗, 전송이 잘되지 않았어요. 잠시 뒤 다시 해보시거나 <a href="tel:03180496639">031-8049-6639</a>로 전화 주세요.', true);
      btn.disabled = false;
      sending = false;
      status.setAttribute('tabindex', '-1');
      status.scrollIntoView({ block: 'center', behavior: 'smooth' });
      status.focus({ preventScroll: true });
    }

    var copyBtn = d.getElementById('cf-copy');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        var num = copyBtn.getAttribute('data-num');
        function selectText() {
          var el = d.getElementById('cf-acct');
          if (el && window.getSelection && d.createRange) {
            var r = d.createRange(); r.selectNodeContents(el);
            var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
          }
          copyBtn.textContent = '길게 눌러 복사';
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(num).then(function () {
            copyBtn.textContent = '복사됐어요';
            setTimeout(function () { copyBtn.textContent = '계좌 복사'; }, 2000);
          }, selectText);
        } else { selectText(); }
      });
    }
    function syncSatHint() {
      var picked = [].map.call(form.querySelectorAll('input[name="days"]:checked'), function (x) { return x.value; });
      var tm = [].map.call(form.querySelectorAll('input[name="time"]:checked'), function (x) { return x.value; });
      var hint = d.getElementById('cf-time-hint');
      if (hint) hint.hidden = !(picked.length === 1 && picked[0] === '토(오전)' && tm.length && tm.indexOf('오전') < 0 && tm.indexOf('유동적인 스케줄') < 0);
    }

    form.addEventListener('input', function (e) {
      var t = e.target;
      if (t.name === 'name') setErr('cf-name-err', '', t);
      if (t.name === 'phone') setErr('cf-phone-err', '', t);
      if (t.name === 'type') {
        setErr('cf-type-err', '');
        var pay = d.getElementById('cf-pay');
        if (pay) pay.hidden = val('type') !== '체험';
      }
      if (t.name === 'time') setErr('cf-time-err', '');
      if (t.name === 'time' || t.name === 'days') setTimeout(syncSatHint, 0);
      if (t.name === 'days') {
        setErr('cf-days-err', '');
        var any = form.querySelector('input[name="days"][value="상관없음"]');
        if (t.value === '상관없음' && t.checked) {
          form.querySelectorAll('input[name="days"]').forEach(function (x) { if (x !== t) x.checked = false; });
        } else if (t.checked && any) { any.checked = false; }
      }
      if (t.name === 'goal') setErr('cf-goal-err', '');
      if (t.name === 'consent') setErr('cf-consent-err', '');
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (sending) return;
      status.hidden = true;
      var nameEl = form.elements.name, phoneEl = form.elements.phone;
      var name = nameEl.value.trim();
      var phone = normPhone(phoneEl.value);
      var type = val('type');
      var days = [].map.call(form.querySelectorAll('input[name="days"]:checked'), function (x) { return x.value; }).join(',');
      var time = checkedList('time'), goal = checkedList('goal'), teacher = val('teacher') || '추천해 주세요';
      var consent = form.elements.consent.checked;
      var first = null;
      function bad(id, msg, el, focusEl) { setErr(id, msg, el); if (!first) first = focusEl || el; }

      setErr('cf-name-err', '', nameEl); setErr('cf-phone-err', '', phoneEl);
      setErr('cf-type-err', ''); setErr('cf-days-err', ''); setErr('cf-time-err', ''); setErr('cf-goal-err', ''); setErr('cf-consent-err', '');
      if (!name) bad('cf-name-err', '이름을 알려 주세요.', nameEl);
      if (!phone) bad('cf-phone-err', '휴대폰 번호 11자리를 확인해 주세요. 예) 01012345678', phoneEl);
      if (!type) bad('cf-type-err', '상담인지 체험인지 골라 주세요.', null, form.querySelector('input[name="type"]'));
      if (!days) bad('cf-days-err', '원하는 요일을 골라 주세요.', null, form.querySelector('input[name="days"]'));
      if (!time) bad('cf-time-err', '운동 가능한 시간대를 골라 주세요.', null, form.querySelector('input[name="time"]'));
      if (!goal) bad('cf-goal-err', '원하는 것을 골라 주세요.', null, form.querySelector('input[name="goal"]'));
      if (!consent) bad('cf-consent-err', '개인정보 수집·이용에 동의해 주셔야 신청할 수 있어요.', null, form.elements.consent);
      var memoText = form.elements.memo.value.trim();
      if (first) { first.focus(); return; }
      /* keep what the visitor typed */

      // honeypot: pretend success, send nothing
      if (form.elements.jim_hp.value) { success(); return; }

      var saved = readAttr();
      var eventId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(36).slice(2, 10));
      var payload = {
        name: name, phone: phone, type: type, days: days, time: time, teacher: teacher, goal: goal,
        memo: memoText, consent: true,
        page: location.href, referrer: d.referrer,
        utm_source: query('utm_source'), utm_medium: query('utm_medium'),
        utm_campaign: query('utm_campaign'), utm_content: query('utm_content'),
        fbclid: query('fbclid') || saved.fbclid || '', submittedAt: new Date().toISOString()
      };
      payload.utm_source = query('utm_source') || saved.utm_source || '';
      payload.utm_medium = query('utm_medium') || saved.utm_medium || '';
      payload.utm_campaign = query('utm_campaign') || saved.utm_campaign || '';
      payload.utm_content = query('utm_content') || saved.utm_content || '';
      payload.utm_term = query('utm_term') || saved.utm_term || '';
      payload.ad_id = query('ad_id') || saved.ad_id || '';
      payload.referrer = saved.referrer || d.referrer;
      payload.fbc = getCookie('_fbc');
      payload.fbp = getCookie('_fbp');
      payload.first_seen = saved.first_seen || '';
      payload.user_agent = navigator.userAgent;
      payload.event_id = eventId;

      sending = true;
      btn.disabled = true;
      showStatus('보내는 중이에요…');

      if (!CONSULT_ENDPOINT) {
        if (window.console) console.warn('CONSULT_ENDPOINT is empty; nothing was sent.', payload);
        var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
        if (local) { status.hidden = true; success(); fireLead(payload); } else fail();
        return;
      }
      var ctrl = window.AbortController ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);
      fetch(CONSULT_ENDPOINT, {
        signal: ctrl ? ctrl.signal : undefined,
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }).then(function () { clearTimeout(timer); status.hidden = true; success(); fireLead(payload); }, function () { clearTimeout(timer); fail(); });
    });
  }
})();
