const { test } = require("@playwright/test");
const { loginAs, blockProduction, mockLivekitApi, createServerViaUI } = require("../helpers");

// Pencere daraldığında (yarım ekran, yüksek ekran ölçeği) odadaki hangi kontroller kayboluyor?
test("dar pencerede kaybolan kontroller", async ({ page, context, request }) => {
  test.setTimeout(240_000);
  await blockProduction(context, []);
  await mockLivekitApi(context);
  await loginAs(page, "Dar");
  await createServerViaUI(page, request, "Dar Testi");
  await page.getByRole("button", { name: "Dar Testi" }).click();
  await page.getByRole("button", { name: /^genel-sohbet, sesli oda/ }).click();
  await page.getByRole("button", { name: "Bağlantıyı Kes" }).waitFor({ timeout: 30_000 });
  await page.waitForTimeout(3000);

  const names = async () =>
    page.evaluate(() => {
      const out = new Set();
      document.querySelectorAll("button, [role=button]").forEach((e) => {
        const r = e.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || e.closest("[inert]")) return;
        const n = (e.getAttribute("aria-label") || e.getAttribute("title") || e.innerText || "").trim().split("\n")[0].slice(0, 40);
        if (n) out.add(n);
      });
      return [...out];
    });

  const sizes = [[1400, 900], [1024, 800], [900, 800], [767, 800], [600, 800]];
  const base = new Set(await names());
  for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(900);
    const now = new Set(await names());
    const missing = [...base].filter((x) => !now.has(x));
    console.log(`${w}x${h}: ${now.size} kontrol${missing.length ? " | KAYBOLAN: " + missing.join(", ") : " | hepsi var"}`);
    if (w === 600) await page.screenshot({ path: "e2e/.output/dar-600.png" });
  }
});
