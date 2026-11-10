// Canlı denetim aracı: çalışan Netrex'e (debug portu 9222) bağlanır.
//   node e2e/live.mjs shot <ad>            ekran görüntüsü -> e2e/.output/live-<ad>.png
//   node e2e/live.mjs list                 görünür etkileşimli öğeler (adsız / üstü kapalı / görünmez işaretli)
//   node e2e/live.mjs click <metin|css:..> GERÇEK fare tıklaması (öğenin ortasına)
//   node e2e/live.mjs key <tuş>            klavye (Tab, Escape, Enter...)
//   node e2e/live.mjs eval <js>            sayfada ifade çalıştırır
//   node e2e/live.mjs text                 görünen metin
//   node e2e/live.mjs mem                  Netrex süreçlerinin özel bellek dökümü (Görev Yöneticisi ölçüsü)
import fs from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const [, , cmd, ...rest] = process.argv;

if (cmd === "mem") {
  const ps = `$n=Get-Process netrex -EA SilentlyContinue; $w=Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" | ?{$_.CommandLine -match 'com.netrex.app'}; $ids=@($n.Id)+@($w.ProcessId); $r=Get-CimInstance Win32_PerfFormattedData_PerfProc_Process | ?{$ids -contains $_.IDProcess} | %{ $id=$_.IDProcess; $t= if($id -eq $n.Id){'netrex.exe'}else{ $c=($w|?{$_.ProcessId -eq $id}).CommandLine; if($c -match '--type=([a-z-]+)'){$Matches[1]}else{'browser'} }; [pscustomobject]@{T=$t;MB=[math]::Round($_.WorkingSetPrivate/1MB,1)} }; ($r | %{ $_.T+'='+$_.MB }) -join '  '; 'TOPLAM='+[math]::Round(($r|Measure-Object MB -Sum).Sum,0)+' MB'`;
  console.log(execSync(`powershell -NoProfile -Command "${ps.replace(/"/g, '\\"')}"`).toString().trim());
  process.exit(0);
}

const tabs = await (await fetch("http://127.0.0.1:9222/json")).json();
const page = tabs.find((t) => t.type === "page" && t.url.startsWith("http://tauri.localhost/") && !t.url.includes("/overlays/"));
if (!page) { console.log("ana sayfa bulunamadı"); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) pend.get(m.id)(m); };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  return r.result.exceptionDetails ? "HATA: " + (r.result.exceptionDetails.exception?.description || "").slice(0, 200) : r.result.result?.value;
};

if (cmd === "shot") {
  const r = await send("Page.captureScreenshot", { format: "png" });
  const f = path.join(dir, ".output", `live-${rest[0] || "ekran"}.png`);
  fs.writeFileSync(f, Buffer.from(r.result.data, "base64"));
  console.log(f);
} else if (cmd === "list") {
  console.log(await ev(fs.readFileSync(path.join(dir, "live-list.js"), "utf8")));
} else if (cmd === "click") {
  const sel = rest.join(" ");
  const xy = sel.startsWith("xy:") ? sel.slice(3).split(",").map(Number) : null;
  const pos = xy ? { x: xy[0], y: xy[1] } : await ev(fs.readFileSync(path.join(dir, "live-find.js"), "utf8").replace("__SEL__", JSON.stringify(sel)));
  if (!pos || pos.x === undefined) { console.log("öğe bulunamadı: " + sel); process.exit(2); }
  for (const t of ["mouseMoved", "mousePressed", "mouseReleased"]) {
    await send("Input.dispatchMouseEvent", { type: t, x: pos.x, y: pos.y, button: "left", clickCount: 1 });
  }
  console.log("tıklandı: " + sel + " @" + Math.round(pos.x) + "," + Math.round(pos.y));
} else if (cmd === "key") {
  const k = rest[0];
  const codes = { Tab: 9, Escape: 27, Enter: 13, ArrowDown: 40, ArrowUp: 38 };
  for (const t of ["keyDown", "keyUp"]) {
    await send("Input.dispatchKeyEvent", { type: t, key: k, code: k, windowsVirtualKeyCode: codes[k] || 0 });
  }
  console.log("tuş: " + k);
} else if (cmd === "eval") {
  console.log(await ev(rest.join(" ")));
} else if (cmd === "text") {
  console.log(await ev("document.body.innerText.split(/[ \\t\\r\\n]+/).join(' ').slice(0, 1500)"));
}
process.exit(0);
