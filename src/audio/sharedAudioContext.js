// Ses işlemcisinin ortak AudioContext'i ve worklet yükleme yardımcıları.
//
// Önceden ısıtma (prewarm): odaya girerken LiveKit bağlantısı/token/mikrofon izni 1-3 sn sürer. Worklet dosyalarını
// (RNNoise + VAD) o sırada arka planda yüklersek, mikrofon yayını başlayınca işlemci hemen kurulur ve
// "bağlanıyor" süresi kısalır. Odadan çıkınca context kapatılır (boştayken RAM tutmayız).

export const SAMPLE_RATE = 48000; // RNNoise 48 kHz ile çalışır; farklı hızda yeniden örnekleme gerekir
export const RNNOISE_WORKLET = "rnnoise-suppressor.worklet.js";
export const VAD_WORKLET = "voice-processor.worklet.js";

// ── Kaynak yolu (Electron'da paketli dosyalar) ──────────────
let cachedResourcesPath = null;

export const initResourcesPath = async () => {
  if (cachedResourcesPath) return cachedResourcesPath;

  if (typeof window !== "undefined" && window.netrex?.getResourcesPath) {
    try {
      cachedResourcesPath = await window.netrex.getResourcesPath();
      console.log("✅ Resources path cached:", cachedResourcesPath);
    } catch (e) {
      console.warn("Resources path init failed:", e);
    }
  }
  return cachedResourcesPath;
};

export const getResourcePath = (filename) => {
  if (
    process.env.NODE_ENV === "development" ||
    (typeof window !== "undefined" && window.location.protocol.startsWith("http"))
  ) {
    return `/${filename}`;
  }
  if (cachedResourcesPath) {
    const cleanPath = cachedResourcesPath.replace(/\\/g, "/").replace(/\/+$/, "");
    const cleanFilename = filename.replace(/^\/+/, "");
    return `file:///${cleanPath}/${cleanFilename}`;
  }
  return `/${filename}`;
};

// ── Ortak AudioContext ──────────────────────────────────────
let sharedCtx = null;

export async function getSharedAudioContext() {
  if (!sharedCtx || sharedCtx.state === "closed") {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    sharedCtx = new AudioCtx({ sampleRate: SAMPLE_RATE, latencyHint: "interactive" });
  }
  try {
    if (sharedCtx.state === "suspended") await sharedCtx.resume();
  } catch (e) {
    // Kullanıcı etkileşimi olmadan resume reddedilebilir (prewarm sırasında); işlemci kurulurken tekrar denenir
  }
  return sharedCtx;
}

export function closeSharedAudioContext() {
  if (sharedCtx && sharedCtx.state !== "closed") {
    sharedCtx.close().catch(() => {});
  }
  sharedCtx = null;
}

// ── Worklet modülü yükleme (context başına bir kez, eşzamanlı çağrılar aynı sözü paylaşır) ──
const modulePromises = new WeakMap(); // ctx -> Map<url, Promise>

export function ensureWorkletModule(ctx, url) {
  let map = modulePromises.get(ctx);
  if (!map) {
    map = new Map();
    modulePromises.set(ctx, map);
  }
  let p = map.get(url);
  if (!p) {
    p = ctx.audioWorklet.addModule(url).catch((e) => {
      map.delete(url); // başarısızsa sonraki denemede tekrar yüklensin
      throw e;
    });
    map.set(url, p);
  }
  return p;
}

/** Odaya girerken çağır: context'i oluşturur ve iki worklet'i arka planda yükler. Hata fırlatmaz. */
export async function prewarmVoiceAudio() {
  try {
    await initResourcesPath();
    const ctx = await getSharedAudioContext();
    await Promise.allSettled([
      ensureWorkletModule(ctx, getResourcePath(VAD_WORKLET)),
      ensureWorkletModule(ctx, getResourcePath(RNNOISE_WORKLET)),
    ]);
  } catch (e) {
    console.warn("Ses önceden ısıtma başarısız (sorun değil, odada tekrar denenecek):", e);
  }
}
