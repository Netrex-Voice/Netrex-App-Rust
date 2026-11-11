const { test, expect } = require("@playwright/test");
const { loginAs, collectErrors, blockProduction, mockLivekitApi, createServerViaUI } = require("../helpers");

// Odaya girişi ısıtma: fare odanın üstüne gelince token/sunucu bilgisi ÖNCEDEN alınır; tıklayınca tekrar istenmez.
test("fare üstüne gelince giriş ısıtılır, tıklayınca ağ turu beklenmez", async ({ page, context, request }) => {
  test.setTimeout(240_000);
  const errors = [];
  collectErrors(page, errors);
  await blockProduction(context, []);
  await mockLivekitApi(context);
  await loginAs(page, "Isitma");
  await createServerViaUI(page, request, "Isitma Testi");
  await page.getByRole("button", { name: "Isitma Testi" }).click();
  const voice = page.getByRole("button", { name: /^genel-sohbet, sesli oda/ });
  await voice.waitFor({ timeout: 30_000 });

  const reqs = [];
  page.on("request", (r) => {
    if (/\/api\/livekit-(token|server-info)/.test(r.url())) reqs.push({ t: Date.now(), kind: /token/.test(r.url()) ? "token" : "bilgi" });
  });

  // 1) Fare üstüne gel: tıklamadan token istenmeli
  await voice.hover();
  await page.waitForTimeout(2500);
  const afterHover = { token: reqs.filter((r) => r.kind === "token").length, bilgi: reqs.filter((r) => r.kind === "bilgi").length };
  console.log("hover sonrası istekler:", JSON.stringify(afterHover));
  expect(afterHover.token, "hover token'ı önceden almalı").toBeGreaterThanOrEqual(1);

  // 2) Tıkla: oda açılmalı ve yeni token/bilgi isteği GİTMEMELİ
  const mark = reqs.length;
  const tClick = Date.now();
  await voice.click();
  await page.getByRole("button", { name: "Bağlantıyı Kes", exact: true }).waitFor({ timeout: 30_000 });
  const joinMs = Date.now() - tClick;
  const extra = reqs.slice(mark);
  console.log(`tıklayınca ek istek: ${extra.length} (${extra.map((e) => e.kind).join(",") || "yok"}) | giriş süresi (yerel LiveKit): ${joinMs} ms`);
  expect(extra.length, "tıklayınca yeni ağ turu olmamalı (önbellekten)").toBe(0);
  console.log("HATALAR:", JSON.stringify([...new Set(errors)].slice(0, 6)));
});
