// Test ortamı: Firebase emülatörleri (Auth + Firestore + Realtime DB) + yerel LiveKit sunucusu + uygulama (next dev).
// Playwright `webServer` olarak çalıştırır; her şey hazır olunca 3999 numaralı bağlantı noktasında "hazır" sinyali verir.
// GERÇEK Firebase/LiveKit/Cloudinary'ye ASLA bağlanmaz: Firebase ayarları sahte (demo-netrex), LiveKit yerel `--dev`.

import { spawn, execSync } from "node:child_process";
import { createServer } from "node:http";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "e2e", ".output");
fs.mkdirSync(out, { recursive: true });

const jdk = fs.readdirSync(path.join(root, "tools", "jdk17")).find((d) => d.startsWith("jdk-"));
const JAVA_HOME = path.join(root, "tools", "jdk17", jdk);
const livekit = path.join(root, "tools", "livekit", "livekit-server.exe");
const APP_PORT = 3200;

const children = [];
function start(name, cmd, args, env = {}) {
  const log = fs.openSync(path.join(out, `${name}.log`), "w");
  const p = spawn(cmd, args, {
    cwd: root,
    shell: true,
    stdio: ["ignore", log, log],
    env: { ...process.env, ...env },
    windowsHide: true,
  });
  p.on("exit", (code) => console.log(`[${name}] çıktı (kod ${code})`));
  children.push({ name, p });
  return p;
}

function waitPort(port, name, timeoutMs = 240000) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const s = net.connect(port, "127.0.0.1");
      s.once("connect", () => { s.destroy(); resolve(); });
      s.once("error", () => {
        s.destroy();
        if (Date.now() - t0 > timeoutMs) reject(new Error(`${name} (${port}) ${timeoutMs / 1000} sn içinde açılmadı; bkz e2e/.output/`));
        else setTimeout(tryOnce, 700);
      });
    };
    tryOnce();
  });
}

function killAll() {
  for (const { p } of children) {
    try { execSync(`taskkill /PID ${p.pid} /T /F`, { stdio: "ignore" }); } catch (_) { /* zaten bitmiş */ }
  }
}
process.on("SIGINT", () => { killAll(); process.exit(0); });
process.on("SIGTERM", () => { killAll(); process.exit(0); });
process.on("exit", killAll);

// 1) Firebase emülatörleri (depodaki GERÇEK güvenlik kurallarıyla: firestore.rules + database.rules.json)
start(
  "emulators",
  "npx",
  ["firebase", "emulators:start", "--only", "auth,firestore,database", "--project", "demo-netrex"],
  { JAVA_HOME, PATH: `${path.join(JAVA_HOME, "bin")};${process.env.PATH}` },
);
// 2) Yerel LiveKit (geliştirme modu: anahtar devkey / secret)
start("livekit", `"${livekit}"`, ["--dev", "--bind", "127.0.0.1"]);
// 3) Uygulama: ayarların HEPSİ sahte; emülatör modu açık
start("app", "npx", ["next", "dev", "-p", String(APP_PORT)], {
  NEXT_PUBLIC_USE_EMULATORS: "1",
  NEXT_PUBLIC_FIREBASE_API_KEY: "fake-api-key",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "localhost",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-netrex",
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "demo-netrex.appspot.com",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
  NEXT_PUBLIC_FIREBASE_APP_ID: "1:000000000000:web:0000000000000000",
  NEXT_PUBLIC_FIREBASE_DATABASE_URL: "http://127.0.0.1:9000/?ns=demo-netrex",
  NEXT_PUBLIC_NETREX_API_URL: "",
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: "demo",
  NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET: "demo",
  NEXT_PUBLIC_ADMIN_UID: "",
  NEXT_PUBLIC_LIVEKIT_URL: "ws://127.0.0.1:7880",
});

try {
  await Promise.all([
    waitPort(9099, "Auth emülatörü"),
    waitPort(8080, "Firestore emülatörü"),
    waitPort(9000, "Realtime DB emülatörü"),
    waitPort(7880, "LiveKit"),
    waitPort(APP_PORT, "Uygulama (next dev)"),
  ]);
} catch (e) {
  console.error(String(e));
  killAll();
  process.exit(1);
}

// Uygulamanın ilk derlemesini ısıt (ilk istek yavaş olur; testler zaman aşımına uğramasın)
try {
  await fetch(`http://127.0.0.1:${APP_PORT}/`);
} catch (_) { /* test sırasında yeniden denenir */ }

createServer((_, res) => { res.end("hazir"); }).listen(3999, "127.0.0.1", () => console.log("TEST ORTAMI HAZIR"));
