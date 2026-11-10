/**
 * 🔊 Gerçekçi darbe sesleri (WebAudio sentezi; dosya yok). Ses seviyesi/sessiz oyun tercihlerinden gelir.
 * Her ses: kısa gürültü patlaması (malzeme rezonansına göre bant geçiren) + tını bileşeni; şiddet ve stereo konum.
 */
import { useGamesPrefs } from "../store";

let ctx = null;
let master = null;
let noise = null;
let hum = null;

function ensure() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
    // 1 sn beyaz gürültü tamponu (tüm sesler paylaşır)
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") ctx.resume();
  const { muted, vol } = useGamesPrefs.getState();
  master.gain.value = muted ? 0 : (vol / 100) * 0.9;
  return ctx;
}

function out(pan) {
  if (!ctx.createStereoPanner) return master;
  const p = ctx.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  p.connect(master);
  return p;
}

function burst(dest, { type = "bandpass", freq, q = 1, decay, gain, delay = 0 }) {
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  src.connect(f).connect(g).connect(dest);
  src.start(t, Math.random() * 0.5);
  src.stop(t + decay + 0.02);
}

function tone(dest, { freq, decay, gain, type = "sine", delay = 0, slide = 0 }) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + decay);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + decay + 0.02);
}

// ── Gerçek kayıt sesler (Kenney Casino Audio, CC0): zar, fiş/para, kart. Yüklenemezse (ör. Safari .ogg) sentez devrede ──
const SAMPLE_GROUPS = {
  dieThrow: ["die-throw-1", "die-throw-2", "die-throw-3", "die-throw-4"],
  diceThrow: ["dice-throw-1", "dice-throw-2", "dice-throw-3"],
  diceShake: ["dice-shake-1", "dice-shake-2", "dice-shake-3"],
  chipsCollide: ["chips-collide-1", "chips-collide-2", "chips-collide-3", "chips-collide-4"],
  chipsHandle: ["chips-handle-1", "chips-handle-2", "chips-handle-3", "chips-handle-4", "chips-handle-5", "chips-handle-6"],
  chipsStack: ["chips-stack-1", "chips-stack-2", "chips-stack-3", "chips-stack-4", "chips-stack-5", "chips-stack-6"],
  chipLay: ["chip-lay-1", "chip-lay-2", "chip-lay-3"],
  cardSlide: ["card-slide-1", "card-slide-2", "card-slide-3", "card-slide-4"],
  cardPlace: ["card-place-1", "card-place-2", "card-place-3", "card-place-4"],
};
const buffers = new Map();
let sampleLoad = null;

/** Örnekleri bir kez yükle (sessizce; hata olursa sentez kullanılır) */
export function preloadSamples() {
  if (sampleLoad || typeof window === "undefined") return sampleLoad;
  const c = ensure();
  if (!c) return null;
  const base = window.location.protocol === "file:" ? "." : "";
  const names = [...new Set(Object.values(SAMPLE_GROUPS).flat())];
  sampleLoad = Promise.all(
    names.map(async (n) => {
      try {
        const r = await fetch(`${base}/sounds/emlak/${n}.ogg`);
        if (r.ok) buffers.set(n, await c.decodeAudioData(await r.arrayBuffer()));
      } catch (e) {
        /* sentez yedeği */
      }
    })
  );
  return sampleLoad;
}

/** Gruptan rastgele bir örnek çal; yüklü örnek yoksa false (çağıran sentez kullanır) */
function playSample(group, { gain = 1, rate = 1, pan = 0, delay = 0 } = {}) {
  const names = SAMPLE_GROUPS[group]?.filter((n) => buffers.has(n));
  if (!names || !names.length) return false;
  const src = ctx.createBufferSource();
  src.buffer = buffers.get(names[Math.floor(Math.random() * names.length)]);
  src.playbackRate.value = rate * (0.96 + Math.random() * 0.08);
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g).connect(out(pan));
  src.start(ctx.currentTime + delay);
  return true;
}

/**
 * @param kind puck | rail | goal | paddle | table | net | floor | ballclick | cushion | pocket | cue | dice | buzzer
 * @param k    şiddet 0..1
 * @param pan  -1..1
 */
export function sfx(kind, k = 0.5, pan = 0) {
  if (!ensure()) return;
  if (!sampleLoad) preloadSamples();
  const d = out(pan);
  k = Math.max(0.05, Math.min(1, k));
  switch (kind) {
    case "puck": // sert plastik "çat"
      burst(d, { freq: 2400 + 900 * k, q: 2.2, decay: 0.05, gain: 0.55 * k });
      tone(d, { freq: 1150, decay: 0.035, gain: 0.18 * k, type: "triangle" });
      break;
    case "rail": // ray: daha kalın, kısa
      burst(d, { freq: 900, q: 1.2, decay: 0.07, gain: 0.45 * k });
      tone(d, { freq: 190, decay: 0.09, gain: 0.25 * k });
      break;
    case "goal": // diskin kale yuvasına düşmesi + kısa korna
      burst(d, { type: "lowpass", freq: 500, decay: 0.25, gain: 0.6 });
      tone(d, { freq: 120, decay: 0.3, gain: 0.35, slide: 0.6 });
      tone(d, { freq: 523, decay: 0.45, gain: 0.08, type: "sawtooth", delay: 0.18 });
      tone(d, { freq: 659, decay: 0.45, gain: 0.07, type: "sawtooth", delay: 0.18 });
      break;
    case "paddle": // masa tenisi raket "tok"
      tone(d, { freq: 1500 + 400 * k, decay: 0.03, gain: 0.3 * k });
      burst(d, { freq: 3200, q: 1.5, decay: 0.025, gain: 0.35 * k });
      break;
    case "table": // masa sekmesi
      tone(d, { freq: 860, decay: 0.05, gain: 0.32 * k });
      burst(d, { freq: 1800, q: 1.4, decay: 0.035, gain: 0.25 * k });
      break;
    case "net":
      burst(d, { type: "lowpass", freq: 1100, decay: 0.09, gain: 0.3 * k });
      break;
    case "floor":
      tone(d, { freq: 620, decay: 0.06, gain: 0.18 * k });
      burst(d, { freq: 1300, q: 1, decay: 0.05, gain: 0.15 * k });
      break;
    case "ballclick": // bilardo topları
      tone(d, { freq: 2900 + 600 * k, decay: 0.022, gain: 0.35 * k });
      burst(d, { freq: 4200, q: 2.5, decay: 0.02, gain: 0.4 * k });
      break;
    case "cushion":
      burst(d, { freq: 420, q: 0.9, decay: 0.08, gain: 0.4 * k });
      tone(d, { freq: 140, decay: 0.08, gain: 0.2 * k });
      break;
    case "pocket":
      burst(d, { type: "lowpass", freq: 380, decay: 0.35, gain: 0.5 });
      tone(d, { freq: 95, decay: 0.3, gain: 0.3, slide: 0.7 });
      break;
    case "cue":
      tone(d, { freq: 1900, decay: 0.03, gain: 0.25 * k });
      burst(d, { freq: 2600, q: 1.8, decay: 0.03, gain: 0.3 * k });
      break;
    case "dice": // zar çarpması: gerçek kayıt (şiddete göre sesli/ince)
      if (playSample("dieThrow", { gain: 0.35 + 0.65 * k, rate: 0.9 + 0.2 * k, pan })) break;
      burst(d, { freq: 1600 + 600 * Math.random(), q: 2, decay: 0.03, gain: 0.35 * k });
      tone(d, { freq: 900 + 500 * Math.random(), decay: 0.025, gain: 0.12 * k });
      break;
    case "buzzer":
      tone(d, { freq: 440, decay: 0.35, gain: 0.08, type: "square" });
      break;
    case "coin": // para / fiş sesi (gerçek kayıt) + ince bir çınlama
      if (playSample(Math.random() < 0.5 ? "chipsCollide" : "chipsHandle", { gain: 0.95 })) {
        tone(d, { freq: 2093, decay: 0.18, gain: 0.04, type: "triangle", delay: 0.06 });
        break;
      }
      tone(d, { freq: 1568, decay: 0.14, gain: 0.16, type: "triangle" });
      tone(d, { freq: 2093, decay: 0.28, gain: 0.14, type: "triangle", delay: 0.07 });
      break;
    case "ding": // bildirim
      tone(d, { freq: 880, decay: 0.32, gain: 0.14 });
      tone(d, { freq: 1320, decay: 0.25, gain: 0.07, delay: 0.04 });
      break;
    case "fanfare": // başlangıçtan geçiş / çift zar
      [523, 659, 784, 1047].forEach((f, i) => tone(d, { freq: f, decay: 0.22, gain: 0.11, type: "triangle", delay: i * 0.08 }));
      break;
    case "build": // ev/otel: üst üste dizilen fişler (gerçek kayıt)
      if (playSample("chipsStack", { gain: 1 })) break;
      burst(d, { type: "lowpass", freq: 700, decay: 0.12, gain: 0.45 });
      tone(d, { freq: 200, decay: 0.12, gain: 0.25, slide: 0.6 });
      tone(d, { freq: 1200, decay: 0.05, gain: 0.12, delay: 0.1 });
      break;
    case "rollStart": // zarı avuçta sallama
      playSample("diceShake", { gain: 0.9 });
      break;
    case "card": // kart çevirme: kayma + yerine koyma
      if (playSample("cardSlide", { gain: 0.9 })) playSample("cardPlace", { gain: 0.8, delay: 0.3 });
      else tone(d, { freq: 700, decay: 0.12, gain: 0.1, type: "triangle", slide: 0.5 });
      break;
    case "bad": // vergi / iflas: alçalan ton
      tone(d, { freq: 330, decay: 0.4, gain: 0.14, type: "sawtooth", slide: 0.5 });
      break;
    case "jail": // gözaltı: alçak vızıltı
      tone(d, { freq: 150, decay: 0.45, gain: 0.12, type: "sawtooth" });
      tone(d, { freq: 155, decay: 0.45, gain: 0.1, type: "square" });
      break;
    case "hop": // piyon adımı: hafif tık (gerçek kayıt)
      if (playSample("chipLay", { gain: 0.5 })) break;
      tone(d, { freq: 520 + 260 * Math.random(), decay: 0.05, gain: 0.08, type: "triangle" });
      break;
    default:
  }
}

/** Air hockey üfleyici uğultusu (döngü). Döndürdüğü fonksiyon durdurur. */
export function startHum(level = 0.035) {
  if (!ensure()) return () => {};
  stopHum();
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 380;
  const g = ctx.createGain();
  g.gain.value = level;
  src.connect(f).connect(g).connect(master);
  src.start();
  hum = src;
  return stopHum;
}
export function stopHum() {
  try {
    hum?.stop();
  } catch (e) {}
  hum = null;
}
export function refreshVolume() {
  ensure();
}
