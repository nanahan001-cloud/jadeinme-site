/* 제이드인미 방문 통계 (개인정보 없음: 이름·전화·IP 저장 안 함) */
(function () {
  'use strict';
  // 통계 받는 Apps Script 웹앱 주소
  var ENDPOINT = 'https://script.google.com/macros/s/AKfycbw73cdMA7vRvjlFv9mr1z9Ur-K0nQRm-1gK5OmuapXnN8C3F3xSW9kqMtnOGsfYMPb1dQ/exec';
  var w = window, d = document, loc = w.location;

  // 저장소 읽기/쓰기 (막혀 있어도 오류 안 나게)
  function get(st, k) { try { return w[st].getItem(k); } catch (e) { return null; } }
  function set(st, k, v) { try { w[st].setItem(k, v); } catch (e) {} }
  function qs(k) { var m = new RegExp('[?&]' + k + '=([^&#]*)').exec(loc.search); if (!m) return ''; try { return decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch (e) { return m[1]; } }

  // 원장님 본인 제외: ?nostat=1 켜기, ?nostat=0 끄기
  var ns = qs('nostat');
  if (ns === '1') set('localStorage', 'jim_nostat', '1');
  if (ns === '0') { try { w.localStorage.removeItem('jim_nostat'); } catch (e) {} }
  if (get('localStorage', 'jim_nostat') === '1') return;

  // 봇·자동화 브라우저는 보내지 않음
  var nav = w.navigator || {};
  if (nav.webdriver || /bot|crawl|spider|headless/i.test(nav.userAgent || '')) return;

  // 랜덤 id (방문자 vid는 기기에 계속, sid는 탭 세션 동안)
  function rid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
  function ensure(st, k) { var v = get(st, k); if (!v) { v = rid(); set(st, k, v); } return v; }
  var vid = ensure('localStorage', 'jim_vid');
  var sid = ensure('sessionStorage', 'jim_sid');

  // 유입 호스트 (같은 사이트면 빈 값)
  var ref = '';
  try { var rh = d.referrer ? new URL(d.referrer).hostname : ''; ref = rh && rh !== loc.hostname ? rh : ''; } catch (e) {}

  // utm은 URL 값을 쓰고, 없으면 세션 첫 값을 이어서 씀
  function utm(k) {
    var v = qs(k);
    if (v) { if (!get('sessionStorage', 'jim_' + k)) set('sessionStorage', 'jim_' + k, v); return v; }
    return get('sessionStorage', 'jim_' + k) || '';
  }

  // 이벤트 전송 (실패는 무시)
  function send(ev, label) {
    var body = JSON.stringify({
      kind: 'event', ev: ev, page: loc.pathname, vid: vid, sid: sid, ref: ref,
      utm_source: utm('utm_source'), utm_medium: utm('utm_medium'), utm_campaign: utm('utm_campaign'),
      label: String(label || '').replace(/\s+/g, ' ').slice(0, 60), dev: (w.innerWidth || 1024) < 768 ? 'm' : 'pc', t: new Date().toISOString()
    });
    try {
      if (w.fetch) {
        w.fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body })['catch'](function () {});
      } else if (nav.sendBeacon) {
        nav.sendBeacon(ENDPOINT, body);
      }
    } catch (e) {}
  }

  var once = {};
  function one(ev, label) { var k = ev + '|' + (label || ''); if (once[k]) return; once[k] = 1; send(ev, label); }
  // 글자 정리 (공백 줄이고 n자까지)
  function txt(el, n) { return ((el && el.textContent) || '').replace(/\s+/g, ' ').replace(/^ | $/g, '').slice(0, n || 30); }

  send('view');

  // 상담·체험 신청 버튼: 폼으로 가는 링크, 옛 페이지의 #booking, 네이버 예약 링크 (폼 안 제출 버튼은 제외)
  d.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || a.closest('#consult-form')) return;
    var h = a.getAttribute('href') || '';
    if (h.indexOf('#consult-form') > -1 || h.indexOf('#booking') > -1 || h.indexOf('booking.naver.com') > -1) send('cta');
  }, true);

  // 메뉴 클릭: 상단 메뉴·하단 링크·접기(자세히 보기/FAQ) 열기
  d.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var m = t.closest('#site-nav a, footer a[href^="#"], .nav-toggle');
    if (m) return send('menu', txt(m));
    var s = t.closest('summary');
    if (!s) return;
    // 같은 글자(자세히 보기) 구분용으로 섹션 제목을 앞에 붙임
    var sec = s.closest('section'), h = sec && sec.querySelector('h2');
    var lb = txt(s.querySelector('.s-open') || s);
    send('menu', h && lb === '자세히 보기' ? txt(h, 20) + ' · ' + lb : lb);
  }, true);

  // 후기 사진 크게 보기
  d.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('.rcard')) send('review_open');
  }, true);

  // 영상: 재생(영상당 1회), 끝까지(끝 또는 90%) — 미디어 이벤트는 버블링 안 하므로 캡처로 받음
  function vlabel(v) {
    var f = v.closest ? v.closest('figure') : null;
    var t = f && f.querySelector('.vcard-title');
    var src = (v.getAttribute('src') || '').split('/').pop();
    return txt(t, 60) || v.getAttribute('aria-label') || src || 'video';
  }
  d.addEventListener('play', function (e) { if (e.target && e.target.tagName === 'VIDEO') one('video_play', vlabel(e.target)); }, true);
  d.addEventListener('ended', function (e) { if (e.target && e.target.tagName === 'VIDEO') one('video_done', vlabel(e.target)); }, true);
  d.addEventListener('timeupdate', function (e) {
    var v = e.target;
    if (v && v.tagName === 'VIDEO' && v.duration > 0 && v.currentTime / v.duration >= 0.9) one('video_done', vlabel(v));
  }, true);

  // 선생님 추천 테스트 (teacher-test): 시작 버튼, 결과 화면 도달(결과 선생님 이름을 라벨로)
  d.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('#intro button.btn, #result button.soft') : null;
    if (b) { started = true; send('test_start'); }
  }, true);
  var started = false;
  var res = d.getElementById('result');
  if (res && w.MutationObserver && d.getElementById('intro')) {
    var shown = false;
    new w.MutationObserver(function () {
      var on = !res.hidden && !!res.querySelector('.rname');
      // ?pain=N 으로 바로 시작된 경우도 시작 1회로 셈
      if (on && !shown) { if (!started) { started = true; send('test_start'); } send('test_done', txt(res.querySelector('.rname'), 60)); }
      shown = on;
    }).observe(res, { attributes: true, attributeFilter: ['hidden'] });
  }

  // 신청서 작성 시작 / 제출 / 체험 선택
  function inForm(t) { return t && t.closest && t.closest('#consult-form'); }
  function start(e) { if (inForm(e.target) && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) one('form_start'); }
  d.addEventListener('focusin', start, true);
  d.addEventListener('input', start, true);
  d.addEventListener('submit', function (e) { if (inForm(e.target)) one('submit'); }, true);
  d.addEventListener('change', function (e) {
    var t = e.target;
    if (t && t.name === 'type' && t.value === '체험' && inForm(t)) one('tab_trial');
  }, true);
})();
