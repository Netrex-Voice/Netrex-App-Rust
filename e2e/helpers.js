// Ortak test yardımcıları. Tüm testler GERÇEK Firebase'e değil, yerel emülatörlere bağlıdır (bkz. e2e/stack.mjs).
const BLOCKED = [
  /firestore\.googleapis\.com/, /identitytoolkit\.googleapis\.com/, /securetoken\.googleapis\.com/,
  /firebaseio\.com/, /api\.cloudinary\.com/, /vercel\.app/,
];

/** Üretim servislerine giden her isteği KES (emülatör dışına çıkışın yanlışlıkla olmasını engelleyen güvenlik ağı). */
async function blockProduction(context, hits) {
  // YALNIZCA alan adına bakılır: emülatör adresi (127.0.0.1:9099/identitytoolkit.googleapis.com/...) yolunda aynı sözcükleri içerir
  await context.route((url) => BLOCKED.some((re) => re.test(url.hostname)), (route) => {
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
  // İlk girişte geliştirme sunucusu sayfaları o anda derler: cömert bekleme
  await page.getByText(`Hoş Geldin, ${name}`).waitFor({ timeout: 150_000 });
}

/** Konsol hatalarını ve yakalanmamış istisnaları toplar. */
function collectErrors(page, sink, label = "") {
  page.on("pageerror", (e) => sink.push(`${label}EXC: ${e.message.slice(0, 220)}`));
  page.on("console", (m) => {
    if (m.type() === "error") sink.push(`${label}console.error: ${m.text().slice(0, 220)}`);
  });
  // Hangi istek hata döndü? (konsol "Failed to load resource" ile adresi söylemez)
  page.on("response", (r) => {
    if (r.status() >= 400) sink.push(`${label}HTTP ${r.status()} ${r.request().method()} ${r.url().slice(0, 200)}`);
  });
}

module.exports = { loginAs, collectErrors, blockProduction };

// ------------------------------------------------------------------ ikinci kısım: sunucu / davet / sesli oda

const FS = "http://127.0.0.1:8080/v1/projects/demo-netrex/databases/(default)/documents";
const OWNER = { Authorization: "Bearer owner" }; // emülatörde güvenlik kurallarını atlar (yalnızca test verisi kurmak için)

/** Tarayıcıda /api/livekit-* isteklerini YEREL LiveKit (--dev, devkey/secret) için yanıtlar. */
async function mockLivekitApi(context) {
  const { makeToken } = await import("../server/lib/livekit.js");
  const server = { url: "ws://127.0.0.1:7880", key: "devkey", secret: "secret" };
  await context.route("**/api/livekit-token", async (route) => {
    const b = JSON.parse(route.request().postData() || "{}");
    const token = await makeToken(server, { room: b.room, identity: b.identity, name: b.displayName || b.identity });
    await route.fulfill({ json: { token } });
  });
  await context.route("**/api/livekit-server-info**", (route) =>
    route.fulfill({ json: { url: server.url, serverCount: 1, serverIndex: 0, poolMode: false } }));
}

/** Arayüzden sunucu oluşturur ("Sunucu Ekle" > "Sunucumu Oluştur"); kimliğini emülatörden bulur. */
async function createServerViaUI(page, request, name) {
  await page.getByRole("button", { name: "Sunucu Ekle" }).click();
  await page.getByRole("button", { name: /Sunucumu Oluştur/ }).click();
  await page.getByPlaceholder("Sunucunun adı ne olsun?").fill(name);
  await page.getByRole("button", { name: "Oluştur", exact: true }).click();
  await page.getByRole("button", { name }).waitFor({ timeout: 30_000 });
  const res = await (await request.get(`${FS}/servers`, { headers: OWNER })).json();
  const doc = (res.documents || []).find((d) => d.fields?.name?.stringValue === name);
  if (!doc) throw new Error("sunucu emülatörde bulunamadı: " + name);
  return doc.name.split("/").pop();
}

/** Davet belgesini doğrudan emülatöre yazar (arayüzdeki davet oluşturma ayrıca test edilir). */
async function seedInvite(request, serverId, code) {
  const fields = {
    code: { stringValue: code }, serverId: { stringValue: serverId }, creatorId: { stringValue: "seed" },
    createdAt: { timestampValue: new Date().toISOString() }, uses: { integerValue: "0" }, maxUses: { integerValue: "0" },
    expiresAt: { nullValue: null },
  };
  const r = await request.post(`${FS}/invites?documentId=${code}`, { headers: OWNER, data: { fields } });
  if (!r.ok()) throw new Error("davet yazılamadı: " + (await r.text()));
}

/** "Sunucu Ekle" > "Bir Sunucuya Katıl" > davet kodu */
async function joinViaInvite(page, code) {
  await page.getByRole("button", { name: "Sunucu Ekle" }).click();
  await page.getByRole("button", { name: /Bir Sunucuya Katıl/ }).click();
  await page.locator("input:visible").first().fill(code);
  await page.getByRole("button", { name: "Sunucuya Katıl", exact: true }).click();
}

module.exports.mockLivekitApi = mockLivekitApi;
module.exports.createServerViaUI = createServerViaUI;
module.exports.seedInvite = seedInvite;
module.exports.joinViaInvite = joinViaInvite;
module.exports.FS = FS;
module.exports.OWNER = OWNER;
