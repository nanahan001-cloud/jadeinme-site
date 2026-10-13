/* 후기 벽 · 영상 줄 · 한마디 티커 · 라이트박스. 외부 라이브러리 없음. 마운트 지점이 없으면 조용히 건너뜀. */
(function () {
  'use strict';
  var D = window.JADE_REVIEWS;
  if (!D) return;

  /* 후기 벽 묶음 순서: 카톡 → 네이버 후기 → 변화 기록 → 선물·편지 (섞지 않음) */
  var GROUPS = [
    ['kakao', '카톡 후기'],
    ['naver', '네이버 후기'],
    ['change', '변화 기록'],
    ['gift', '선물·편지']
  ];

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, attrs) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (attrs) for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    return n;
  }
  function safe(fn) { try { fn(); } catch (e) { if (window.console) console.warn('[reviews]', e); } }
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  function isReduced() { return !!(reduceMotion && reduceMotion.matches); }

  /* ---------------- 영상 줄 ---------------- */
  /* 페이지의 모든 <video>(히어로 포함) 중 하나만 재생 — play 는 버블링하지 않으므로 캡처 단계에서 받는다 */
  document.addEventListener('play', function (e) {
    var cur = e.target;
    if (!cur || cur.tagName !== 'VIDEO') return;
    var all = document.querySelectorAll('video');
    for (var j = 0; j < all.length; j++) if (all[j] !== cur && !all[j].paused) all[j].pause();
  }, true);

  function fmt(sec) {
    var m = Math.floor(sec / 60), s = Math.round(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function initVideos() {
    var row = $('interview-videos');
    if (!row) return;
    var list = D.videos || [];
    var frag = document.createDocumentFragment();
    list.forEach(function (v) {
      var sq = v.w && v.h && v.w >= v.h;
      var card = el('figure', 'vcard vcard--local' + (sq ? ' vcard--sq' : ''));
      var box = el('div', 'vcard-media');
      var vid = el('video', null, { controls: '', preload: 'none', playsinline: '', poster: v.poster, src: v.src, width: v.w, height: v.h, 'aria-label': v.title });
      box.appendChild(vid);
      var tag = el('span', 'vcard-dur', { 'aria-label': '재생 시간 ' + fmt(v.durationSec) });
      tag.textContent = fmt(v.durationSec);
      box.appendChild(tag);
      var cap = el('figcaption', 'vcard-cap');
      var kind = el('span', 'vcard-kind');
      kind.textContent = v.kind === 'interview' ? '인터뷰' : v.kind === 'review' ? '영상 후기' : '변화 영상';
      var t = el('span', 'vcard-title');
      t.textContent = v.title;
      cap.appendChild(kind); cap.appendChild(t);
      card.appendChild(box); card.appendChild(cap);
      frag.appendChild(card);
    });
    row.appendChild(frag);
  }

  function initTicker() {
    var root = $('quote-ticker');
    var qs = D.quotes || [];
    if (!root || !qs.length) return;
    root.classList.add('ticker');
    var rows = [qs.filter(function (_, i) { return i % 2 === 0; }), qs.filter(function (_, i) { return i % 2 === 1; })];
    var reduced = isReduced();
    root.setAttribute('tabindex', '0');
    root.setAttribute('role', 'region');
    if (!root.getAttribute('aria-label')) root.setAttribute('aria-label', '회원님 한마디');
    var tracks = [];
    rows.forEach(function (list, r) {
      if (!list.length) return;
      var rowEl = el('div', 'ticker-row' + (r ? ' ticker-row--rev' : ''));
      var track = el('div', 'ticker-track');
      var copies = reduced ? 1 : 2;
      for (var c = 0; c < copies; c++) {
        var ul = el('ul', 'ticker-set');
        if (c > 0) ul.setAttribute('aria-hidden', 'true');
        list.forEach(function (q, i) {
          var li = el('li', 'bubble');
          li.style.setProperty('--br', (((i * 7 + r * 3) % 5) - 2) * 0.6 + 'deg');
          var t = el('span', 'bubble-text');
          t.textContent = '“' + q.text + '”';
          li.appendChild(t);
          ul.appendChild(li);
        });
        track.appendChild(ul);
      }
      track.style.setProperty('--dur', '60s'); /* 임시값 — 실제 폭 측정 후 아래에서 속도 고정 */
      tracks.push(track);
      rowEl.appendChild(track);
      root.appendChild(rowEl);
    });
    if (reduced) root.classList.add('ticker--static');
    /* 화면 폭과 무관하게 약 45px/s: 한 세트 폭(px) / 속도 = 한 바퀴 시간 */
    var SPEED = 45;
    function setSpeed() {
      tracks.forEach(function (tr) {
        var set = tr.firstChild;
        var w = set && set.offsetWidth;
        if (w) tr.style.setProperty('--dur', Math.max(10, Math.round(w / SPEED)) + 's');
      });
    }
    if (!reduced) {
      setSpeed();
      window.addEventListener('load', setSpeed);
      window.addEventListener('resize', setSpeed);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(setSpeed);
    }
  }

  /* ---------------- 후기 벽 ---------------- */
  /* 종류별로 묶어서 GROUPS 순서대로 이어 붙인다. 묶음 안 순서는 데이터 순서 그대로. */
  function arrange(list) {
    var out = [];
    GROUPS.forEach(function (g) {
      list.forEach(function (it) { if (it.type === g[0]) out.push(it); });
    });
    return out;
  }
  var items = arrange(D.items || []);
  var state = { list: items };
  var wall = $('reviews-wall');

  /* 형광펜 표시: window.JADE_HIGHLIGHTS[id] = [{x,y,w,h,tone}] (0~1, 좌상단 기준). 이미지 위에 % 로 겹친다. */
  var HL = window.JADE_HIGHLIGHTS || {};
  function hlLayer(it) {
    var rects = it && it.id != null ? HL[it.id] : null;
    if (!rects || !rects.length) return null;
    var layer = el('span', 'hlmarks', { 'aria-hidden': 'true' });
    rects.forEach(function (r, k) {
      var m = el('span', 'hlmark hlmark--' + (r.tone === 'dark' ? 'dark' : 'light'));
      m.style.left = (r.x * 100 - 0.6) + '%';
      m.style.top = (r.y * 100 - r.h * 100 * 0.12) + '%';
      m.style.width = (r.w * 100 + 1.2) + '%';
      m.style.height = (r.h * 100 * 1.24) + '%';
      m.style.setProperty('--hr', (((k * 5 + 2) % 7) - 3) * 0.25 + 'deg');
      layer.appendChild(m);
    });
    return layer;
  }

  function rot(i) { return (((i * 37 + 11) % 51) / 10 - 2.5).toFixed(2); }

  function card(it, i) {
    var b = el('button', 'rcard rcard--' + it.type + (i % 5 === 2 ? ' has-tape' : '') + (i % 11 === 4 ? ' has-heart' : ''), {
      type: 'button', 'data-i': i, 'aria-label': (it.caption || '회원 후기 캡처') + ' 크게 보기'
    });
    b.style.setProperty('--r', rot(i) + 'deg');
    var img = el('img', null, {
      src: it.thumb, alt: it.caption || '회원 후기 캡처', loading: 'lazy', decoding: 'async', width: it.w, height: it.h
    });
    img.style.aspectRatio = it.w + ' / ' + it.h;
    b.appendChild(img);
    var hl = hlLayer(it);
    if (hl) b.appendChild(hl);
    return b;
  }

  /* 묶음마다 전부 한 번에 붙인다(더 보기 없음). 이미지는 lazy + async + width/height 로 가볍게. */
  function buildGroups() {
    var start = 0;
    GROUPS.forEach(function (def) {
      var list = items.filter(function (it) { return it.type === def[0]; });
      if (!list.length) return;
      var sec = el('section', 'rgroup rgroup--' + def[0], { 'aria-labelledby': 'rg-' + def[0] });
      var h = el('h3', 'rgroup-title', { id: 'rg-' + def[0] });
      h.textContent = def[1];
      var grid = el('div', 'rgroup-grid');
      var frag = document.createDocumentFragment();
      var cur = null, curP = null;
      list.forEach(function (it, i) {
        var c = card(it, start + i);
        if (it.person) {
          if (curP !== it.person) { cur = el('div', 'rperson', { 'data-person': it.person }); frag.appendChild(cur); curP = it.person; }
          cur.appendChild(c);
        } else { cur = null; curP = null; frag.appendChild(c); }
      });
      grid.appendChild(frag);
      sec.appendChild(h); sec.appendChild(grid);
      wall.appendChild(sec);
      start += list.length;
    });
  }

  function initWall() {
    if (!wall) return;
    wall.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.rcard') : null;
      if (!b) return;
      openLightbox(parseInt(b.getAttribute('data-i'), 10), b);
    });
    buildGroups();
  }

  /* ---------------- 라이트박스 ---------------- */
  var lb = $('lightbox');
  var lbState = { hl: null, list: [], i: 0, opener: null, built: false, img: null, cap: null, num: null, prev: null, next: null, close: null, boxEl: null };

  function buildLightbox() {
    if (lbState.built || !lb) return;
    lb.setAttribute('tabindex', '-1');
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', '후기 크게 보기');
    lb.textContent = '';
    var back = el('div', 'lb-back');
    var stage = el('figure', 'lb-stage');
    var img = el('img', 'lb-img', { alt: '' });
    var cap = el('figcaption', 'lb-cap');
    var num = el('span', 'lb-num');
    var hl = el('span', 'hlmarks hlmarks--lb', { 'aria-hidden': 'true' });
    hl.hidden = true;
    stage.appendChild(img); stage.appendChild(hl); stage.appendChild(cap);
    var close = el('button', 'lb-btn lb-close', { type: 'button', 'aria-label': '닫기' });
    close.innerHTML = '<span aria-hidden="true">✕</span>';
    var prev = el('button', 'lb-btn lb-prev', { type: 'button', 'aria-label': '이전' });
    prev.innerHTML = '<span aria-hidden="true">‹</span>';
    var next = el('button', 'lb-btn lb-next', { type: 'button', 'aria-label': '다음' });
    next.innerHTML = '<span aria-hidden="true">›</span>';
    lb.appendChild(back); lb.appendChild(stage); lb.appendChild(num);
    lb.appendChild(prev); lb.appendChild(next); lb.appendChild(close);
    Object.assign(lbState, { built: true, hl: hl, img: img, cap: cap, num: num, prev: prev, next: next, close: close });
    back.addEventListener('click', closeLightbox);
    stage.addEventListener('click', function (e) { if (e.target === stage) closeLightbox(); });
    close.addEventListener('click', closeLightbox);
    prev.addEventListener('click', function () { go(-1); });
    next.addEventListener('click', function () { go(1); });
    img.addEventListener('click', function () { lb.focus(); });
    cap.addEventListener('click', function () { lb.focus(); });
    var sx = null, sy = null;
    lb.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { sx = null; return; }
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (sx == null) return;
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      sx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
    }, { passive: true });
  }

  function show(i) {
    var L = lbState.list, n = L.length;
    if (!n) return;
    lbState.i = (i + n) % n;
    var it = L[lbState.i];
    lbState.img.classList.add('is-loading');
    lbState.img.onload = function () { lbState.img.classList.remove('is-loading'); placeLbHl(); };
    lbState.hl.hidden = true;
    lbState.img.src = it.full;
    lbState.img.alt = it.caption || '회원 후기 캡처';
    lbState.cap.textContent = it.caption || '';
    lbState.num.textContent = (lbState.i + 1) + ' / ' + n;
    var one = n < 2;
    lbState.prev.hidden = one; lbState.next.hidden = one;
    [L[(lbState.i + 1) % n], L[(lbState.i - 1 + n) % n]].forEach(function (x) { if (x) new Image().src = x.full; });
  }

  /* 라이트박스 형광펜: 큰 이미지의 실제 표시 영역(패딩 제외)에 맞춰 겹친다 */
  function placeLbHl() {
    var hl = lbState.hl, img = lbState.img, it = lbState.list[lbState.i];
    if (!hl || !img || lb.hidden) return;
    hl.textContent = '';
    var rects = it && it.id != null ? HL[it.id] : null;
    if (!rects || !rects.length || !img.complete || !img.naturalWidth) { hl.hidden = true; return; }
    var stage = img.parentNode, sr = stage.getBoundingClientRect(), ir = img.getBoundingClientRect();
    var pad = 6;
    hl.style.left = (ir.left - sr.left + pad) + 'px';
    hl.style.top = (ir.top - sr.top + pad) + 'px';
    hl.style.width = (ir.width - pad * 2) + 'px';
    hl.style.height = (ir.height - pad * 2) + 'px';
    var src = hlLayer(it);
    while (src.firstChild) hl.appendChild(src.firstChild);
    hl.hidden = false;
  }
  window.addEventListener('resize', function () { if (lb && !lb.hidden) placeLbHl(); });

  function go(d) { show(lbState.i + d); }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); closeLightbox(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'Tab') {
      var f = Array.prototype.filter.call(lb.querySelectorAll('button'), function (b) { return !b.hidden; });
      if (!f.length) return;
      if (document.activeElement === lb && !e.shiftKey) { e.preventDefault(); f[0].focus(); return; }
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      else if (f.indexOf(document.activeElement) < 0) { e.preventDefault(); first.focus(); }
    }
  }

  var prevOverflow = '';
  function openLightbox(i, opener, list) {
    if (!lb) return;
    buildLightbox();
    lbState.list = list || state.list;
    lbState.opener = opener || null;
    prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    lb.hidden = false;
    document.addEventListener('keydown', onKey);
    show(i);
    lbState.close.focus();
  }

  function closeLightbox() {
    if (!lb || lb.hidden) return;
    lb.hidden = true;
    document.removeEventListener('keydown', onKey);
    document.body.style.overflow = prevOverflow;
    if (lbState.img) lbState.img.removeAttribute('src');
    var o = lbState.opener;
    if (o && document.contains(o)) o.focus({ preventScroll: true });
    else if (lbState.list === state.list) {
      var b = wall && wall.querySelector('.rcard[data-i="' + lbState.i + '"]');
      if (b) b.focus({ preventScroll: true });
    }
  }

  /* ---------------- 수업 장면 띠 ---------------- */
  function initClassStrip() {
    var root = $('class-strip');
    var list = D.classPhotos || [];
    if (!root || !list.length) return;
    var frag = document.createDocumentFragment();
    list.forEach(function (p, i) {
      var b = el('button', 'ccard' + (i % 4 === 1 ? ' has-tape' : ''), {
        type: 'button', 'data-i': i, 'aria-label': (p.caption || '제이드인미 수업 장면') + ' 크게 보기'
      });
      b.style.setProperty('--r', rot(i + 5) + 'deg');
      var img = el('img', null, {
        src: p.thumb, alt: p.alt || p.caption || '제이드인미 수업 장면', loading: 'lazy', decoding: 'async', width: p.w, height: p.h
      });
      b.appendChild(img);
      frag.appendChild(b);
    });
    root.appendChild(frag);
    root.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('.ccard') : null;
      if (!b) return;
      openLightbox(parseInt(b.getAttribute('data-i'), 10), b, list);
    });
  }

  safe(initVideos);
  safe(initClassStrip);
  safe(initTicker);
  safe(initWall);
})();
