(function () {
  'use strict';
  var api = window.netrex || {};
  var STORE_KEY = 'netrex-pointer-overlay-v2';

  // ───────── kalıcı ayarlar (konum, opaklık) ─────────
  function loadPrefs() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; } }
  function savePrefs(p) { try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch (e) {} }
  var prefs = loadPrefs();

  // ───────── yardımcılar ─────────
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = String(text);
    return n;
  }
  function safeColor(c) { return (typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c)) ? c : '#6366f1'; }
  function num(v, min, max) { if (v == null || v === '') return null; v = Number(v); if (!isFinite(v)) return null; return Math.max(min, Math.min(max, v)); }

  var widget = document.getElementById('widget');
  var bubble = document.getElementById('bubble');
  var badge = document.getElementById('badge');
  var panel = document.getElementById('panel');
  var card = document.getElementById('card');
  var cursorLayer = document.getElementById('cursor-layer');
  var chkVis = document.getElementById('chk-vis');
  var rngOpacity = document.getElementById('rng-opacity');
  var ulist = document.getElementById('ulist');
  var rlist = document.getElementById('rlist');
  var reqSection = document.getElementById('req-section');
  var expanded = false;
  var dragging = false;
  var didDrag = false;
  var lastRequests = [];

  // ───────── konum: sağ alt, görev çubuğunun/saatin hemen üstü ─────────
  function taskbarInsets() {
    var s = window.screen;
    return {
      bottom: Math.max(0, s.height - (s.availTop || 0) - s.availHeight),
      right: Math.max(0, s.width - (s.availLeft || 0) - s.availWidth),
    };
  }
  function setAnchor(right, bottom) {
    var maxR = Math.max(0, window.innerWidth - widget.offsetWidth);
    var maxB = Math.max(0, window.innerHeight - widget.offsetHeight);
    widget.style.right = Math.max(0, Math.min(maxR, right)) + 'px';
    widget.style.bottom = Math.max(0, Math.min(maxB, bottom)) + 'px';
  }
  function applyPrefs() {
    var ins = taskbarInsets();
    if (typeof prefs.right === 'number' && typeof prefs.bottom === 'number') setAnchor(prefs.right, prefs.bottom);
    else setAnchor(ins.right + 16, ins.bottom + 14);
    if (typeof prefs.opacity === 'number') {
      rngOpacity.value = String(Math.round(prefs.opacity * 100));
      cursorLayer.style.opacity = String(prefs.opacity);
    }
  }

  // ───────── ana işleme etkileşim alanını bildir (hover algısını ana süreç yapar) ─────────
  var rectQueued = false;
  function reportRect() {
    if (rectQueued) return;
    rectQueued = true;
    requestAnimationFrame(function () {
      rectQueued = false;
      var r = widget.getBoundingClientRect();
      if (api.reportPointerOverlayWidgetRect) {
        api.reportPointerOverlayWidgetRect({ x: r.left, y: r.top, width: r.width, height: r.height, dragging: dragging });
      }
    });
  }
  if (window.ResizeObserver) new ResizeObserver(reportRect).observe(widget);
  window.addEventListener('resize', function () { applyPrefs(); reportRect(); });

  // ───────── aç / kapat ─────────
  function refreshVisibility() {
    // Panel açıkken istekler panelin içinde; kapalıyken küçük kart
    panel.style.display = expanded ? 'flex' : 'none';
    card.style.display = (!expanded && lastRequests.length > 0) ? 'flex' : 'none';
    widget.classList.toggle('open', expanded);
    reportRect();
  }
  function setExpanded(v) { expanded = v; refreshVisibility(); }

  bubble.addEventListener('click', function () { if (!didDrag) setExpanded(!expanded); });
  document.getElementById('btn-min').addEventListener('click', function () { setExpanded(false); });
  document.getElementById('btn-close').addEventListener('click', function () {
    if (api.revokeAllPointers) api.revokeAllPointers();
    if (api.closePointerOverlay) api.closePointerOverlay();
  });

  // ───────── sürükleme (baloncuk + panel başlığı) ─────────
  var sx = 0, sy = 0, startRight = 0, startBottom = 0;
  function startDrag(e) {
    if (e.target.closest('button') && e.target.id !== 'bubble') return;
    dragging = true; didDrag = false;
    sx = e.clientX; sy = e.clientY;
    startRight = parseFloat(widget.style.right) || 0;
    startBottom = parseFloat(widget.style.bottom) || 0;
    reportRect();
    e.preventDefault();
  }
  document.getElementById('drag-handle').addEventListener('mousedown', startDrag);
  bubble.addEventListener('mousedown', startDrag);
  document.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    if (Math.abs(e.clientX - sx) > 3 || Math.abs(e.clientY - sy) > 3) didDrag = true;
    setAnchor(startRight - (e.clientX - sx), startBottom - (e.clientY - sy));
    reportRect();
  });
  document.addEventListener('mouseup', function () {
    if (!dragging) return;
    dragging = false;
    prefs.right = parseFloat(widget.style.right) || 0;
    prefs.bottom = parseFloat(widget.style.bottom) || 0;
    savePrefs(prefs);
    reportRect();
    setTimeout(function () { didDrag = false; }, 0);
  });

  // ───────── ayarlar ─────────
  chkVis.addEventListener('change', function (e) { cursorLayer.style.display = e.target.checked ? 'block' : 'none'; });
  rngOpacity.addEventListener('input', function (e) {
    var o = e.target.value / 100;
    cursorLayer.style.opacity = String(o);
    prefs.opacity = o; savePrefs(prefs);
  });

  // ───────── imleç çizimi ─────────
  var cursorEls = new Map();
  function mkSvg(color) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '22'); svg.setAttribute('height', '22'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
    var path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-5.07a.5.5 0 0 1 .36-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.36z');
    path.setAttribute('fill', color); path.setAttribute('stroke', '#fff'); path.setAttribute('stroke-width', '1.5'); path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    return svg;
  }

  var alertTimer = null;
  var lastRequestCount = 0;
  var lastReqSig = null;
  var lastListSig = null;

  function requestRow(r, cls) {
    var row = el('div', cls);
    row.appendChild(el('span', 'nm req-name', r.name || 'Kullanıcı'));
    var btns = el('div', 'item-btns');
    var ok = el('button', 'mini ok', '✓');
    var no = el('button', 'mini no', '✕');
    ok.title = 'İzin ver'; no.title = 'Reddet';
    ok.addEventListener('click', function () { if (api.grantPointerRequest) api.grantPointerRequest(r.id); });
    no.addEventListener('click', function () { if (api.denyPointerRequest) api.denyPointerRequest(r.id); });
    btns.appendChild(ok); btns.appendChild(no);
    row.appendChild(btns);
    return row;
  }

  function render(payload) {
    var data = Array.isArray(payload) ? { pointers: payload, requests: [] } : (payload || {});
    var pointers = Array.isArray(data.pointers) ? data.pointers : [];
    var requests = Array.isArray(data.requests) ? data.requests : [];
    lastRequests = requests;

    // Rozet: bekleyen istek varsa amber, yoksa izinli sayısı
    if (requests.length > 0) { badge.textContent = String(requests.length); badge.className = 'on hot'; }
    else if (pointers.length > 0) { badge.textContent = String(pointers.length); badge.className = 'on'; }
    else { badge.className = ''; }

    // NOT: Konum her ~33ms'de değişir; listeleri her güncellemede yeniden kurarsak düğme mousedown ile mouseup
    // arasında DOM'dan silinir ve `click` hiç oluşmaz (kullanıcı "Kaldır"a defalarca basmak zorunda kalıyordu).
    // Bu yüzden listeler yalnızca içerikleri (id/ad/renk) değişince yeniden çizilir.
    var reqSig = requests.map(function (r) { return r.id + '|' + r.name; }).join('\n');
    var listSig = pointers.map(function (p) { return p.id + '|' + p.name + '|' + p.color; }).join('\n');

    // İstekler: hem küçük kartta hem panelde
    reqSection.classList.toggle('hidden', requests.length === 0);
    if (reqSig !== lastReqSig) {
      lastReqSig = reqSig;
      card.textContent = ''; rlist.textContent = '';
      requests.forEach(function (r) {
        card.appendChild(requestRow(r, 'req-row'));
        rlist.appendChild(requestRow(r, 'item req'));
      });
    }

    // Yeni istek: baloncuk dikkat çeker (panel zorla açılmaz — dikkat dağıtmasın)
    if (requests.length > lastRequestCount) {
      widget.classList.add('alert');
      clearTimeout(alertTimer);
      alertTimer = setTimeout(function () { widget.classList.remove('alert'); }, 12000);
    }
    if (requests.length === 0) widget.classList.remove('alert');
    lastRequestCount = requests.length;
    refreshVisibility();

    // İzinliler listesi
    if (listSig !== lastListSig) {
    lastListSig = listSig;
    ulist.textContent = '';
    if (pointers.length === 0) {
      ulist.appendChild(el('div', 'empty', 'Henüz kimse yok'));
    } else {
      pointers.forEach(function (p) {
        var row = el('div', 'item');
        var left = el('div', 'item-left');
        var dot = el('div', 'ui-dot'); dot.style.background = safeColor(p.color);
        left.appendChild(dot); left.appendChild(el('span', 'nm', p.name || 'Kullanıcı'));
        var rm = el('button', 'mini no', 'Kaldır');
        rm.addEventListener('click', function () { if (api.revokePointer) api.revokePointer(p.id); });
        row.appendChild(left); row.appendChild(rm);
        ulist.appendChild(row);
      });
    }
    }

    // İmleç elemanları (konumu olmayan, hareketsiz kalmış kullanıcının imleci eski yerinde takılı kalmasın)
    var ids = new Set(pointers.filter(function (p) { return num(p.x, -0.1, 1.1) != null && num(p.y, -0.1, 1.1) != null; }).map(function (p) { return String(p.id); }));
    cursorEls.forEach(function (node, id) { if (!ids.has(id)) { cursorLayer.removeChild(node); cursorEls.delete(id); } });
    pointers.forEach(function (p) {
      var id = String(p.id);
      var x = num(p.x, -0.1, 1.1), y = num(p.y, -0.1, 1.1);
      if (x == null || y == null) return;
      var node = cursorEls.get(id);
      if (!node) {
        node = el('div', 'ptr');
        node.appendChild(mkSvg(safeColor(p.color)));
        node.appendChild(el('div', 'ptr-name', p.name || '?'));
        cursorLayer.appendChild(node);
        cursorEls.set(id, node);
      }
      node.style.left = (x * 100) + '%';
      node.style.top = (y * 100) + '%';
    });
    reportRect();
  }

  // ───────── çizim / tıklama dalgası ─────────
  var canvas = document.getElementById('fx');
  var ctx = canvas.getContext('2d');
  var dpr = Math.max(1, window.devicePixelRatio || 1);
  function sizeCanvas() {
    dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
  }
  sizeCanvas();
  window.addEventListener('resize', sizeCanvas);

  var ripples = [];            // { x, y, color, t }
  var strokes = new Map();     // strokeId -> { pid, color, pts: [[x,y]...], t }
  var running = false;
  var BUTTON_COLORS = ['#3b82f6', '#22c55e', '#ef4444'];
  var RIPPLE_MS = 700, STROKE_HOLD_MS = 4000, STROKE_FADE_MS = 1000, MAX_STROKE_POINTS = 800, MAX_STROKES = 60;

  function startLoop() { if (!running) { running = true; requestAnimationFrame(frame); } }

  function frame() {
    var W = window.innerWidth, H = window.innerHeight;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var t = Date.now();

    ripples = ripples.filter(function (r) { return t - r.t < RIPPLE_MS; });
    ripples.forEach(function (r) {
      var k = (t - r.t) / RIPPLE_MS;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = r.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(r.x * W, r.y * H, 8 + k * 34, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = r.color; ctx.globalAlpha = (1 - k) * 0.45;
      ctx.beginPath(); ctx.arc(r.x * W, r.y * H, 6 * (1 - k) + 2, 0, Math.PI * 2); ctx.fill();
    });

    strokes.forEach(function (s, id) {
      var age = t - s.t;
      if (age > STROKE_HOLD_MS + STROKE_FADE_MS) { strokes.delete(id); return; }
      ctx.globalAlpha = age <= STROKE_HOLD_MS ? 1 : 1 - (age - STROKE_HOLD_MS) / STROKE_FADE_MS;
      ctx.strokeStyle = s.color; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.shadowColor = s.color; ctx.shadowBlur = 8;
      ctx.beginPath();
      s.pts.forEach(function (p, i) { if (i === 0) ctx.moveTo(p[0] * W, p[1] * H); else ctx.lineTo(p[0] * W, p[1] * H); });
      if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] * W + 0.1, s.pts[0][1] * H);
      ctx.stroke();
      ctx.shadowBlur = 0;
    });
    ctx.globalAlpha = 1;

    if (ripples.length || strokes.size) requestAnimationFrame(frame);
    else { running = false; ctx.clearRect(0, 0, W, H); }
  }

  function handleEvent(evt) {
    if (!evt || typeof evt !== 'object') return;
    var color = safeColor(evt.color);
    if (evt.type === 'click') {
      var x = num(evt.x, 0, 1), y = num(evt.y, 0, 1);
      if (x == null || y == null) return;
      // Renk fare tuşuna göre: 0 sol (mavi), 1 orta (yeşil), 2 sağ (kırmızı)
      var btn = (evt.button == null || evt.button === '') ? NaN : Number(evt.button);
      if (btn === 0 || btn === 1 || btn === 2) color = BUTTON_COLORS[btn];
      ripples.push({ x: x, y: y, color: color, t: Date.now() });
      if (ripples.length > 30) ripples.shift();
      startLoop();
    } else if (evt.type === 'draw') {
      var id = String(evt.strokeId || '').slice(0, 80);
      if (!id || !Array.isArray(evt.points)) return;
      var s = strokes.get(id);
      if (!s) {
        if (strokes.size >= MAX_STROKES) strokes.delete(strokes.keys().next().value);
        s = { pid: String(evt.participantId || ''), color: color, pts: [], t: Date.now() };
        strokes.set(id, s);
      }
      evt.points.slice(0, 60).forEach(function (p) {
        var px = num(p && p[0], 0, 1), py = num(p && p[1], 0, 1);
        if (px != null && py != null && s.pts.length < MAX_STROKE_POINTS) s.pts.push([px, py]);
      });
      s.t = Date.now();
      startLoop();
    } else if (evt.type === 'draw_clear') {
      var pid = String(evt.participantId || '');
      strokes.forEach(function (st, sid) { if (st.pid === pid) strokes.delete(sid); });
      startLoop();
    }
  }

  // ───────── IPC ─────────
  if (api.onPointerOverlayUpdate) api.onPointerOverlayUpdate(render);
  if (api.onPointerOverlayEvent) api.onPointerOverlayEvent(handleEvent);

  applyPrefs();
  refreshVisibility();
})();
