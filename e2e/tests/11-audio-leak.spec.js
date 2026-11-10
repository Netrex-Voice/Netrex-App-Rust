const { test } = require("@playwright/test");
const { loginAs, blockProduction, mockLivekitApi, createServerViaUI } = require("../helpers");

// Odadan çıkınca kapanmayan AudioContext'ler ve durdurulmayan MediaStreamTrack'ler: kim yarattı? (yığın izleriyle)
test("odaya gir-çık: kapanmayan ses bağlamları ve izler", async ({ page, context, request }) => {
  test.setTimeout(420_000);
  await page.addInitScript(() => {
    const short = (st) => (st || "").split("\n").slice(2, 9).map((l) => l.trim().replace(/\(?https?:\/\/[^/]+\/_next\/static\//, "(").replace(/webpack-internal:\/\/\/\(app-pages-browser\)\/\.\//, "").slice(0, 105)).join(" <- ");
    // AudioContext
    window.__ctxs = [];
    for (const name of ["AudioContext", "webkitAudioContext"]) {
      const Orig = window[name];
      if (!Orig) continue;
      window[name] = new Proxy(Orig, {
        construct(target, args, nt) {
          const c = Reflect.construct(target, args, nt);
          window.__ctxs.push({ c, stack: short(new Error().stack) });
          return c;
        },
      });
    }
    // getUserMedia / getDisplayMedia ile gelen izler
    window.__trk = [];
    const md = navigator.mediaDevices;
    for (const fn of ["getUserMedia", "getDisplayMedia"]) {
      const orig = md[fn] && md[fn].bind(md);
      if (!orig) continue;
      md[fn] = async (...a) => {
        const s = await orig(...a);
        const st = short(new Error().stack);
        s.getTracks().forEach((t) => window.__trk.push({ t, st, kind: t.kind }));
        return s;
      };
    }
    window.__report = () => {
      const open = window.__ctxs.filter((x) => x.c.state !== "closed");
      const g = {};
      open.forEach((x) => { g[x.stack] = (g[x.stack] || 0) + 1; });
      const live = window.__trk.filter((x) => x.t.readyState === "live");
      const gt = {};
      live.forEach((x) => { const k = x.kind + " | " + x.st; gt[k] = (gt[k] || 0) + 1; });
      return { ctxTotal: window.__ctxs.length, ctxOpen: open.length, ctxGroups: g, trkTotal: window.__trk.length, trkLive: live.length, trkGroups: gt };
    };
  });
  await blockProduction(context, []);
  await mockLivekitApi(context);
  await loginAs(page, "SesSizinti");
  await createServerViaUI(page, request, "Ses Sizinti");
  await page.getByRole("button", { name: "Ses Sizinti" }).click();
  const voice = page.getByRole("button", { name: /^genel-sohbet, sesli oda/ });
  await voice.waitFor({ timeout: 30_000 });

  const cycle = async () => {
    await voice.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Bağlantıyı Kes", exact: true }).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(2500);
    await page.getByRole("button", { name: "Bağlantıyı Kes", exact: true }).click();
    await page.getByRole("button", { name: /^genel-sohbet, sesli oda/ }).waitFor({ timeout: 20_000 });
    await page.waitForTimeout(1500);
  };
  const r0 = await page.evaluate(() => window.__report());
  for (let i = 0; i < 4; i++) await cycle();
  const r1 = await page.evaluate(() => window.__report());
  console.log(`AudioContext: oluşturulan ${r0.ctxTotal} -> ${r1.ctxTotal}, AÇIK ${r0.ctxOpen} -> ${r1.ctxOpen}`);
  console.log("AÇIK KALAN AudioContext (kim yarattı):");
  Object.entries(r1.ctxGroups).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  x${n}  ${k}`));
  console.log(`getUserMedia izleri: oluşturulan ${r0.trkTotal} -> ${r1.trkTotal}, CANLI ${r0.trkLive} -> ${r1.trkLive}`);
  console.log("CANLI KALAN iz (kim yarattı):");
  Object.entries(r1.trkGroups).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  x${n}  ${k}`));
});
