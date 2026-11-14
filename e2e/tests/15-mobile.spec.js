const { test, expect } = require("@playwright/test");
const { loginAs, blockProduction, mockLivekitApi, collectErrors } = require("../helpers");

// Telefon boyutunda temel akış: sunucu oluştur → kanalları gör → sesli odaya gir → odadayken kanallara/üyelere ulaş →
// yazılı kanala geç → mesajlar. Her adımda ekran görüntüsü alınır (e2e/.output/mobil-*.png) ve yatay taşma denetlenir.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

async function noHorizontalOverflow(page, label) {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over, `${label}: sayfa yatay taşmamalı`).toBeLessThanOrEqual(1);
}

test("mobil: sunucu, kanallar, sesli oda ve sohbet", async ({ page, context }) => {
  test.setTimeout(300_000);
  const errors = [];
  await blockProduction(context, []);
  await mockLivekitApi(context);
  collectErrors(page, errors);
  const shot = (name) => page.screenshot({ path: `e2e/.output/mobil-${name}.png` });

  await loginAs(page, "Mobil");
  await shot("1-ana-sayfa");
  await noHorizontalOverflow(page, "ana sayfa");

  // Sunucu oluştur (alt çubuk > Sunucular)
  await page.getByRole("button", { name: "Sunucular" }).click();
  await shot("2-sunucular");
  await page.getByRole("button", { name: /Sunucu (Ekle|Oluştur)/ }).first().click();
  await page.getByRole("button", { name: /Sunucumu Oluştur/ }).click();
  await page.getByPlaceholder("Sunucunun adı ne olsun?").fill("Mobil Testi");
  await page.getByRole("button", { name: "Oluştur", exact: true }).click();

  // Kanal listesi görünmeli
  const voice = page.getByRole("button", { name: /^genel-sohbet, sesli oda/ });
  await voice.waitFor({ timeout: 30_000 });
  await shot("3-kanallar");
  await noHorizontalOverflow(page, "kanal listesi");

  // Sesli odaya gir
  await voice.click();
  await page.getByRole("button", { name: "Bağlantıyı Kes", exact: true }).waitFor({ timeout: 30_000 });
  await page.waitForTimeout(2500);
  await shot("4-sesli-oda");
  await noHorizontalOverflow(page, "sesli oda");

  // Odadayken kanal listesine ulaşılabilmeli
  await page.getByRole("button", { name: "Kanallar" }).click();
  await expect(page.getByRole("button", { name: /^genel, yazılı kanal|^genel$/ }).first()).toBeVisible({ timeout: 10_000 });
  await shot("5-odada-kanallar");

  // Yazılı kanala geç ve mesaj yaz
  await page.getByRole("button", { name: /^genel, yazılı kanal|^genel$/ }).first().click();
  const input = page.getByPlaceholder(/mesaj/i).first();
  await input.waitFor({ timeout: 15_000 });
  await input.fill("merhaba mobil");
  await input.press("Enter");
  await expect(page.getByText("merhaba mobil").first()).toBeVisible({ timeout: 10_000 });
  await shot("6-sohbet");
  await noHorizontalOverflow(page, "sohbet");

  // Üye listesi
  await page.getByRole("button", { name: "Üyeler" }).click();
  await page.waitForTimeout(800);
  await shot("7-uyeler");

  console.log("HATALAR:", JSON.stringify([...new Set(errors)].slice(0, 8), null, 1));
});
