// Gerçek LiveKit Cloud bağlantı süresi: varsayılan URL (İsrail'e yönlenir) ile bölge URL'leri (ör. Frankfurt) karşılaştırması.
// Edge'de (Playwright) livekit-client ile her seçenek için Room.connect() süresi ölçülür; kısa bağlantılar, hemen kopar.
//   node e2e/region-connect-bench.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const req = createRequire(path.join(root, "server", "package.json"));
const { AccessToken } = req("livekit-server-sdk");
const { chromium } = createRequire(path.join(root, "package.json"))("@playwright/test");

const env = {};
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const sv = { url: env.LIVEKIT_SERVERS_1_URL, key: env.LIVEKIT_SERVERS_1_KEY, secret: env.LIVEKIT_SERVERS_1_SECRET };
const base = sv.url;
const host = new URL(base.replace("wss://", "https://")).host;
const at = new AccessToken(sv.key, sv.secret, { identity: "bench-" + Date.now(), ttl: "10m" });
at.addGrant({ roomJoin: true, room: "bolge-bench", canPublish: false, canSubscribe: false });
const token = await at.toJwt();

const regions = await new Promise((resolve, reject) => {
  https.get(`https://${host}/settings/regions`, { headers: { Authorization: `Bearer ${token}` } }, (res) => {
    let b = ""; res.on("data", (d) => (b += d)); res.on("end", () => resolve(JSON.parse(b).regions || []));
  }).on("error", reject);
});
console.log("Bölgeler:", regions.map((r) => `${r.region} -> ${new URL(r.url).host}`).join(" | "));
const pick = (name) => regions.find((r) => r.region.includes(name));
const options = [
  { ad: "Varsayılan (LiveKit seçer)", url: base },
  { ad: "Frankfurt (sabit)", url: pick("frankfurt") && pick("frankfurt").url.replace("https://", "wss://") },
  { ad: "Marsilya (sabit)", url: pick("marseille") && pick("marseille").url.replace("https://", "wss://") },
  { ad: "İsrail (sabit)", url: pick("jerusalem") && pick("jerusalem").url.replace("https://", "wss://") },
].filter((o) => o.url);

const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const page = await browser.newPage();
await page.goto("about:blank");
await page.addScriptTag({ path: path.join(root, "node_modules", "livekit-client", "dist", "livekit-client.umd.js") });

const results = {};
for (let round = 0; round < 4; round++) {
  for (const o of options) {
    const r = await page.evaluate(async ({ url, token }) => {
      const room = new LivekitClient.Room();
      const t0 = performance.now();
      try {
        await room.connect(url, token, { autoSubscribe: false });
        const ms = Math.round(performance.now() - t0);
        const region = room.serverInfo && room.serverInfo.region;
        await room.disconnect();
        return { ms, region };
      } catch (e) { try { await room.disconnect(); } catch (_) {} return { err: String(e.message || e).slice(0, 80) }; }
    }, { url: o.url, token });
    (results[o.ad] = results[o.ad] || []).push(r);
    await page.waitForTimeout(800);
  }
}
await browser.close();

console.log("\nROOM.CONNECT() SÜRESİ (ms) — 4 tur; ilk tur soğuk (DNS/TLS önbelleği boş)");
for (const [ad, arr] of Object.entries(results)) {
  const ok = arr.filter((x) => x.ms != null);
  const warm = ok.slice(1).map((x) => x.ms);
  const med = (a) => (a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : null);
  console.log(`${ad.padEnd(28)} bölge=${[...new Set(ok.map((x) => x.region))].join(",") || "?"}  süreler: ${arr.map((x) => x.ms ?? "HATA(" + x.err + ")").join(" / ")}   ısınmış ortanca: ${med(warm)} ms`);
}
process.exit(0);
