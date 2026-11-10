const { test, expect } = require("@playwright/test");
const { loginAs, collectErrors, blockProduction, mockLivekitApi, createServerViaUI } = require("../helpers");

// "Sesli bağlantı" kartı: odanın dışındayken görünür, "Odaya dön" ve "Bağlantıyı kes" çalışır, oda içinde görünmez.
test("sesli bağlantı kartı", async ({ page, context, request }) => {
  test.setTimeout(240_000);
  const errors = [];
  collectErrors(page, errors);
  await blockProduction(context, []);
  await mockLivekitApi(context);
  await loginAs(page, "Kart");
  await createServerViaUI(page, request, "Kart Testi");
  await createServerViaUI(page, request, "Ikinci Sunucu");

  const bar = page.getByRole("region", { name: "Sesli bağlantı" });
  const leaveBtn = page.getByRole("button", { name: "Bağlantıyı Kes", exact: true }); // odadaki alt çubuk

  // Odaya gir
  await page.getByRole("button", { name: "Kart Testi" }).click();
  await page.getByRole("button", { name: /^genel-sohbet, sesli oda/ }).click();
  await leaveBtn.waitFor({ timeout: 30_000 });
  await expect(bar, "oda içindeyken kart görünmemeli").toHaveCount(0);

  // Mesajlar'a geç: kart görünür
  await page.getByRole("button", { name: "Mesajlar" }).click();
  await expect(bar, "Mesajlar'dayken kart görünmeli").toBeVisible();
  await expect(bar.getByText("genel-sohbet")).toBeVisible();
  await expect(bar.getByText("Kart Testi")).toBeVisible();

  // "Odaya dön": oda ekranı geri gelir, kart kaybolur
  await bar.getByRole("button", { name: "Odaya dön" }).click();
  await expect(leaveBtn, "Odaya dön sonrası alt çubuk").toBeVisible({ timeout: 10_000 });
  await expect(bar).toHaveCount(0);

  // Başka sunucuya geç: kart görünür (oda hâlâ bağlı)
  await page.getByRole("button", { name: "Ikinci Sunucu" }).click();
  await expect(bar, "başka sunucudayken kart görünmeli").toBeVisible();
  await expect(bar.getByText("Kart Testi")).toBeVisible();

  // "Bağlantıyı kes" kartından: bağlantı kopar, kart kaybolur
  await bar.getByRole("button", { name: "Sesli bağlantıyı kes" }).click();
  await expect(bar).toHaveCount(0);
  await page.getByRole("button", { name: "Kart Testi" }).click();
  await expect(page.getByRole("button", { name: /^genel-sohbet, sesli oda, boş/ }), "bağlantı kesildi: oda boş").toBeVisible({ timeout: 15_000 });
  await expect(leaveBtn).toHaveCount(0);

  console.log("HATALAR:", JSON.stringify([...new Set(errors)].slice(0, 8)));
});
