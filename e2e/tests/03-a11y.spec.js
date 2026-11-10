const { test, expect } = require("@playwright/test");
const { loginAs, collectErrors, blockProduction, mockLivekitApi, createServerViaUI } = require("../helpers");

// Erişilebilirlik: klavye, ekran okuyucu adları, gizli katman, modal rolü. `expect.soft` ile hepsi toplanır.
test("erişilebilirlik: kanal öğeleri, odadaki düğmeler, gizli katman, modal", async ({ page, context, request }) => {
  test.setTimeout(240_000);
  const errors = [], blocked = [];
  collectErrors(page, errors);
  await blockProduction(context, blocked);
  await mockLivekitApi(context);
  await loginAs(page, "Aylin");

  // 1) sol çubuk düğmeleri adlı
  for (const n of ["Ana Sayfa", "Mesajlar", "Tek Kişilik Oyunlar", "Sunucu Ekle"]) {
    await expect.soft(page.getByRole("button", { name: n }), `rail: ${n}`).toBeVisible();
  }

  // 2) modal pencereler role=dialog taşımalı (Sunucu Ekle > Oluştur / Katıl)
  await page.getByRole("button", { name: "Sunucu Ekle" }).click();
  expect.soft(await page.getByRole("dialog").count(), "Sunucu Ekle modalı role=dialog").toBeGreaterThan(0);
  await page.getByRole("button", { name: /Sunucumu Oluştur/ }).click();
  expect.soft(await page.getByRole("dialog").count(), "Sunucu Oluştur modalı role=dialog").toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  expect.soft(await page.getByRole("dialog").count(), "Esc ile Sunucu Oluştur kapanmalı").toBe(0);
  if (await page.getByRole("dialog").count()) await page.getByRole("button", { name: /İptal|Kapat/ }).first().click();

  await createServerViaUI(page, request, "Erisim Testi");
  await page.getByRole("button", { name: "Erisim Testi" }).click();

  // 3) kanal öğeleri: ad + klavye
  const text = page.getByRole("button", { name: /^genel, metin kanalı/ });
  const voice = page.getByRole("button", { name: /^genel-sohbet, sesli oda, boş/ });
  await expect.soft(text, "metin kanalı öğesi").toBeVisible({ timeout: 30_000 });
  await expect.soft(voice, "sesli oda öğesi").toBeVisible();
  await text.focus();
  await page.keyboard.press("Enter");
  await expect.soft(page.getByPlaceholder("Bir mesaj gönder...")).toBeVisible({ timeout: 20_000 });

  // 4) odaya klavyeyle gir
  await voice.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(8000);
  await page.screenshot({ path: "e2e/.output/a11y-oda.png" });

  const info = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll("button, [role=button]").forEach((e) => {
      const r = e.getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || e.closest("[inert]")) return;
      const name = (e.getAttribute("aria-label") || e.getAttribute("title") || e.innerText || "").trim();
      if (!name) out.push(e.outerHTML.slice(0, 230) + "  <<< ebeveyn: " + String(e.parentElement ? e.parentElement.className : "").slice(0, 70));
    });
    return out;
  });
  console.log("ADSIZ DÜĞMELER (" + info.length + "):\n" + info.join("\n"));
  expect.soft(info.length, "odada adsız düğme sayısı").toBe(0);

  // 5) gizli katmana Tab ile odaklanılamıyor
  expect.soft(await page.locator("[inert]").count(), "odadayken [inert] katman").toBeGreaterThan(0);
  let leaked = 0;
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    if (await page.evaluate(() => !!(document.activeElement && document.activeElement.closest("[inert]")))) leaked++;
  }
  expect.soft(leaked, "Tab ile gizli katmana sızma").toBe(0);

  console.log("HATALAR:", JSON.stringify([...new Set(errors)].slice(0, 10), null, 1));
  console.log("ENGELLENEN ÜRETİM İSTEKLERİ:", blocked.length ? blocked : "yok");
});
