// LiveKit Cloud bölgelerini listeler ve bu bilgisayardan her birine gecikmeyi ölçer. SALT OKUMA; gizli anahtarlar yazdırılmaz.
//   node e2e/region-probe.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";
import tls from "node:tls";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
import { createRequire } from "node:module";
const { AccessToken } = createRequire(path.join(root, "server", "package.json"))("livekit-server-sdk");

const servers = [];
for (let i = 0; i < 20 && env[`LIVEKIT_SERVERS_${i}_URL`]; i++) servers.push({ i, url: env[`LIVEKIT_SERVERS_${i}_URL`], key: env[`LIVEKIT_SERVERS_${i}_KEY`], secret: env[`LIVEKIT_SERVERS_${i}_SECRET`] });
console.log(`Havuzda ${servers.length} sunucu.`);

const get = (url, token) => new Promise((resolve, reject) => {
  const t0 = performance.now();
  https.get(url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, timeout: 8000 }, (res) => {
    let b = ""; res.on("data", (d) => (b += d)); res.on("end", () => resolve({ status: res.statusCode, body: b, ms: Math.round(performance.now() - t0) }));
  }).on("error", reject).on("timeout", function () { this.destroy(new Error("zaman aşımı")); });
});

// TCP + TLS el sıkışması süresi (WebSocket için maliyetli kısım)
const handshake = (host) => new Promise((resolve) => {
  const t0 = performance.now();
  const s = tls.connect({ host, port: 443, servername: host, timeout: 6000 }, () => { const ms = Math.round(performance.now() - t0); s.end(); resolve(ms); });
  s.on("error", () => resolve(null)); s.on("timeout", () => { s.destroy(); resolve(null); });
});

for (const sv of servers.slice(0, 2)) {
  const host = new URL(sv.url.replace("wss://", "https://")).host;
  const at = new AccessToken(sv.key, sv.secret, { identity: "bolge-testi", ttl: "5m" });
  at.addGrant({ roomJoin: true, room: "bolge-testi" });
  const token = await at.toJwt();
  console.log(`\n=== sunucu #${sv.i}: ${host}`);
  const base = []; for (let k = 0; k < 3; k++) base.push(await handshake(host));
  console.log(`  TCP+TLS el sıkışması (genel uç): ${base.join(" / ")} ms`);
  try {
    const r = await get(`https://${host}/settings/regions`, token);
    console.log(`  /settings/regions: ${r.status} (${r.ms} ms)`);
    const j = JSON.parse(r.body);
    const regs = j.regions || [];
    for (const reg of regs) {
      const h = new URL(reg.url).host;
      const times = []; for (let k = 0; k < 3; k++) times.push(await handshake(h));
      const ok = times.filter((x) => x != null);
      console.log(`  bölge ${String(reg.region).padEnd(14)} mesafe=${String(reg.distance).padEnd(9)} el sıkışma: ${times.join(" / ")} ms  ${ok.length ? "(ort " + Math.round(ok.reduce((a, b) => a + b, 0) / ok.length) + ")" : ""}`);
    }
  } catch (e) { console.log("  bölge listesi alınamadı:", e.message); }
}
process.exit(0);
