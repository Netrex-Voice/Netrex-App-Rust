// ============================================
// 🦀 TAURI BRIDGE — window.netrex (eski Electron preload yüzeyi)
// ============================================
//
// React kodu `window.netrex.*` üzerinden konuşmaya devam eder; bu dosya aynı
// yüzeyi Tauri komutları/olayları ile sağlar. Böylece arayüz kodu değişmeden kalır.
//
// Durum (faz faz doldurulur):
//   Faz 0  → tüm yüzey tanımlı; ayar get/set localStorage'a düşer, gerisi stub
//   Faz 1  → ✅ pencere/tray/yaşam döngüsü
//   Faz 2  → ✅ ayarlar + yollar + dış link + OAuth + admin (Rust)
//   Faz 3  → ✅ global kısayollar / input listener
//   Faz 4  → LiveKit token/server-info, Cloudinary, YouTube playlist
//   Faz 5  → overlay pencereleri (pointer / ticker / voice): TAMAM (overlay.rs)
//   Faz 6  → güncelleme
//   Faz 7  → ekran paylaşımı kaynakları
//
// Yalnızca Tauri içinde (window.__TAURI_INTERNALS__) etkinleşir; düz web
// build'inde dokunmaz ve platformBridge.js API route'larına düşer.
// ============================================

import { Channel, invoke } from "@tauri-apps/api/core";
import { listen, once } from "@tauri-apps/api/event";

/**
 * Gerçek olay dinleyicisi (Electron `createEventHandler` karşılığı):
 * `cb`'yi Rust olayına bağlar ve SENKRON bir cleanup fonksiyonu döndürür.
 * `listen` asenkron olduğundan, cleanup erken çağrılırsa abonelik kurulur kurulmaz bırakılır.
 */
const eventHandler = (event) => (cb) => {
  let unlisten = null;
  let cancelled = false;
  listen(event, (e) => cb(e.payload)).then((fn) => {
    if (cancelled) fn();
    else unlisten = fn;
  });
  return () => {
    cancelled = true;
    if (unlisten) unlisten();
  };
};

/** Tek seferlik dinleyici (Electron `createOnceHandler`; cleanup döndürmez). */
const onceHandler = (event) => (cb) => {
  once(event, (e) => cb(e.payload));
};

/** Rust komutu; hata olursa konsola yazar ama çağıranı bozmaz (void çağrılar için). */
const send = (cmd, args) => {
  invoke(cmd, args).catch((err) => console.error(`[netrex] ${cmd}:`, err));
};

/**
 * Tuş/fare ATAMA (kayıt) kaynağı: global kanca yerine pencerenin kendi olayları.
 *
 * Atama sırasında Netrex penceresi zaten öndedir; tarayıcının `KeyboardEvent.code` değeri tam olarak
 * kısayolların saklandığı standart fiziksel tuş adıdır ("F5", "KeyA", "ShiftRight", "Numpad0"…).
 * Windows kancasına bağımlı değildir (kanca olay kaçırabiliyordu); macOS/Linux'ta erişilebilirlik
 * izni de gerekmez. Global kanca yalnızca kısayolun oyundayken TETİKLENMESİ için kullanılır.
 *
 * Esc kısayol olamaz: ayarlar penceresini kapatıp kaydı iptal eder.
 * DOM fare düğmeleri: 1 = orta, 3 = geri, 4 = ileri  →  Netrex: 3, 4, 5.
 */
const DOM_MOUSE_TO_NETREX = { 1: 3, 3: 4, 4: 5 };

const trace = (line) => {
  invoke("trace_input", { line }).catch(() => {});
};

const MODIFIER_CODES = new Set(["ShiftLeft","ShiftRight","ControlLeft","ControlRight","AltLeft","AltRight","MetaLeft","MetaRight"]);

const domRawKeydown = (cb) => {
  // Tek başına modifier (ör. Sağ Shift): basılıp BIRAKILINCA, arada başka tuş basılmadıysa atama biter.
  // (Aksi hâlde arayüz "kombinasyon bekliyorum" diye açık kalır ve kaydedilmemiş gibi görünür.)
  let pendingModifier = null;
  const swallow = (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  const emitKey = (e) => {
    cb({
      type: "keyboard",
      code: e.code,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
    });
  };
  const onKeyDown = (e) => {
    trace(`keydown ${e.code} repeat=${e.repeat}`);
    if (!e.code || e.code === "Escape" || e.code === "Unidentified") return;
    swallow(e); // boşluk/Enter odaktaki düğmeye basmasın, harf bir alana yazılmasın
    if (e.repeat || e.isComposing) return; // basılı tutma tekrarları yeni basış değil
    if (e.code === "PrintScreen") return; // tarayıcı yalnızca keyup verir (aşağıda)
    pendingModifier = MODIFIER_CODES.has(e.code) ? e.code : null;
    emitKey(e);
  };
  // PrintScreen tarayıcıda yalnızca keyup üretir
  const onKeyUp = (e) => {
    if (pendingModifier && e.code === pendingModifier) {
      pendingModifier = null;
      swallow(e);
      cb({ type: "keyboard", code: e.code, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, finish: true });
      return;
    }
    if (e.code === "PrintScreen") {
      swallow(e);
      emitKey(e);
    }
  };
  const onMouseDown = (e) => {
    const button = DOM_MOUSE_TO_NETREX[e.button];
    if (button) trace(`mousedown ${button}`);
    if (!button) return; // sol/sağ tık kısayol olamaz
    swallow(e);
    cb({ type: "mouse", mouseButton: button });
  };
  // Geri/ileri tuşları mouseup/auxclick ile sayfada gezinti yapmasın
  const blockNav = (e) => {
    if (DOM_MOUSE_TO_NETREX[e.button]) swallow(e);
  };

  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);
  window.addEventListener("mousedown", onMouseDown, true);
  window.addEventListener("mouseup", blockNav, true);
  window.addEventListener("auxclick", blockNav, true);
  return () => {
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("keyup", onKeyUp, true);
    window.removeEventListener("mousedown", onMouseDown, true);
    window.removeEventListener("mouseup", blockNav, true);
    window.removeEventListener("auxclick", blockNav, true);
  };
};

/**
 * Atama kaynağı: sayfanın kendi olayları VE global kanca (Rust `raw-keydown`). Hangisi çalışırsa atama
 * olur (ör. WebView klavye odağı kaybetmişse sayfa olayı gelmez, kanca gelir; tersi de geçerli).
 * Aynı tuş iki kaynaktan 250 ms içinde gelirse tek basış sayılır.
 */
const rawKeydownFromAnySource = (cb) => {
  let last = { key: null, t: 0 };
  const once = (ev) => {
    const key = ev.type === "mouse" ? `m${ev.mouseButton}` : `k${ev.code}${ev.finish ? ":finish" : ""}`;
    const now = Date.now();
    if (key === last.key && now - last.t < 250) return;
    last = { key, t: now };
    cb(ev);
  };
  const offDom = domRawKeydown(once);
  const offHook = eventHandler("raw-keydown")((ev) => {
    // Kanca Esc'i de iletir; Esc kısayol olamaz (DOM yolu da yok sayar)
    if (ev && ev.code === "Escape") return;
    once(ev);
  });
  return () => {
    offDom();
    offHook();
  };
};

/**
 * Ekran/pencere yakalama (src-tauri/src/capture.rs): Rust, Windows Graphics Capture ile kareleri
 * WebView2 PAYLAŞIMLI BELLEĞİNE yazar (sıfır kopya). Burada WebGL ile bir canvas'a çizilir ve
 * `canvas.captureStream()` ile bir MediaStream olarak LiveKit'e verilir.
 * Paylaşımlı bellek: [0] kare sayacı, [1] genişlik, [2] yükseklik (u32), [16..) BGRA pikseller.
 */
/** Yakalanan sesi çalan AudioWorklet: Rust'tan gelen 10 ms'lik float32 stereo parçaları halka tamponla çıkışa verir. */
const CAPTURE_AUDIO_WORKLET = `
class NetrexCaptureAudio extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Float32Array(48000 * 2); // 1 sn
    this.r = 0; this.w = 0; this.n = 0;
    this.port.onmessage = (e) => {
      const a = e.data;
      // Birikme (≈400 ms'den fazla): en eskiyi at, gecikme büyümesin
      if (this.n + a.length > 48000 * 2 * 0.4) { this.r = this.w; this.n = 0; }
      for (let i = 0; i < a.length; i++) {
        this.buf[this.w] = a[i];
        this.w = (this.w + 1) % this.buf.length;
      }
      this.n += a.length;
    };
  }
  process(_inputs, outputs) {
    const out = outputs[0];
    const L = out[0];
    const R = out[1] || out[0];
    for (let i = 0; i < L.length; i++) {
      if (this.n >= 2) {
        L[i] = this.buf[this.r]; this.r = (this.r + 1) % this.buf.length;
        R[i] = this.buf[this.r]; this.r = (this.r + 1) % this.buf.length;
        this.n -= 2;
      } else { L[i] = 0; R[i] = 0; }
    }
    return true;
  }
}
registerProcessor("netrex-capture-audio", NetrexCaptureAudio);
`;

/** Tauri kanalından gelen ham baytları ArrayBuffer'a normalleştirir (sürüme göre biçim değişebilir). */
const toArrayBuffer = (d) => {
  if (d instanceof ArrayBuffer) return d;
  if (ArrayBuffer.isView(d)) return d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength);
  if (Array.isArray(d)) return Uint8Array.from(d).buffer;
  return null;
};

// --- WebRTC kodlayıcı sızıntısı çözümü ---
// LiveKit bağlantıyı açık tutup her yayında yeni bir transceiver açıyor; yayın bitince track çıkarılsa da
// transceiver (ve içindeki VP8 kodlayıcının ~90 MB'lık belleği) bağlantı boyunca kalıyor (ölçüldü:
// 5 yayın = +465 MB). Bitmiş yayının transceiver'ı `stop()` edilince bellek geri verilir.
const trackedPeerConnections = new Set();
if (typeof window !== "undefined" && window.RTCPeerConnection && !window.__netrexPcTracked) {
  window.__netrexPcTracked = true;
  const NativePC = window.RTCPeerConnection;
  window.RTCPeerConnection = class extends NativePC {
    constructor(...args) {
      super(...args);
      const ref = new WeakRef(this);
      trackedPeerConnections.add(ref);
      this.addEventListener("connectionstatechange", () => {
        if (this.connectionState === "closed") trackedPeerConnections.delete(ref);
      });
    }
  };
  Object.defineProperty(window.RTCPeerConnection, "name", { value: "RTCPeerConnection" });
}

/** `track` gönderen transceiver'ları bulur; track çıkarılıp bağlantı durulunca durdurur. */
function releaseTransceiversOf(track) {
  const owned = [];
  for (const ref of trackedPeerConnections) {
    const pc = ref.deref();
    if (!pc) { trackedPeerConnections.delete(ref); continue; }
    try {
      for (const tr of pc.getTransceivers()) {
        if (tr.sender && tr.sender.track === track) owned.push({ pc, tr });
      }
    } catch (_) { /* kapanmış bağlantı */ }
  }
  if (!owned.length) return;
  const started = performance.now();
  const poll = setInterval(() => {
    for (let i = owned.length - 1; i >= 0; i--) {
      const { pc, tr } = owned[i];
      let done = false;
      try {
        if (pc.connectionState === "closed" || tr.stopped) done = true;
        else if (tr.sender.track == null && pc.signalingState === "stable") { tr.stop(); done = true; }
      } catch (_) { done = true; }
      if (done) owned.splice(i, 1);
    }
    if (!owned.length || performance.now() - started > 15000) clearInterval(poll);
  }, 300);
}

async function captureSource(sourceId, { width = 1920, height = 1080, fps = 30, audio = false } = {}) {
  const wv = window.chrome && window.chrome.webview;
  if (!wv || !wv.addEventListener) throw new Error("Bu WebView ekran yakalamayı desteklemiyor");

  // Tampon, Rust tarafından sayfaya gönderilir; dinleyici `start_capture`tan ÖNCE kurulmalı.
  let bufferTimer;
  const bufferPromise = new Promise((resolve, reject) => {
    const onBuf = (e) => {
      if (!e.additionalData || e.additionalData.kind !== "netrex-capture") return;
      clearTimeout(bufferTimer);
      wv.removeEventListener("sharedbufferreceived", onBuf);
      resolve(e.getBuffer());
    };
    bufferTimer = setTimeout(() => {
      wv.removeEventListener("sharedbufferreceived", onBuf);
      reject(new Error("Yakalama belleği alınamadı"));
    }, 6000);
    wv.addEventListener("sharedbufferreceived", onBuf);
  });
  bufferPromise.catch(() => {}); // start_capture hata verirse yutulmamış reddi önle

  // Ses hattı (isteğe bağlı): kanal → AudioWorklet → MediaStreamDestination
  const audioChannel = new Channel();
  let audioCtx = null;
  let audioNode = null;
  let audioTrack = null;
  if (audio) {
    try {
      audioCtx = new AudioContext({ sampleRate: 48000, latencyHint: "interactive" });
      const url = URL.createObjectURL(new Blob([CAPTURE_AUDIO_WORKLET], { type: "text/javascript" }));
      await audioCtx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      audioNode = new AudioWorkletNode(audioCtx, "netrex-capture-audio", { numberOfInputs: 0, outputChannelCount: [2] });
      const dest = audioCtx.createMediaStreamDestination();
      audioNode.connect(dest);
      audioTrack = dest.stream.getAudioTracks()[0];
      audioChannel.onmessage = (data) => {
        const buf = toArrayBuffer(data);
        if (buf && audioNode) audioNode.port.postMessage(new Float32Array(buf));
      };
    } catch (e) {
      console.warn("[netrex] ekran sesi hazırlanamadı:", e);
      if (audioCtx) audioCtx.close().catch(() => {});
      audioCtx = null;
      audioNode = null;
      audioTrack = null;
    }
  }

  let info;
  try {
    info = await invoke("start_capture", { sourceId, fps, audio: audioTrack ? audio : null, onAudio: audioChannel });
  } catch (e) {
    clearTimeout(bufferTimer);
    if (audioCtx) audioCtx.close().catch(() => {});
    throw new Error(typeof e === "string" ? e : (e && e.message) || "Ekran yakalama başlatılamadı");
  }
  if (audioTrack && !info.audio) {
    console.warn("[netrex] ekran sesi yakalanamadı, yalnızca görüntü paylaşılıyor:", info.audioError);
    audioCtx.close().catch(() => {});
    audioCtx = null;
    audioTrack = null;
  }
  const arrayBuffer = await bufferPromise;
  const header = new Uint32Array(arrayBuffer, 0, 4);

  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl", { alpha: false, antialias: false, preserveDrawingBuffer: true });
  if (!gl) {
    invoke("stop_capture").catch(() => {});
    throw new Error("WebGL kullanılamıyor");
  }
  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return sh;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER,
    "attribute vec2 p; varying vec2 uv; void main(){ uv = vec2(p.x*0.5+0.5, 0.5-p.y*0.5); gl_Position = vec4(p,0.0,1.0); }"));
  // Paylaşımlı bellekteki pikseller BGRA: shader'da RGB'ye çevrilir (CPU'da döngü yok)
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER,
    "precision mediump float; varying vec2 uv; uniform sampler2D t; void main(){ gl_FragColor = vec4(texture2D(t, uv).bgr, 1.0); }"));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const vb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // İstenen kutuya sığdır (büyütme yok), çift sayıya yuvarla (video kodlayıcılar için)
  const fitSize = (sw, sh) => {
    const k = Math.min(1, width / sw, height / sh);
    return [Math.max(2, Math.round(sw * k) & ~1), Math.max(2, Math.round(sh * k) & ~1)];
  };

  const stream = canvas.captureStream(0); // kareler elle istenir: yinelenen kare yok
  const track = stream.getVideoTracks()[0];
  if (audioTrack) stream.addTrack(audioTrack);
  let lastCounter = 0;
  let lastDraw = 0;
  let stopped = false;
  let timer = null;

  const draw = () => {
    const sw = header[1];
    const sh = header[2];
    if (!sw || !sh) return false;
    const counter = header[0];
    const changed = counter !== lastCounter;
    const [cw, ch] = fitSize(sw, sh);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    gl.viewport(0, 0, cw, ch);
    if (changed) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, sw, sh, 0, gl.RGBA, gl.UNSIGNED_BYTE,
        new Uint8Array(arrayBuffer, 16, sw * sh * 4));
      lastCounter = counter;
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    if (track.requestFrame) track.requestFrame();
    lastDraw = performance.now();
    return true;
  };

  const tick = () => {
    if (stopped) return;
    // Yeni kare geldiyse çiz; içerik durağansa (pencere değişmiyor) saniyede bir tazele
    if (header[0] !== lastCounter || performance.now() - lastDraw > 1000) draw();
    timer = setTimeout(tick, 4);
  };

  const cleanup = () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    releaseTransceiversOf(track); // track hâlâ gönderene bağlıyken transceiver'ı yakala
    // Önce Rust yakalamayı durdursun (paylaşımlı belleğe yazmayı bıraksın), SONRA JS eşlemesini bırak.
    invoke("stop_capture")
      .catch(() => {})
      .finally(() => {
        // WebView2: sayfadaki paylaşımlı bellek eşlemesi YALNIZCA releaseBuffer ile serbest kalır;
        // GC yetmez. Çağrılmadığında her yayın ~33 MB+ eşlenmiş bellek bırakıyordu (RAM sızıntısı).
        try { wv.releaseBuffer(arrayBuffer); } catch (_) { /* zaten bırakılmış */ }
        // Ses kanalının Tauri geri çağırma kaydını sil (kapanış AudioContext/Worklet'i tutuyordu)
        try { window.__TAURI_INTERNALS__.unregisterCallback(audioChannel.id); } catch (_) { /* yok */ }
      });
    audioChannel.onmessage = () => {};
    if (audioTrack) audioTrack.stop();
    if (audioNode) {
      try { audioNode.port.onmessage = null; audioNode.disconnect(); } catch (_) { /* kapanmış */ }
      audioNode = null;
    }
    if (audioCtx) audioCtx.close().catch(() => {});
    audioCtx = null;
    audioTrack = null;
    // WebGL kaynakları + canvas'ın arka belleği (1920x1080 ≈ 8 MB) açıkça bırakılır
    try {
      gl.deleteTexture(tex);
      gl.deleteBuffer(vb);
      gl.deleteProgram(prog);
    } catch (_) { /* bağlam zaten kayıp */ }
    const ext = gl.getExtension("WEBGL_lose_context");
    if (ext) ext.loseContext();
    canvas.width = 1;
    canvas.height = 1;
  };
  const originalStop = track.stop.bind(track);
  track.stop = () => {
    originalStop();
    cleanup();
  };
  track.addEventListener("ended", cleanup);

  // İlk kare gelene kadar bekle (çözünürlük belli olsun); 4 sn içinde gelmezse yine de devam et
  const t0 = performance.now();
  while (header[0] === 0 && performance.now() - t0 < 4000) {
    await new Promise((r) => setTimeout(r, 20));
  }
  draw();
  tick();
  return stream;
}

/**
 * Yeni gelen işaretçi izin istekleri için işletim sistemi bildirimi (Electron `notifyNewPointerRequests`).
 * Kullanıcıdan karar bekleyen bir istek olduğundan bildirim ayarına bağlı değildir; WebView izni
 * `webview_lock.rs` ile uygulamanın kendi origin'ine zaten verilir.
 */
const knownPointerRequests = new Set();
function notifyNewPointerRequests(payload) {
  try {
    const requests = Array.isArray(payload) ? [] : (payload && payload.requests) || [];
    const ids = new Set(requests.map((r) => String(r.id)));
    const fresh = requests.filter((r) => !knownPointerRequests.has(String(r.id)));
    knownPointerRequests.clear();
    ids.forEach((id) => knownPointerRequests.add(id));
    if (!fresh.length || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const names = fresh.map((r) => String(r.name || "Bir kullanıcı").slice(0, 40)).join(", ");
    new Notification("Netrex - İşaretçi İsteği", { body: `${names} ekranınızda bir şey göstermek istiyor`, silent: true });
  } catch (_) { /* bildirim yalnızca bir kolaylık */ }
}

/**
 * Sunucu (Vercel, `server/` klasörü): LiveKit token ve Cloudinary silme. Secret'lar yalnızca orada durur.
 * Adres derleme zamanında `NEXT_PUBLIC_NETREX_API_URL` ile verilir. TANIMSIZSA uygulama eski yerel yola
 * (Rust, gömülü anahtarlar) düşer: sunucu hazır olana kadar hiçbir şey kırılmaz.
 */
const API_URL = (process.env.NEXT_PUBLIC_NETREX_API_URL || "").replace(/\/+$/, "");

/** Firebase girişinin güncel ID token'ı (süresi dolmuşsa SDK kendiliğinden yeniler). */
async function firebaseIdToken() {
  const { auth } = await import("@/src/lib/firebase");
  const user = auth.currentUser;
  if (!user) throw new Error("Giriş yapılmamış");
  return user.getIdToken();
}

/** Sunucuya kimlikli istek; hata gövdesindeki mesajı fırlatır. */
async function apiCall(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await firebaseIdToken()}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Sunucu hatası (${res.status})`);
  return data;
}

let inputListenerRefs = 0;

function buildBridge() {
  return {
    // Arayüz, Electron'a özgü yolları (desktopCapturer ile ekran kaynağı seçimi) bu bayrakla ayırır.
    isTauri: true,
    captureSource,

    // --- AUTH ---
    // Firebase yapılandırması build'e gömülü (NEXT_PUBLIC_*); sistem tarayıcısındaki giriş sayfasına geçirilir.
    startOAuth: () =>
      invoke("start_oauth", {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      }),
    onOAuthSuccess: eventHandler("oauth-success"),

    // --- SETTINGS & HOTKEYS ---
    // Kısayollar artık fiziksel tuş adıyla saklanır: {type:"keyboard", code:"KeyV", ctrlKey…} / {type:"mouse", mouseButton}
    updateHotkey: (action, keybinding) => invoke("update_hotkey", { action, keybinding }),
    getHotkey: (action) => invoke("get_hotkey", { action }),
    onHotkeyTriggered: eventHandler("hotkey-triggered"),
    setRecordingMode: (enabled) => invoke("set_recording_mode", { enabled }),
    onRawKeydown: rawKeydownFromAnySource,

    // --- LIVEKIT ---
    getLiveKitToken: API_URL
      ? async (room, identity, displayName, serverIndex = 0) =>
          (await apiCall("/api/livekit-token", { method: "POST", body: { room, identity, displayName, serverIndex } })).token
      : (room, identity, displayName, serverIndex = 0) =>
          invoke("get_livekit_token", { room, identity, displayName, serverIndex }),
    getLiveKitServerInfo: API_URL
      ? (serverIndex = 0) => apiCall(`/api/livekit-server-info?serverIndex=${encodeURIComponent(serverIndex)}`)
      : (serverIndex = 0) => invoke("get_livekit_server_info", { serverIndex }),

    // --- UTILS ---
    openExternalLink: (url) => invoke("open_external_link", { url }),

    // --- AUTO UPDATE ---
    // Rust olayları dizi taşır: update-status → [durum, bilgi?]; Electron'daki (durum, bilgi) imzası korunur.
    onUpdateStatus: (cb) => {
      const un = eventHandler("update-status")((p) => cb(p && p[0], p && p[1]));
      // Dinleyici olaydan sonra kurulduysa (açılış yarışı) son durumu hemen ver
      invoke("update_last_status").then((p) => { if (p) cb(p[0], p[1]); }).catch(() => {});
      return un;
    },
    onUpdateProgress: eventHandler("update-progress"),
    onUpdateRestarting: eventHandler("update-restarting"),
    onUpdateRestartFailed: eventHandler("update-restart-failed"),
    quitAndInstall: () => send("quit_and_install"),

    // --- SCREEN SHARE ---
    getDesktopSources: () => invoke("get_desktop_sources"),
    getMousePosition: () => invoke("get_mouse_position"),

    // --- SETTINGS (Rust store; Faz 2'de genişler) ---
    setSetting: (key, value) => invoke("set_setting", { key, value }),
    getSetting: async (key) => {
      const v = await invoke("get_setting", { key });
      return v === null ? undefined : v; // electron-store: olmayan anahtar → undefined
    },

    // --- PATHS ---
    getAppPath: () => invoke("get_app_path"),
    // Bilerek boş: worklet'ler aynı origin'den `/dosya` olarak yüklenir (bkz. src-tauri/src/misc.rs)
    getResourcesPath: () => invoke("get_resources_path"),

    // --- DEVTOOLS / ADMIN ---
    openDevTools: (uid) => invoke("open_devtools", { uid }),
    isAdmin: (uid) => invoke("is_admin", { uid }),
    setCurrentUserUid: (uid) => invoke("set_current_user_uid", { uid }),

    // --- WINDOW ---
    focusWindow: () => invoke("focus_window"),

    // --- SPLASH ---
    notifySplashComplete: () => invoke("splash_complete"),

    // --- APP LIFECYCLE ---
    reloadApp: () => window.location.reload(),
    onAppWillQuit: onceHandler("app-will-quit"),
    notifyCleanupComplete: () => send("cleanup_complete"),

    // --- WINDOW STATE ---
    onWindowStateChanged: eventHandler("window-state-changed"),

    // --- INPUT LISTENER ---
    // Dinleyici SAYAÇLIDIR: ActiveRoom (sesli oda) ve ayarlar ekranı (tuş atama) ayrı ayrı başlatıp
    // durdurur. Ayarlar penceresi uygulamanın en üstünde durduğundan odanın "içinde" sayılmaz ve atama
    // bitince dinleyiciyi söküyordu → oda açıkken kısayollar ölüyordu. Artık yalnızca son durduran söker.
    startInputListener: async () => {
      inputListenerRefs += 1;
      if (inputListenerRefs > 1) return { success: true }; // zaten açık
      try {
        const r = await invoke("start_input_listener");
        if (r && r.success === false) inputListenerRefs = Math.max(0, inputListenerRefs - 1);
        return r;
      } catch (e) {
        inputListenerRefs = Math.max(0, inputListenerRefs - 1);
        throw e;
      }
    },
    stopInputListener: async () => {
      inputListenerRefs = Math.max(0, inputListenerRefs - 1);
      if (inputListenerRefs > 0) return { success: true }; // başka biri hâlâ kullanıyor
      return invoke("stop_input_listener");
    },

    // --- EXIT ---
    onRequestExit: eventHandler("request-exit"),

    // --- POINTER OVERLAY ---
    // Overlay pencereleri Rust'ta (src-tauri/src/overlay.rs); sayfaları public/overlays/*.html.
    updatePointerOverlay: (payload, forceShow) => {
      notifyNewPointerRequests(payload);
      send("update_pointer_overlay", { payload, forceShow: !!forceShow });
    },
    onPointerOverlayUpdate: eventHandler("update-pointer-overlay-data"),
    setOverlayInteractive: (interactive) => send("set_overlay_interactive", { interactive: !!interactive }),
    closePointerOverlay: () => send("close_pointer_overlay"),
    // Overlay sayfası ana pencereye şu olayları yollar (izin ver/reddet/kaldır)
    revokePointer: (id) => send("pointer_overlay_notify_main", { kind: "revoked", id }),
    revokeAllPointers: () => send("pointer_overlay_notify_main", { kind: "revoke-all" }),
    onPointerOverlayRevoked: eventHandler("pointer-overlay-revoked"),
    onPointerOverlayRevokeAll: eventHandler("pointer-overlay-revoke-all"),
    grantPointerRequest: (id) => send("pointer_overlay_notify_main", { kind: "granted", id }),
    denyPointerRequest: (id) => send("pointer_overlay_notify_main", { kind: "denied", id }),
    onPointerOverlayGranted: eventHandler("pointer-overlay-granted"),
    onPointerOverlayDenied: eventHandler("pointer-overlay-denied"),
    sendPointerOverlayEvent: (evt) => send("send_pointer_overlay_event", { evt }),
    onPointerOverlayEvent: eventHandler("pointer-overlay-event-data"),
    reportPointerOverlayWidgetRect: () => {}, // overlay sayfasının kendi işi

    // --- TICKER ---
    // { shown, reason? } döner; shown=false ise çağıran kendi uygulama içi bildirimine düşer.
    showTickerMessage: (msg) => invoke("show_ticker_message", { msg }),
    onTickerMessage: eventHandler("ticker-message-data"),
    onTickerClear: eventHandler("ticker-clear"),
    tickerIdle: () => send("ticker_idle"),
    closeTicker: () => send("ticker_close"),
    reportTickerButtonRect: () => {},
    reportTickerMessageGeom: () => {},

    // --- WATCH PARTY ---
    // Dönüş: { ok: true, title, tracks, truncated } | { ok: false, error }  (Electron ile aynı)
    fetchYouTubePlaylist: (listId) => invoke("fetch_youtube_playlist", { listId }),
    // Cloudinary resim silme (Electron'da /api route'u olmadığı için hiç çalışmıyordu)
    deleteCloudinaryImage: API_URL
      ? (publicId) => apiCall("/api/cloudinary-delete", { method: "POST", body: { public_id: publicId } })
      : (publicId) => invoke("cloudinary_delete", { publicId }),

    // --- VOICE OVERLAY ---
    updateVoiceOverlay: (data) => send("update_voice_overlay", { data }),
    onVoiceOverlayUpdate: eventHandler("voice-overlay-data"),
    voiceOverlayAction: (action, payload) => send("voice_overlay_action", { action, payload: payload ?? null }),
    // Rust olayı { action, payload } taşır; Electron'daki (action, payload) imzası korunur.
    onVoiceOverlayAction: (cb) => eventHandler("voice-overlay-action-response")((p) => cb(p && p.action, p && p.payload)),
    setVoiceOverlayInteractive: () => {}, // tıklanabilirliği Rust imleç konumundan kendisi belirler
    setVoiceOverlayEnabled: (enabled, settings) =>
      send("set_voice_overlay_enabled", { enabled: !!enabled, settings: settings ?? null }),
    closeVoiceOverlay: () => send("close_voice_overlay"),
    onVoiceOverlayAntiCheat: eventHandler("voice-overlay-anticheat"),

    forceQuitApp: () => invoke("app_quit_force"),
  };
}

/**
 * Üretimde yerel tarayıcı sağ tık menüsünü ("Back/Refresh/Save as/Inspect…") kapatır.
 * Windows'ta bunu Rust tarafı WebView2 ayarlarıyla da yapar (src-tauri/src/webview_lock.rs);
 * macOS/Linux'ta bu dinleyici tek savunmadır. Uygulamanın kendi React bağlam menüleri etkilenmez:
 * React olayları kökte işler, bu dinleyici yalnızca varsayılan eylemi iptal eder.
 */
function blockNativeContextMenu() {
  if (process.env.NODE_ENV !== "production") return; // geliştirmede "Inspect" gerekli
  document.addEventListener("contextmenu", (e) => e.preventDefault());
}

export function installTauriBridge() {
  if (typeof window === "undefined") return;
  if (!window.__TAURI_INTERNALS__) return; // düz web: dokunma
  if (window.netrex) return; // zaten kurulu
  window.netrex = buildBridge();
  blockNativeContextMenu();
}

installTauriBridge();
