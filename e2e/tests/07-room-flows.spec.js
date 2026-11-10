const { test } = require("@playwright/test");
const { loginAs, collectErrors, blockProduction, mockLivekitApi, createServerViaUI } = require("../helpers");

// Odadayken diğer alanlara geçiş akışları: her adımda ne görünüyor, oda hâlâ bağlı mı, hata var mı?
test("odadayken gezinme akışları", async ({ page, context, request }) => {
  test.setTimeout(300_000);
  const errors = [];
  collectErrors(page, errors);
  await blockProduction(context, []);
  await mockLivekitApi(context);
  await loginAs(page, "Gezgin");
  await createServerViaUI(page, request, "Akis Testi");
  await page.getByRole("button", { name: "Akis Testi" }).click();
  await page.getByRole("button", { name: /^genel-sohbet, sesli oda/ }).click();
  await page.getByRole("button", { name: "Bağlantıyı Kes" }).waitFor({ timeout: 30_000 });
  await page.waitForTimeout(3000);

  const state = async (tag) => {
    await page.waitForTimeout(900);
    const s = await page.evaluate(() => {
      const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 3 && r.height > 3 && !e.closest("[inert]"); };
      const btn = (n) => [...document.querySelectorAll("button")].some((b) => vis(b) && (b.getAttribute("aria-label") || b.innerText || "").trim() === n);
      return {
        bagli: btn("Bağlantıyı Kes"),
        dialog: document.querySelectorAll('[role="dialog"]').length,
        baslik: [...document.querySelectorAll("h1,h2,h3")].filter(vis).map((h) => h.innerText.trim()).slice(0, 3),
        metin: document.body.innerText.split(/[ \t\r\n]+/).join(" ").slice(0, 110),
      };
    });
    console.log(`${tag.padEnd(34)} oda bağlı=${s.bagli ? "EVET" : "hayır"} | pencere=${s.dialog} | başlık=${JSON.stringify(s.baslik)} | ${s.metin}`);
    await page.screenshot({ path: `e2e/.output/akis-${tag.replace(/[^a-z0-9]/gi, "_")}.png` });
  };
  const click = async (name, opts = {}) => {
    try { await page.getByRole("button", { name, ...opts }).first().click({ timeout: 8000 }); return true; }
    catch (e) { console.log(`  !! "${name}" tıklanamadı: ${String(e.message).split("\n")[0].slice(0, 110)}`); return false; }
  };

  await state("0 odada (başlangıç)");
  if (await click("Mesajlar")) await state("1 Mesajlar'a geçildi");
  if (await click("Akis Testi")) await state("2 sunucuya dönüldü");
  if (await click("Ana Sayfa")) await state("3 Ana Sayfa");
  if (await click("Akis Testi")) await state("4 sunucu (tekrar)");
  if (await click("Tek Kişilik Oyunlar")) { await state("5 Tek kişilik oyunlar"); await page.keyboard.press("Escape"); }
  if (await click("Klavye Kısayolları")) { await state("6 Klavye kısayolları"); await page.keyboard.press("Escape"); }
  if (await click("Netrex Games")) { await state("7 Netrex Games"); await page.keyboard.press("Escape"); }
  if (await click("Kişiler")) await state("8 Kişiler paneli");
  if (await click("Spatial Audio: Kapalı")) await state("9 Spatial Audio açıldı");
  if (await click("Kamerayı Aç")) await state("10 Kamera açıldı");
  if (await click("Ekran Paylaş")) { await state("11 Ekran Paylaş"); await page.keyboard.press("Escape"); }
  await state("12 sonda");
  console.log("HATALAR:", JSON.stringify([...new Set(errors)].slice(0, 10), null, 1));
});
