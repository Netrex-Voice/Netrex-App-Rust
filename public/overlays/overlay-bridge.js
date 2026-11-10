/* Overlay sayfaları için `window.netrex` köprüsü (Tauri).
 *
 * Electron'daki preload.js karşılığıdır, ama yalnızca overlay sayfalarının kullandığı yüzey vardır.
 * Sayfa `<script src="overlay-bridge.js" data-label="…-overlay">` ile yükler; tüm dinleyiciler kurulunca
 * Rust'a `overlay_ready` der (o ana kadar gelen olaylar sırayla iletilir, hiçbiri kaybolmaz).
 */
(function () {
  'use strict';
  var T = window.__TAURI__;
  var script = document.currentScript;
  var label = script && script.getAttribute('data-label');
  if (!T || !T.core || !T.event || !label) return;

  var invoke = T.core.invoke;
  var listening = [];

  function swallow(p) { if (p && p.catch) p.catch(function () {}); }
  function call(cmd, args) { swallow(invoke(cmd, args)); }

  /** Rust olayına abone ol; senkron cleanup döndürür. */
  function on(event, cb) {
    var unlisten = null, cancelled = false;
    var p = T.event.listen(event, function (e) { cb(e.payload); }).then(function (fn) {
      if (cancelled) fn(); else unlisten = fn;
    });
    listening.push(p);
    return function () { cancelled = true; if (unlisten) unlisten(); };
  }

  function hit(rects, extra) {
    var args = { label: label, rects: rects || [] };
    if (extra) for (var k in extra) args[k] = extra[k];
    call('overlay_set_hit', args);
  }

  window.netrex = {
    // --- ortak ---
    onOverlayHover: function (cb) { return on('overlay-hover', cb); },
    reportHit: function (rects, hoverRects, dragging) { hit(rects, { hoverRects: hoverRects || [], dragging: !!dragging }); },

    // --- işaretçi overlay'i ---
    onPointerOverlayUpdate: function (cb) { return on('update-pointer-overlay-data', cb); },
    onPointerOverlayEvent: function (cb) { return on('pointer-overlay-event-data', cb); },
    reportPointerOverlayWidgetRect: function (r) {
      hit(r ? [r] : [], { dragging: !!(r && r.dragging) });
    },
    closePointerOverlay: function () { call('close_pointer_overlay'); },
    grantPointerRequest: function (id) { call('pointer_overlay_notify_main', { kind: 'granted', id: id }); },
    denyPointerRequest: function (id) { call('pointer_overlay_notify_main', { kind: 'denied', id: id }); },
    revokePointer: function (id) { call('pointer_overlay_notify_main', { kind: 'revoked', id: id }); },
    revokeAllPointers: function () { call('pointer_overlay_notify_main', { kind: 'revoke-all' }); },

    // --- ticker ---
    onTickerMessage: function (cb) { return on('ticker-message-data', cb); },
    onTickerClear: function (cb) { return on('ticker-clear', cb); },
    tickerIdle: function () { call('ticker_idle'); },
    closeTicker: function () { call('ticker_close'); },
    reportTickerButtonRect: function (r) { hit(r && r.width > 0 ? [r] : []); },
    reportTickerMessageGeom: function (g) { call('ticker_set_geom', { geom: g || null }); },

    // --- ses overlay'i ---
    onVoiceOverlayUpdate: function (cb) { return on('voice-overlay-data', cb); },
    onVoiceOverlayConfig: function (cb) { return on('voice-overlay-config', cb); },
    voiceOverlayAction: function (action, payload) {
      call('voice_overlay_action', { action: action, payload: payload || null });
    }
  };

  // Sayfa betikleri (dinleyicileri kuranlar) load'dan önce çalışır; kayıtlar bitince hazırım de.
  function announce() {
    Promise.all(listening).then(function () { call('overlay_ready', { label: label }); },
                                function () { call('overlay_ready', { label: label }); });
  }
  if (document.readyState === 'complete') setTimeout(announce, 0);
  else window.addEventListener('load', function () { setTimeout(announce, 0); });
})();
