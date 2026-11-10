const { test, expect } = require("@playwright/test");
const { loginAs, collectErrors, blockProduction, mockLivekitApi, createServerViaUI, seedInvite, joinViaInvite } = require("../helpers");

// Odadayken Ana Sayfa: gerçek Ana Sayfa görünür, odadakiler küçük kutuda canlı listelenir, "Odaya dön" çalışır.
test("Ana Sayfa'da sesli oda kutusu", async ({ browser, request }) => {
  test.setTimeout(300_000);
  const errors = [];
  const mk = async () => {
    const c = await browser.newContext({ permissions: ["microphone", "camera"] });
    await blockProduction(c, []); await mockLivekitApi(c);
    return { c, p: await c.newPage() };
  };
  const A = await mk(), B = await mk();
  collectErrors(A.p, errors, "[A] "); collectErrors(B.p, errors, "[B] ");

  await loginAs(A.p, "Ali");
  const serverId = await createServerViaUI(A.p, request, "Kutu Testi");
  await seedInvite(request, serverId, "KUTUKOD1");
  await loginAs(B.p, "Veli");
  await joinViaInvite(B.p, "KUTUKOD1");
  for (const p of [A.p, B.p]) {
    await p.getByRole("button", { name: "Kutu Testi" }).click();
    await p.getByRole("button", { name: /^genel-sohbet, sesli oda/ }).click();
    await p.getByRole("button", { name: "Bağlantıyı Kes", exact: true }).waitFor({ timeout: 30_000 });
  }
  await A.p.waitForTimeout(4000);

  const widget = A.p.getByRole("region", { name: "Sesli oda" });
  const roomControls = A.p.getByRole("button", { name: "Bağlantıyı Kes", exact: true });

  // Oda ekranında: kutu yok, oda kontrolleri var
  await expect(widget).toHaveCount(0);
  await expect(roomControls).toBeVisible();

  // Ana Sayfa'ya geç: gerçek Ana Sayfa + küçük kutu; oda ekranı gizli ama bağlantı SÜRÜYOR
  await A.p.getByRole("button", { name: "Ana Sayfa" }).click();
  await expect(A.p.getByText("Hoş Geldin, Ali"), "gerçek Ana Sayfa görünmeli").toBeVisible({ timeout: 10_000 });
  await expect(widget, "küçük oda kutusu").toBeVisible();
  await expect(widget.getByText("genel-sohbet")).toBeVisible();
  await expect(widget.getByText("Ali"), "kutuda kendisi").toBeVisible();
  await expect(widget.getByText("Veli"), "kutuda diğer kişi").toBeVisible();
  await expect(roomControls, "oda kontrolleri Ana Sayfa'da gizli").toHaveCount(0);
  await A.p.screenshot({ path: "e2e/.output/ana-sayfa-kutu.png" });

  // Veli odadan çıkınca kutu güncellenir
  await B.p.getByRole("button", { name: "Bağlantıyı Kes", exact: true }).click();
  await expect(widget.getByText("Veli"), "Veli çıkınca kutudan gitmeli").toHaveCount(0, { timeout: 15_000 });
  await expect(widget.getByText("Ali")).toBeVisible();

  // Odaya dön
  await widget.getByRole("button", { name: "Odaya dön" }).click();
  await expect(roomControls, "Odaya dön sonrası").toBeVisible({ timeout: 10_000 });
  await expect(widget).toHaveCount(0);

  console.log("HATALAR:", JSON.stringify([...new Set(errors)].slice(0, 8)));
});
