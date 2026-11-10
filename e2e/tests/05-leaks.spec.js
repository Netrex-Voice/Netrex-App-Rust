const { test, expect } = require("@playwright/test");
const { loginAs, collectErrors, blockProduction, mockLivekitApi, createServerViaUI } = require("../helpers");

// Odaya gir-çık döngüsünde sızıntı ölçümü: JS belleği, DOM düğümü ve olay dinleyici sayısı (her ölçümden önce çöp toplama).
test("sesli odaya gir-çık döngüsünde sızıntı yok", async ({ page, context, request }) => {
  test.setTimeout(420_000);
  const errors = [];
  collectErrors(page, errors);
  await blockProduction(context, []);
  await mockLivekitApi(context);
  await loginAs(page, "Sizinti");
  await createServerViaUI(page, request, "Sizinti Testi");
  await page.getByRole("button", { name: "Sizinti Testi" }).click();
  const voice = page.getByRole("button", { name: /^genel-sohbet, sesli oda/ });
  await voice.waitFor({ timeout: 30_000 });

  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  const measure = async () => {
    await cdp.send("HeapProfiler.collectGarbage");
    await page.waitForTimeout(400);
    const m = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]));
    // Bellekte HÂLÂ canlı nesne sayıları (çöp toplamadan sonra): kapanmış odalardan kalan bağlantı/iz/ses bağlamı
    const count = async (expr) => {
      const proto = await cdp.send("Runtime.evaluate", { expression: expr });
      const objs = await cdp.send("Runtime.queryObjects", { prototypeObjectId: proto.result.objectId });
      const r = await cdp.send("Runtime.callFunctionOn", { objectId: objs.objects.objectId, functionDeclaration: "function(){return this.length}", returnByValue: true });
      return r.result.value;
    };
    const pcs = await count("RTCPeerConnection.prototype");
    const tracks = await count("MediaStreamTrack.prototype");
    const actx = await count("AudioContext.prototype");
    return { heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1), nodes: m.Nodes, listeners: m.JSEventListeners, docs: m.Documents, pcs, tracks, actx };
  };

  const rows = [];
  const N = 8;
  for (let i = 0; i <= N; i++) {
    if (i > 0) {
      await voice.focus();
      await page.keyboard.press("Enter"); // odaya gir
      await page.getByRole("button", { name: "Bağlantıyı Kes" }).waitFor({ timeout: 30_000 });
      await page.waitForTimeout(3000); // bağlantı otursun
      await page.getByRole("button", { name: "Bağlantıyı Kes" }).click();
      await page.getByRole("button", { name: /^genel-sohbet, sesli oda/ }).waitFor({ timeout: 20_000 });
      await page.waitForTimeout(1500);
    }
    rows.push({ tur: i, ...(await measure()) });
  }
  console.log("TUR | heapMB | düğüm | dinleyici | belge | bağlantı(PC) | iz | AudioContext");
  rows.forEach((r) => console.log(`${String(r.tur).padStart(3)} | ${r.heapMB} | ${r.nodes} | ${r.listeners} | ${r.docs} | ${r.pcs} | ${r.tracks} | ${r.actx}`));
  const a = rows[2], b = rows[N];
  console.log(`6 tur farkı: heap ${(b.heapMB - a.heapMB).toFixed(1)} MB, düğüm ${b.nodes - a.nodes}, dinleyici ${b.listeners - a.listeners}, belge ${b.docs - a.docs}`);
  console.log("HATALAR:", JSON.stringify([...new Set(errors)].slice(0, 8)));
  // Eşikler: tur başına belirgin artış sızıntı işaretidir
  expect.soft(b.nodes - a.nodes, "DOM düğümü artışı (6 tur)").toBeLessThan(600);
  expect.soft(b.listeners - a.listeners, "dinleyici artışı (6 tur)").toBeLessThan(300);
  expect.soft(b.heapMB - a.heapMB, "JS heap artışı (6 tur, MB)").toBeLessThan(15);
  expect.soft(b.docs - a.docs, "belge sayısı artışı").toBeLessThanOrEqual(2);
});
