const { test } = require("@playwright/test");
const { loginAs, blockProduction, mockLivekitApi, createServerViaUI } = require("../helpers");

// Gir-çık döngüsünde biriken (hiç removeEventListener ile kaldırılmayan) dinleyicileri yığın izleriyle bulur.
test("odaya gir-çık: biriken dinleyiciler", async ({ page, context, request }) => {
  test.setTimeout(420_000);
  await page.addInitScript(() => {
    window.__live = new Set();
    const add = EventTarget.prototype.addEventListener;
    const rem = EventTarget.prototype.removeEventListener;
    const same = (r, t, type, fn, cap) => r.t === t && r.type === type && r.fn === fn && r.cap === cap;
    const capOf = (o) => (typeof o === "boolean" ? o : !!(o && o.capture));
    EventTarget.prototype.addEventListener = function (type, fn, opts) {
      try {
        if (fn) {
          const cap = capOf(opts);
          let dup = false;
          for (const r of window.__live) if (same(r, this, type, fn, cap)) { dup = true; break; }
          if (!dup) {
            const stack = (new Error().stack || "").split("\n").slice(2, 7).map((l) => l.trim().replace(/\(?https?:\/\/[^/]+\/_next\/static\//, "(").slice(0, 110)).join(" <- ");
            window.__live.add({ t: this, type, fn, cap, stack, tn: this === window ? "window" : this === document ? "document" : (this.nodeName || this.constructor.name) });
          }
        }
      } catch (e) { /* izleyici asla uygulamayı bozmasın */ }
      return add.call(this, type, fn, opts);
    };
    EventTarget.prototype.removeEventListener = function (type, fn, opts) {
      try {
        const cap = capOf(opts);
        for (const r of window.__live) if (same(r, this, type, fn, cap)) { window.__live.delete(r); break; }
      } catch (e) { /* yoksay */ }
      return rem.call(this, type, fn, opts);
    };
    window.__snap = () => {
      const m = {};
      for (const r of window.__live) {
        if (r.t && r.t.isConnected === false) continue; // DOM'dan sökülmüş öğeye bağlı dinleyici: çöp toplanır, sızıntı değil
        const k = `${r.tn}:${r.type} | ${r.stack}`;
        m[k] = (m[k] || 0) + 1;
      }
      return m;
    };
  });
  await blockProduction(context, []);
  await mockLivekitApi(context);
  await loginAs(page, "Dinleyici");
  await createServerViaUI(page, request, "Dinleyici Testi");
  await page.getByRole("button", { name: "Dinleyici Testi" }).click();
  const voice = page.getByRole("button", { name: /^genel-sohbet, sesli oda/ });
  await voice.waitFor({ timeout: 30_000 });

  const cycle = async () => {
    await voice.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Bağlantıyı Kes", exact: true }).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(2500);
    await page.getByRole("button", { name: "Bağlantıyı Kes", exact: true }).click();
    await page.getByRole("button", { name: /^genel-sohbet, sesli oda/ }).waitFor({ timeout: 20_000 });
    await page.waitForTimeout(1200);
  };
  for (let i = 0; i < 2; i++) await cycle();
  const base = await page.evaluate(() => window.__snap());
  const total0 = Object.values(base).reduce((a, b) => a + b, 0);
  for (let i = 0; i < 6; i++) await cycle();
  const end = await page.evaluate(() => window.__snap());
  const total1 = Object.values(end).reduce((a, b) => a + b, 0);

  const grown = Object.entries(end).map(([k, n]) => [k, n - (base[k] || 0)]).filter(([, d]) => d > 0).sort((a, b) => b[1] - a[1]);
  console.log(`CANLI DİNLEYİCİ: tur 2 sonrası ${total0} -> tur 8 sonrası ${total1} (fark ${total1 - total0})`);
  console.log("BÜYÜYENLER (6 turda artış | hedef:olay | yığın):");
  grown.slice(0, 12).forEach(([k, d]) => console.log(`  +${d}  ${k}`));
  if (!grown.length) console.log("  (yok)");
});
