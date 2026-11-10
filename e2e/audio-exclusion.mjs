// Sistem sesi yakalamada "Netrex'in kendi sesi HARİÇ" modunu ölçer (çalışan, debug portlu uygulamada).
//  - Netrex sayfasından 440 Hz çalar (WebView2 sesi)  -> yakalamada GÖRÜNMEMELİ
//  - Dışarıdan ayrı süreçle (PowerShell) 880 Hz çalar -> yakalamada GÖRÜNMELİ
// Her aşamada yakalanan sesin 440 Hz ve 880 Hz çevresindeki genliği (FFT) ölçülür.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const SR = 48000;
function wav(freq, seconds, amp) {
  const n = Math.floor(SR * seconds);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVE", 8); buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const fade = Math.min(1, i / 2400, (n - i) / 2400);
    buf.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / SR) * amp * fade * 32767), 44 + i * 2);
  }
  return buf;
}
const wavPath = path.join(os.tmpdir(), "netrex-test-880.wav");
fs.writeFileSync(wavPath, wav(880, 3.0, 0.2));

const tabs = await (await fetch("http://127.0.0.1:9222/json")).json();
const page = tabs.find((t) => t.type === "page" && t.url.startsWith("http://tauri.localhost/") && !t.url.includes("/overlays/"));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) pend.get(m.id)(m); };
const ev = (expr) => new Promise((r) => { const k = ++id; pend.set(k, r); ws.send(JSON.stringify({ id: k, method: "Runtime.evaluate", params: { expression: expr, awaitPromise: true, returnByValue: true } })); })
  .then((m) => (m.result.exceptionDetails ? "HATA: " + (m.result.exceptionDetails.exception?.description || "").slice(0, 300) : m.result.result?.value));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1) Yakalamayı başlat (ekran + sistem sesi) ve analizciyi kur
const setup = await ev(`(async () => {
  const s = await window.netrex.captureSource('screen:0:0', { width: 640, height: 360, fps: 5, audio: 'system' });
  const at = s.getAudioTracks()[0];
  if (!at) return 'SES İZİ YOK (yakalama sesi başlatamadı)';
  window.__cap = s;
  const ctx = new AudioContext({ sampleRate: 48000 });
  const src = ctx.createMediaStreamSource(new MediaStream([at]));
  const an = ctx.createAnalyser(); an.fftSize = 8192; an.smoothingTimeConstant = 0;
  src.connect(an);
  window.__an = an; window.__ctx = ctx;
  window.__energy = (hz) => { const d = new Float32Array(an.frequencyBinCount); an.getFloatFrequencyData(d);
    const bin = Math.round(hz / (ctx.sampleRate / an.fftSize)); let m = -200; for (let i = bin - 3; i <= bin + 3; i++) if (d[i] > m) m = d[i]; return m; };
  // Netrex'in kendi sesi: sayfada 440 Hz (kapalı başlar)
  const pctx = new AudioContext(); const osc = pctx.createOscillator(); osc.frequency.value = 440;
  const g = pctx.createGain(); g.gain.value = 0; osc.connect(g); g.connect(pctx.destination); osc.start();
  window.__nx = { g, pctx };
  return 'tamam: ses izi var, ' + at.label;
})()`);
console.log("kurulum:", setup);
if (!String(setup).startsWith("tamam")) { process.exit(1); }
await sleep(1500);

// 2) Aşamalar
async function measure(name, ms = 2400) {
  const samples = [];
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { samples.push(await ev(`JSON.stringify([__energy(440), __energy(880)])`)); await sleep(120); }
  const arr = samples.map((x) => JSON.parse(x));
  const avg = (i) => arr.reduce((a, b) => a + b[i], 0) / arr.length;
  const max = (i) => Math.max(...arr.map((b) => b[i]));
  console.log(`${name.padEnd(46)} 440Hz: ort ${avg(0).toFixed(0).padStart(5)} dB tepe ${max(0).toFixed(0).padStart(5)} | 880Hz: ort ${avg(1).toFixed(0).padStart(5)} dB tepe ${max(1).toFixed(0).padStart(5)}`);
  return { n440: max(0), n880: max(1) };
}
const A = await measure("A) sessizlik (taban)");
await ev(`__nx.g.gain.value = 0.2; 1`);
await sleep(600);
const B = await measure("B) yalnız NETREX sesi (440 Hz)");
await ev(`__nx.g.gain.value = 0; 1`);
await sleep(400);
const ps = spawn("powershell", ["-NoProfile", "-Command", `$p = New-Object Media.SoundPlayer '${wavPath}'; $p.PlaySync()`], { stdio: "ignore" });
await sleep(700);
const C = await measure("C) yalnız DIŞ uygulama sesi (880 Hz)", 2000);
await new Promise((r) => ps.on("exit", r));
await sleep(300);
await ev(`__nx.g.gain.value = 0.2; 1`);
const ps2 = spawn("powershell", ["-NoProfile", "-Command", `$p = New-Object Media.SoundPlayer '${wavPath}'; $p.PlaySync()`], { stdio: "ignore" });
await sleep(900);
const D = await measure("D) ikisi birden", 1800);
await new Promise((r) => ps2.on("exit", r));
await ev(`__nx.g.gain.value = 0; __cap.getTracks().forEach(t => t.stop()); 1`);

// 3) Karar (mutlak seviye): gerçek bir ses yaklaşık -40 dB ve üstünde görünür. Dış tonun yanındaki FFT sızıntısı
//    (diğer frekansta -150 dB civarı) gerçek ses DEĞİLDİR; bu yüzden eşik, taban değil sabit -90 dB'dir.
const REAL = -90;
const nxLevel = Math.max(B.n440, D.n440);
const extLevel = Math.min(C.n880, D.n880);
console.log("\nSonuç (dB, 0 = tam ölçek):");
console.log(`  Netrex sesi yakalamada:   en yüksek ${nxLevel.toFixed(0)} dB   -> ${nxLevel < REAL ? "HARİÇ TUTULUYOR (doğru)" : "YAKALANIYOR (sorun!)"}`);
console.log(`  Dış uygulama sesi:        en düşük  ${extLevel.toFixed(0)} dB   -> ${extLevel > -60 ? "yakalanıyor (doğru)" : "YAKALANMIYOR (sorun!)"}`);
process.exit(0);
