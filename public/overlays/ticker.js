(function () {
  'use strict';
  var api = window.netrex || {};
  var lane = document.getElementById('lane');
  var closeBtn = document.getElementById('close');

  var SPEED = 200;      // piksel/sn — sabit hız: yazı uzadıkça süre de uzar
  var MAX_QUEUE = 4;    // çok mesaj birikirse eskileri atla

  var queue = [];
  var current = null;   // { el, x, w, start }
  var raf = 0;

  function num(v, min, max, def) { v = Number(v); if (!isFinite(v)) return def; return Math.max(min, Math.min(max, v)); }

  function reportRect() {
    var r = closeBtn.getBoundingClientRect();
    var visible = closeBtn.classList.contains('on');
    if (api.reportTickerButtonRect) {
      api.reportTickerButtonRect({ x: r.left, y: r.top, width: visible ? r.width : 0, height: visible ? r.height : 0 });
    }
  }
  window.addEventListener('resize', reportRect);

  function setActive(on) {
    closeBtn.classList.toggle('on', on);
    reportRect();
  }

  // Mesaj sürekli hareket ettiği için konumu her karede göndermek yerine hareketin parametrelerini bir kez
  // bildiriyoruz; ana süreç "şu an nerede" bilgisini kendisi hesaplar ve imleç üstündeyken tıklamayı açar.
  function reportMessageGeom(geom) {
    if (api.reportTickerMessageGeom) api.reportTickerMessageGeom(geom);
  }

  function stopCurrent() {
    cancelAnimationFrame(raf);
    raf = 0;
    if (current) { try { lane.removeChild(current.el); } catch (e) {} }
    current = null;
    reportMessageGeom(null);
  }

  function finishAndNext() {
    stopCurrent();
    next();
  }

  function next() {
    var item = queue.shift();
    if (!item) {
      setActive(false);
      if (api.tickerIdle) api.tickerIdle();   // sıra boş: ana süreç pencereyi gizler
      return;
    }

    var op = num(item.opacity, 0.3, 1, 0.8);
    var el = document.createElement('div');
    el.className = 'msg';
    el.style.setProperty('--bg', String(Math.min(0.85, 0.35 + op * 0.45)));
    el.style.setProperty('--fg', String(Math.min(1, 0.6 + op * 0.4)));
    if (item.name) {
      var nm = document.createElement('span'); nm.className = 'name'; nm.textContent = item.name;
      var sp = document.createElement('span'); sp.className = 'sep'; sp.textContent = '›';
      el.appendChild(nm); el.appendChild(sp);
    }
    var tx = document.createElement('span'); tx.textContent = item.text;
    el.appendChild(tx);
    el.style.transform = 'translateX(' + window.innerWidth + 'px)';
    lane.appendChild(el);

    var w = el.offsetWidth;
    current = { el: el, w: w, start: performance.now(), from: window.innerWidth };
    setActive(true);

    // Tıklayınca yalnızca bu mesajı kapat (sıradaki varsa devam eder)
    el.title = 'Kapatmak için tıkla';
    el.addEventListener('click', function () {
      if (current && current.el === el) finishAndNext();
    });

    var box = el.getBoundingClientRect();
    reportMessageGeom({ startedAt: Date.now(), from: window.innerWidth, speed: SPEED, width: w, top: box.top, height: box.height });

    function frame(t) {
      if (!current) return;
      var x = current.from - ((t - current.start) / 1000) * SPEED;
      current.el.style.transform = 'translateX(' + x + 'px)';
      if (x < -current.w) { finishAndNext(); return; }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  }

  function enqueue(msg) {
    if (!msg || typeof msg.text !== 'string' || !msg.text.trim()) return;
    queue.push({ text: msg.text.slice(0, 200), name: typeof msg.name === 'string' ? msg.name.slice(0, 40) : '', opacity: msg.opacity });
    while (queue.length > MAX_QUEUE) queue.shift();
    if (!current) next();
  }

  function clearAll() {
    queue = [];
    stopCurrent();
    setActive(false);
  }

  closeBtn.addEventListener('click', function () {
    clearAll();
    if (api.closeTicker) api.closeTicker();
  });

  if (api.onTickerMessage) api.onTickerMessage(enqueue);
  if (api.onTickerClear) api.onTickerClear(clearAll);
  reportRect();
})();
