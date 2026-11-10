// Ortak test yardımcıları. Tüm testler GERÇEK Firebase'e değil, yerel emülatörlere bağlıdır (bkz. e2e/stack.mjs).
const BLOCKED = [
  /firestore\.googleapis\.com/, /identitytoolkit\.googleapis\.com/, /securetoken\.googleapis\.com/,
  /firebaseio\.com/, /api\.cloudinary\.com/, /vercel\.app/,
];

/** Üretim servislerine giden her isteği KES (emülatör dışına çıkışın yanlışlıkla olmasını engelleyen güvenlik ağı). */
async function blockProduction(context, hits) {
  await context.route((url) => BLOCKED.some((re) => re.test(url.toString())), (route) => {
    hits.push(route.request().url());
    route.abort();
  });
}

/** Anonim (misafir) giriş: kullanıcı adı yazar ve giriş yapar; ana ekran gelene kadar bekler. */
async function loginAs(page, name) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const input = page.getByPlaceholder("Kullanıcı Adı");
  await input.waitFor({ timeout: 60_000 });
  await input.fill(name);
  await page.getByRole("button", { name: /Anonim Giriş/ }).click();
  await input.waitFor({ state: "detached", timeout: 30_000 });
}

/** Konsol hatalarını ve yakalanmamış istisnaları toplar. */
function collectErrors(page, sink, label = "") {
  page.on("pageerror", (e) => sink.push(`${label}EXC: ${e.message.slice(0, 220)}`));
  page.on("console", (m) => {
    if (m.type() === "error") sink.push(`${label}console.error: ${m.text().slice(0, 220)}`);
  });
}

module.exports = { loginAs, collectErrors, blockProduction };
