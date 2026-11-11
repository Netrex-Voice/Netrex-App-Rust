// src/lib/livekitRegion.js'i gerçek LiveKit Cloud'a karşı, gerçek tarayıcıda dener (kayıt dışı kısa ölçüm).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { AccessToken } = createRequire(path.join(root, "server", "package.json"))("livekit-server-sdk");
const { chromium } = createRequire(path.join(root, "package.json"))("@playwright/test");
const env = {};
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const base = env.LIVEKIT_SERVERS_1_URL;
const at = new AccessToken(env.LIVEKIT_SERVERS_1_KEY, env.LIVEKIT_SERVERS_1_SECRET, { identity: "lib-test", ttl: "5m" });
at.addGrant({ roomJoin: true, room: "lib-test" });
const token = await at.toJwt();

const lib = fs.readFileSync(path.join(root, "src", "lib", "livekitRegion.js"), "utf8").replace(/^export /gm, "");
const browser = await chromium.launch({ channel: "msedge", headless: true });
// CORS: tarayıcıdan `/settings/regions` çağrısı gerçek uygulamadaki gibi başlık ister; bu yüzden gerçek bir kaynaktan çalıştır
const page = await browser.newPage();
await page.goto("https://" + new URL(base.replace("wss://", "https://")).host + "/", { waitUntil: "domcontentloaded" }).catch(() => {});
await page.addScriptTag({ content: lib + "\nwindow.__lib = { getPreferredUrl, measureAndCacheBestRegion, invalidatePreferredUrl };" });
const out = await page.evaluate(async ({ base, token }) => {
  const before = window.__lib.getPreferredUrl(base);
  const t0 = performance.now();
  const best = await window.__lib.measureAndCacheBestRegion(base, token);
  const dt = Math.round(performance.now() - t0);
  const after = window.__lib.getPreferredUrl(base);
  const again = await window.__lib.measureAndCacheBestRegion(base, token); // taze: yeniden ölçmemeli
  window.__lib.invalidatePreferredUrl(base);
  const afterInvalidate = window.__lib.getPreferredUrl(base);
  return { before, ölçümSüresiMs: dt, best: best && { region: best.region, rtt: best.rtt, url: best.url, en_hızlı_4: best.all }, after, tazeyseYenidenÖlçmedi: !!again && again.at === best.at, afterInvalidate };
}, { base, token });
console.log(JSON.stringify(out, null, 1));
console.log("\nKontrol: ölçüm sonrası URL bölgeye döndü mü:", out.after !== out.before, "| geçersiz kılınca varsayılana döndü mü:", out.afterInvalidate === out.before);
await browser.close();
process.exit(0);
