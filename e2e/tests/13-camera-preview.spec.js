const { test, expect } = require("@playwright/test");
const { loginAs, collectErrors, blockProduction } = require("../helpers");

// Ayarlar > Kamera: sekme açılınca kamera ASLA istenmemeli (kamera ışığı yanmaz); yalnızca "Kamerayı Önizle"ye basınca açılmalı.
test("ayarlarda kamera, önizleme istenmeden açılmaz", async ({ page, context }) => {
  test.setTimeout(120_000);
  const errors = [];
  collectErrors(page, errors);
  await blockProduction(context, []);
  // getUserMedia'nın video isteklerini ve açık video izlerini say (sayfa yüklenmeden önce)
  await page.addInitScript(() => {
    window.__videoGum = 0;
    window.__liveVideo = () => (window.__tracks || []).filter((t) => t.readyState === "live").length;
    window.__tracks = [];
    const md = navigator.mediaDevices;
    if (md && md.getUserMedia) {
      const orig = md.getUserMedia.bind(md);
      md.getUserMedia = async (c) => {
        const s = await orig(c);
        if (c && c.video) {
          window.__videoGum++;
          s.getVideoTracks().forEach((t) => window.__tracks.push(t));
        }
        return s;
      };
    }
  });
  await loginAs(page, "Kamera");

  await page.getByRole("button", { name: /Profil menüsü/ }).click();
  await page.getByText("Uygulama Ayarları").click();
  await page.getByRole("button", { name: "Kamera", exact: true }).click();
  await page.getByRole("button", { name: "Kamerayı Önizle" }).waitFor({ timeout: 15_000 });
  await page.waitForTimeout(3000);

  const before = await page.evaluate(() => ({ gum: window.__videoGum, live: window.__liveVideo() }));
  console.log("sekme açıkken (önizleme yok):", JSON.stringify(before));
  expect(before.gum, "önizleme istenmeden kamera açılmamalı").toBe(0);
  expect(before.live, "açık video izi olmamalı").toBe(0);

  await page.getByRole("button", { name: "Kamerayı Önizle" }).click();
  await page.getByText("ÖNİZLEME AKTİF").waitFor({ timeout: 15_000 });
  const during = await page.evaluate(() => ({ gum: window.__videoGum, live: window.__liveVideo() }));
  console.log("önizlemeye basınca:", JSON.stringify(during));
  expect(during.gum).toBeGreaterThanOrEqual(1);

  await page.getByRole("button", { name: "Durdur" }).click();
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => window.__liveVideo());
  console.log("durdurunca açık video izi:", after);
  expect(after, "Durdur sonrası kamera kapanmalı").toBe(0);
  console.log("HATALAR:", JSON.stringify([...new Set(errors)].slice(0, 6)));
});
