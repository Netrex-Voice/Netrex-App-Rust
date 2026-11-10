const { test, expect } = require("@playwright/test");
const { loginAs, collectErrors, blockProduction, mockLivekitApi, createServerViaUI, seedInvite, joinViaInvite } = require("../helpers");

test("iki kullanıcı aynı sesli odaya giriyor", async ({ browser, request }) => {
  test.setTimeout(240_000);
  const errors = [], blocked = [];
  const ctxA = await browser.newContext({ permissions: ["microphone", "camera"] });
  const ctxB = await browser.newContext({ permissions: ["microphone", "camera"] });
  for (const c of [ctxA, ctxB]) { await blockProduction(c, blocked); await mockLivekitApi(c); }
  const A = await ctxA.newPage(), B = await ctxB.newPage();
  collectErrors(A, errors, "[A] "); collectErrors(B, errors, "[B] ");

  await loginAs(A, "Ali");
  const serverId = await createServerViaUI(A, request, "Oda Testi");
  await seedInvite(request, serverId, "TESTKOD1");

  await loginAs(B, "Veli");
  await joinViaInvite(B, "TESTKOD1");
  await B.getByRole("button", { name: "Oda Testi" }).waitFor({ timeout: 30_000 });
  console.log("B sunucuya katıldı");

  for (const p of [A, B]) {
    await p.getByRole("button", { name: "Oda Testi" }).click();
    await p.getByText("genel-sohbet").first().waitFor({ timeout: 30_000 });
  }
  await A.getByText("genel-sohbet").first().click();
  await A.waitForTimeout(6000);
  await A.screenshot({ path: "e2e/.output/oda-A-tek.png" });
  await B.getByText("genel-sohbet").first().click();
  await B.waitForTimeout(8000);
  await A.screenshot({ path: "e2e/.output/oda-A-iki.png" });
  await B.screenshot({ path: "e2e/.output/oda-B-iki.png" });
  console.log("A görüyor:", JSON.stringify((await A.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 400)));
  console.log("HATALAR:", JSON.stringify([...new Set(errors)].slice(0, 12), null, 1));
  console.log("ENGELLENEN ÜRETİM İSTEKLERİ:", blocked.length ? blocked : "yok");
});
