// Odaya girişin zaman çizelgesi: çalışan uygulamaya (debug portu 9222) PASİF bağlanır, hiçbir şeye tıklamaz.
// Sen bir sesli odaya girerken ağ isteklerini, LiveKit WebSocket'ini, uygulama günlüklerini ve ekrandaki
// "Bağlantı Kuruluyor" ekranının açılıp kapanma anlarını kaydeder; oda açılınca özet çıkarır.
//   node e2e/join-recorder.mjs            (en çok 3 dk bekler)
const tabs = await (await fetch("http://127.0.0.1:9222/json")).json();
const page = tabs.find((t) => t.type === "page" && t.url.startsWith("http://tauri.localhost/") && !t.url.includes("/overlays/"));
if (!page) { console.log("ana sayfa bulunamadı"); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pend = new Map();
const events = [];
const now = () => Date.now();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) return pend.get(m.id)(m);
  const t = now();
  const p = m.params || {};
  if (m.method === "Network.requestWillBeSent") {
    const u = p.request.url;
    if (/livekit|\/api\/|firestore\.googleapis|firebaseio|identitytoolkit|securetoken/i.test(u))
      events.push({ t, k: "istek", d: `${p.request.method} ${u.replace(/\?.*/, "").slice(0, 95)}`, rid: p.requestId });
  } else if (m.method === "Network.responseReceived") {
    const tm = p.response.timing;
    const u = p.response.url;
    if (/livekit|\/api\/|identitytoolkit|securetoken/i.test(u)) {
      const det = tm ? ` [dns ${Math.max(0, tm.dnsEnd - tm.dnsStart).toFixed(0)} | bağlan ${Math.max(0, tm.connectEnd - tm.connectStart).toFixed(0)} | ssl ${Math.max(0, tm.sslEnd - tm.sslStart).toFixed(0)} | bekleme ${(tm.receiveHeadersStart - tm.sendEnd).toFixed(0)} ms]` : "";
      events.push({ t, k: "yanıt", d: `${p.response.status} ${u.replace(/\?.*/, "").slice(0, 80)}${det}` });
    }
  } else if (m.method === "Network.webSocketCreated") {
    events.push({ t, k: "ws-aç", d: p.url.replace(/\?.*/, "").slice(0, 100) });
  } else if (m.method === "Network.webSocketHandshakeResponseReceived") {
    events.push({ t, k: "ws-el", d: `el sıkışma tamam (${p.response.status})` });
  } else if (m.method === "Network.webSocketFrameReceived") {
    const d = (p.response.payloadData || "").slice(0, 60);
    if (events.filter((x) => x.k === "ws-kare").length < 6) events.push({ t, k: "ws-kare", d: `LiveKit mesajı (${d.length} bayt önizleme)` });
  } else if (m.method === "Runtime.consoleAPICalled") {
    const txt = (p.args || []).map((a) => a.value ?? a.description ?? "").join(" ");
    if (/LiveKit|livekit|Firebase|bağlantı|Bağlan|Room|oda|presence|mikrofon|Mic|token|server|sunucu/i.test(txt)) events.push({ t, k: "günlük", d: txt.slice(0, 120) });
  } else if (m.method === "Runtime.bindingCalled") {
    events.push({ t, k: "EKRAN", d: p.payload });
  }
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Network.enable");
await send("Runtime.enable");
await send("Runtime.addBinding", { name: "__mark" });
// Sayfada: "Bağlantı Kuruluyor" ekranı ve oda düğmesi durum değişimlerini işaretle (yalnızca okur)
await send("Runtime.evaluate", { expression: `(() => {
  if (window.__recOn) return; window.__recOn = true;
  let ov = false, ctl = false, txt = '';
  setInterval(() => {
    const body = document.body.innerText || '';
    const o = body.includes('Bağlantı Kuruluyor');
    const t = body.includes('Mikrofon hazırlanıyor') ? 'mikrofon hazırlanıyor' : body.includes('Lütfen bekleyin') ? 'lütfen bekleyin' : '';
    const c = [...document.querySelectorAll('button')].some((b) => (b.getAttribute('aria-label') || '') === 'Bağlantıyı Kes' && b.getBoundingClientRect().width > 3);
    if (o !== ov) { ov = o; window.__mark('bekleme ekranı ' + (o ? 'AÇILDI' : 'KAPANDI')); }
    if (o && t !== txt) { txt = t; window.__mark('yazı: ' + t); }
    if (c !== ctl) { ctl = c; window.__mark('alt kontrol çubuğu ' + (c ? 'GÖRÜNDÜ' : 'gitti')); }
  }, 20);
})()` });
console.log("Kayıt açık. Şimdi bir sesli odaya gir (ben hiçbir şeye tıklamıyorum)...");

const t0wait = now();
while (now() - t0wait < 180000) {
  await new Promise((r) => setTimeout(r, 400));
  const ready = events.find((e) => e.k === "EKRAN" && e.d.includes("GÖRÜNDÜ"));
  if (ready && now() - ready.t > 4000) break;
}
const start = events.find((e) => e.k === "EKRAN" && e.d.includes("AÇILDI")) || events.find((e) => /livekit-token|livekit-server-info/.test(e.d)) || events[0];
if (!start) { console.log("Hiç oda girişi görmedim."); process.exit(0); }
const T = start.t;
console.log("\nZAMAN ÇİZELGESİ (ms, ilk işaretten itibaren)");
events.filter((e) => e.t >= T - 300).sort((a, b) => a.t - b.t).forEach((e) => console.log(`${String(e.t - T).padStart(6)}  ${e.k.padEnd(8)} ${e.d}`));
const hide = events.find((e) => e.k === "EKRAN" && e.d.includes("KAPANDI"));
const ctl = events.find((e) => e.k === "EKRAN" && e.d.includes("GÖRÜNDÜ"));
console.log(`\nÖZET: bekleme ekranı ${hide ? hide.t - T : "?"} ms sürdü; alt kontrol çubuğu ${ctl ? ctl.t - T : "?"} ms'de göründü.`);
process.exit(0);
