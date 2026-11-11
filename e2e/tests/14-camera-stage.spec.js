const { test, expect } = require("@playwright/test");
const { loginAs, collectErrors, blockProduction, mockLivekitApi, createServerViaUI, seedInvite, joinViaInvite } = require("../helpers");

// Kamera yayını izlenirken sahne düzeni: yayın alanı, kamera görüntüsü ve sohbet birbirinin içine taşmamalı.
test("kamera yayınını izleme ve tam ekrandan dönüş: düzen bozulmuyor", async ({ browser, request }) => {
  test.setTimeout(240_000);
  const errors = [];
  const ctxA = await browser.newContext({ permissions: ["microphone", "camera"], viewport: { width: 1500, height: 900 } });
  const ctxB = await browser.newContext({ permissions: ["microphone", "camera"], viewport: { width: 1500, height: 900 } });
  for (const c of [ctxA, ctxB]) { await blockProduction(c, []); await mockLivekitApi(c); }
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  collectErrors(A, errors, "[A] "); collectErrors(B, errors, "[B] ");

  await loginAs(A, "Ali");
  const serverId = await createServerViaUI(A, request, "Sahne Testi");
  await seedInvite(request, serverId, "SAHNE001");
  await loginAs(B, "Veli");
  await joinViaInvite(B, "SAHNE001");
  for (const p of [A, B]) {
    await p.getByRole("button", { name: "Sahne Testi" }).click();
    await p.getByRole("button", { name: /^genel-sohbet, sesli oda/ }).click();
    await p.getByRole("button", { name: "Bağlantıyı Kes", exact: true }).waitFor({ timeout: 30_000 });
  }
  await A.waitForTimeout(3000);

  // Ali kamerayı açar
  await A.getByRole("button", { name: /Kamerayı Aç/ }).first().click();
  await B.waitForTimeout(6000);
  await B.screenshot({ path: "e2e/.output/sahne-1-kamera-acik.png" });

  // Veli kamerayı büyütür (karttaki "Büyüt")
  const card = B.locator("[class*='group/camera']").first();
  await card.hover();
  await B.getByText("Büyüt", { exact: true }).first().click().catch(() => {});
  await B.waitForTimeout(3000);
  await B.screenshot({ path: "e2e/.output/sahne-2-buyutuldu.png" });

  // Ölçüm: sahne ve video kutuları pencere içinde mi, birbirini taşıyor mu
  const geo = async (p) => p.evaluate(() => {
    const vw = innerWidth, vh = innerHeight;
    const out = { vw, vh, videos: [] };
    document.querySelectorAll("video").forEach((v) => {
      const r = v.getBoundingClientRect();
      if (r.width > 0) out.videos.push({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), cls: String(v.className).slice(0, 40) });
    });
    const st = document.querySelector("[data-stage-container]");
    if (st) { const r = st.getBoundingClientRect(); out.stage = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; }
    return out;
  });
  const before = await geo(B);
  console.log("büyütülmüş:", JSON.stringify(before));
  expect(before.stage, "sahne bulunmalı").toBeTruthy();

  // Tam ekran: sahne pencereyi TAM kaplamalı (yan yana duran kutu olmamalı)
  const fsBtn = B.getByTitle(/Tam ekran yap/);
  await expect(fsBtn.first()).toBeVisible();
  await fsBtn.first().click();
  await B.waitForTimeout(1500);
  const inFs = await geo(B);
  await B.screenshot({ path: "e2e/.output/sahne-3-tam-ekran.png" });
  console.log("tam ekranda:", JSON.stringify(inFs));
  const near = (a, b) => Math.abs(a - b) <= 2;
  expect(near(inFs.stage.x, 0) && near(inFs.stage.y, 0) && near(inFs.stage.w, inFs.vw) && near(inFs.stage.h, inFs.vh),
    "tam ekranda sahne pencereyi tam kaplamalı").toBe(true);

  // Tam ekrandan çık (Esc test tarayıcısında çalışmıyor; aynı etkiyi API ile ver)
  await B.evaluate(() => document.exitFullscreen());
  await B.waitForTimeout(2000);
  const after = await geo(B);
  await B.screenshot({ path: "e2e/.output/sahne-4-geri.png" });
  console.log("geri dönünce:", JSON.stringify(after));
  expect(near(after.stage.x, before.stage.x) && near(after.stage.y, before.stage.y) && near(after.stage.w, before.stage.w) && near(after.stage.h, before.stage.h),
    "tam ekrandan dönünce sahne eski yerine dönmeli").toBe(true);

  // İmleç: hareketsizlikten sonra gizlenir, fare oynayınca GERİ GELMELİ (tam ekrandan dönüşten sonra da)
  const cursorOf = () => B.evaluate(() => {
    const st = document.querySelector("[data-stage-container]");
    const inner = st && st.querySelector("div.flex-1.relative");
    return inner ? getComputedStyle(inner).cursor : "yok";
  });
  const box = await B.locator("[data-stage-container]").boundingBox();
  await B.mouse.move(box.x + 200, box.y + 200);
  await B.mouse.move(box.x + 220, box.y + 210);
  await B.waitForTimeout(1500);
  console.log("hareketsiz imleç:", await cursorOf());
  await B.mouse.move(box.x + 300, box.y + 260);
  await B.waitForTimeout(400);
  const back = await cursorOf();
  console.log("fare oynayınca imleç:", back);
  expect(back, "fare oynayınca imleç geri gelmeli").not.toBe("none");
  console.log("HATALAR:", JSON.stringify([...new Set(errors)].slice(0, 6)));
});
