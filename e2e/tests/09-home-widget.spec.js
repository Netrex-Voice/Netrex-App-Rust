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

  // KÜÇÜK KUTUDAN çıkış: odanın kendi çıkışı çalışmalı → Firebase'deki oda kaydı ve ses durumu SİLİNMELİ (hayalet kullanıcı kalmasın)
  const FS_USERS = "http://127.0.0.1:8080/v1/projects/demo-netrex/databases/(default)/documents/users";
  const RTDB = "http://127.0.0.1:9000";
  const H = { Authorization: "Bearer owner" };
  const users = await (await request.get(FS_USERS, { headers: H })).json();
  const inRoom = async () => JSON.stringify(await (await request.get(`${RTDB}/room_presence.json?ns=demo-netrex`, { headers: H })).json());
  // Emülatörde önceki testlerden birden çok "Ali" birikmiş olabilir: oda kaydında bulunanı seç
  const roomNow = await inRoom();
  const aliUid = (users.documents || [])
    .filter((d) => d.fields?.username?.stringValue === "Ali" || d.fields?.displayName?.stringValue === "Ali")
    .map((d) => d.name.split("/").pop())
    .find((u) => roomNow.includes(u));
  const voiceState = async () => await (await request.get(`${RTDB}/user_voice_state/${aliUid}.json?ns=demo-netrex`, { headers: H })).json();
  expect(await inRoom(), "çıkıştan önce Ali oda kaydında olmalı").toContain(aliUid);
  expect(await voiceState(), "çıkıştan önce ses durumu dolu olmalı").not.toBeNull();

  await A.p.getByRole("button", { name: "Ana Sayfa" }).click();
  await expect(widget).toBeVisible();
  await widget.getByRole("button", { name: "Sesli bağlantıyı kes" }).click();
  await expect(widget).toHaveCount(0, { timeout: 10_000 });
  await expect.poll(inRoom, { message: "kutudan çıkınca oda kaydı silinmeli", timeout: 10_000 }).not.toContain(aliUid);
  await expect.poll(voiceState, { message: "kutudan çıkınca ses durumu silinmeli", timeout: 10_000 }).toBeNull();

  console.log("HATALAR:", JSON.stringify([...new Set(errors)].slice(0, 8)));
});
