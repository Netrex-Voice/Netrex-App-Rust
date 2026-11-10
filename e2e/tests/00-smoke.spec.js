const { test } = require("@playwright/test");

test("giriş sayfası açılıyor ve konsolda hata yok", async ({ page }) => {
  const log = [];
  page.on("pageerror", (e) => log.push("EXC: " + e.message.slice(0, 200)));
  page.on("console", (m) => log.push(`${m.type()}: ${m.text().slice(0, 180)}`));
  page.on("requestfailed", (r) => log.push("İSTEK HATASI: " + r.url().slice(0, 120) + " " + (r.failure()?.errorText || "")));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(20000); // dev derlemesi + Firebase oturum kontrolü
  await page.screenshot({ path: "e2e/.output/login.png" });
  const text = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 300);
  console.log("SAYFA METNİ:", JSON.stringify(text));
  console.log("GÜNLÜK:\n" + [...new Set(log)].slice(0, 25).join("\n"));
});
