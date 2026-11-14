// Sunucu testleri: sahte (kendi anahtarımızla imzalanmış) Firebase token'larıyla kimlik doğrulamayı ve uç noktaları dener.
// Çalıştırma: npm test  (server/ klasöründe)

import test from "node:test";
import assert from "node:assert/strict";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { TokenVerifier } from "livekit-server-sdk";

const PROJECT = "netrex-test";
process.env.FIREBASE_PROJECT_ID = PROJECT;
process.env.LIVEKIT_SERVERS_0_URL = "wss://a.example.com";
process.env.LIVEKIT_SERVERS_0_KEY = "keyA";
process.env.LIVEKIT_SERVERS_0_SECRET = "secretA-secretA-secretA-secretA-1234";
process.env.LIVEKIT_SERVERS_1_URL = "wss://b.example.com";
process.env.LIVEKIT_SERVERS_1_KEY = "keyB";
process.env.LIVEKIT_SERVERS_1_SECRET = "secretB-secretB-secretB-secretB-5678";

const { __setJwksForTest } = await import("../lib/common.js");
const { default: tokenApi } = await import("../api/livekit-token.js");
const { default: infoApi } = await import("../api/livekit-server-info.js");
const { default: deleteApi } = await import("../api/cloudinary-delete.js");
const { validPublicId, __resetRateLimitsForTest } = await import("../lib/common.js");
const { default: signApi } = await import("../api/cloudinary-sign.js");
const { __setFetchForTest } = await import("../lib/firestore.js");
const { signParams, ownerOfPublicId } = await import("../lib/cloudinary.js");

// Firestore REST taklidi: "kullanıcı bu belgeyi okuyabiliyor mu?" → okunabilir yollar (kullanıcıya göre)
const readable = new Map(); // "uid|yol" -> fields
const allow = (uid, path, fields = {}) => readable.set(`${uid}|${path}`, fields);
const uidOfBearer = (h) => JSON.parse(Buffer.from(String(h).split(" ")[1].split(".")[1], "base64url").toString()).sub;
__setFetchForTest(async (url, init) => {
  const path = decodeURIComponent(String(url).split("/documents/")[1]);
  const key = `${uidOfBearer(init.headers.Authorization)}|${path}`;
  return readable.has(key)
    ? { status: 200, json: async () => ({ fields: readable.get(key) }) }
    : { status: 403, json: async () => ({}) };
});
allow("user-1", "servers/s1/channels/oda1", { type: { stringValue: "voice" } });
allow("user-1", "dm_conversations/c1");
test.beforeEach(() => __resetRateLimitsForTest());

const { publicKey, privateKey } = await generateKeyPair("RS256");
const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256", use: "sig" };
__setJwksForTest({ keys: [jwk] });

async function idToken({ uid = "user-1", aud = PROJECT, iss = `https://securetoken.google.com/${PROJECT}`, exp = "1h", key = privateKey } = {}) {
  return new SignJWT({ name: "Ali" })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setSubject(uid)
    .setAudience(aud)
    .setIssuer(iss)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(key);
}

/** Vercel'in req/res nesnelerinin asgari taklidi */
function call(handler, { method = "POST", headers = {}, body, query } = {}) {
  return new Promise(async (resolve) => {
    const out = { status: 200, headers: {}, json: undefined };
    const res = {
      setHeader: (k, v) => (out.headers[k.toLowerCase()] = v),
      status(c) { out.status = c; return res; },
      json(j) { out.json = j; resolve(out); return res; },
      end() { resolve(out); return res; },
    };
    await handler({ method, headers, body, query }, res);
    resolve(out); // yanıt yazılmadan dönenler (CORS önizleme vb.)
  });
}
const bearer = (t) => ({ authorization: `Bearer ${t}` });

test("token: geçerli kullanıcı kendi kimliği için token alır ve token LiveKit tarafından doğrulanır", async () => {
  const r = await call(tokenApi, { headers: bearer(await idToken()), body: { room: "oda1", identity: "user-1", displayName: "Ali", serverIndex: 1, serverId: "s1" } });
  assert.equal(r.status, 200);
  const claims = await new TokenVerifier("keyB", "secretB-secretB-secretB-secretB-5678").verify(r.json.token); // 1. sunucu (B)
  assert.equal(claims.sub, "user-1");
  assert.equal(claims.name, "Ali");
  assert.equal(claims.video.room, "oda1");
  assert.equal(claims.video.roomJoin, true);
  assert.equal(claims.attributes.netrexMicConnecting, "1");
  await assert.rejects(new TokenVerifier("keyB", "yanlis-secret-yanlis-secret-yanlis-1").verify(r.json.token));
});

test("token: başkasının kimliği için token verilmez (403)", async () => {
  const r = await call(tokenApi, { headers: bearer(await idToken({ uid: "user-1" })), body: { room: "oda1", identity: "baska-kullanici" } });
  assert.equal(r.status, 403);
  assert.equal(r.json.token, undefined);
});

test("token: kimliksiz, bozuk, yanlış proje, süresi dolmuş, yabancı anahtarla imzalı token reddedilir (401)", async () => {
  const body = { room: "oda1", identity: "user-1" };
  assert.equal((await call(tokenApi, { body })).status, 401);
  assert.equal((await call(tokenApi, { headers: bearer("bozuk.token.degeri"), body })).status, 401);
  assert.equal((await call(tokenApi, { headers: bearer(await idToken({ aud: "baska-proje" })), body })).status, 401);
  assert.equal((await call(tokenApi, { headers: bearer(await idToken({ iss: "https://securetoken.google.com/baska-proje" })), body })).status, 401);
  assert.equal((await call(tokenApi, { headers: bearer(await idToken({ exp: "-1m" })), body })).status, 401);
  const other = await generateKeyPair("RS256");
  assert.equal((await call(tokenApi, { headers: bearer(await idToken({ key: other.privateKey })), body })).status, 401);
});

test("token: eksik alan 400, yanlış yöntem 405, sınır dışı sunucu indeksi sıkıştırılır", async () => {
  const h = bearer(await idToken());
  assert.equal((await call(tokenApi, { headers: h, body: { room: "" , identity: "user-1" } })).status, 400);
  assert.equal((await call(tokenApi, { method: "GET", headers: h })).status, 405);
  const r = await call(tokenApi, { headers: h, body: { room: "oda1", identity: "user-1", serverIndex: 999, serverId: "s1" } });
  assert.equal(r.status, 200);
  await new TokenVerifier("keyB", "secretB-secretB-secretB-secretB-5678").verify(r.json.token); // son sunucu
});

test("server-info: URL döner, key/secret asla; giriş şart", async () => {
  assert.equal((await call(infoApi, { method: "GET" })).status, 401);
  const r = await call(infoApi, { method: "GET", headers: bearer(await idToken()), query: { serverIndex: "1" } });
  assert.equal(r.status, 200);
  assert.deepEqual(r.json, { url: "wss://b.example.com", serverCount: 2, serverIndex: 1, poolMode: true });
  assert.ok(!JSON.stringify(r.json).includes("secret"));
});

test("token: üyesi olmadığı odaya token verilmez; DM araması yalnızca katılımcıya", async () => {
  const h = bearer(await idToken());
  const t = (body) => call(tokenApi, { headers: h, body: { identity: "user-1", ...body } });
  assert.equal((await t({ room: "oda1", serverId: "baska" })).status, 403);       // başka sunucu
  assert.equal((await t({ room: "gizli-oda", serverId: "s1" })).status, 403);     // okuyamadığı kanal
  assert.equal((await t({ room: "oda1" })).status, 403);                          // serverId yok (eski istemci)
  assert.equal((await t({ room: "oda1", serverId: "../x" })).status, 403);        // yol enjeksiyonu
  assert.equal((await t({ room: "dm_call_c1" })).status, 200);                    // katılımcısı olduğu DM
  assert.equal((await t({ room: "dm_call_baskasi" })).status, 403);
  // başka kullanıcı aynı odaya giremez
  const other = bearer(await idToken({ uid: "user-2" }));
  assert.equal((await call(tokenApi, { headers: other, body: { room: "oda1", identity: "user-2", serverId: "s1" } })).status, 403);
});

test("token: geçiş modu (ALLOW_LEGACY_CLIENTS=1) serverId göndermeyen eski istemciyi kabul eder", async () => {
  process.env.ALLOW_LEGACY_CLIENTS = "1";
  try {
    const h = bearer(await idToken());
    assert.equal((await call(tokenApi, { headers: h, body: { room: "oda1", identity: "user-1" } })).status, 200);
    // serverId verildiyse yine doğrulanır
    assert.equal((await call(tokenApi, { headers: h, body: { room: "oda1", identity: "user-1", serverId: "baska" } })).status, 403);
  } finally {
    delete process.env.ALLOW_LEGACY_CLIENTS;
  }
});

test("hız sınırı: dakikada 40 token isteğinden sonrası 429", async () => {
  const h = bearer(await idToken({ uid: "user-1" }));
  let last;
  for (let i = 0; i < 41; i++) last = await call(tokenApi, { headers: h, body: { room: "dm_call_c1", identity: "user-1" } });
  assert.equal(last.status, 429);
});

test("cloudinary-delete: giriş şart, public_id doğrulanır, yalnızca sahibi siler", async () => {
  assert.equal((await call(deleteApi, { body: { public_id: "a/b" } })).status, 401);
  const h = bearer(await idToken());
  for (const bad of ["", "../x", "a b", "a&b=c", "/abs", "x".repeat(201), 5, null]) {
    assert.equal((await call(deleteApi, { headers: h, body: { public_id: bad } })).status, 400, `reddedilmeliydi: ${bad}`);
  }
  assert.ok(validPublicId("server_icons/abc-123"));
  const del = (public_id, headers = h) => call(deleteApi, { headers, body: { public_id } });
  // başkasının resmi, sahipsiz eski resim, yetkisiz sunucu resmi → 403
  assert.equal((await del("netrex/u/user-2/abc")).status, 403);
  assert.equal((await del("server_icons/abc")).status, 403);
  assert.equal((await del("netrex/s/s1/icon")).status, 403);
  // kendi resmi → yetki tamam; Cloudinary yapılandırılmadığı için 500 (ağ çağrısına gidilmez)
  assert.equal((await del("netrex/u/user-1/abc")).status, 500);
  // sunucu sahibi → yetki tamam
  allow("user-1", "servers/s9", { ownerId: { stringValue: "user-1" } });
  assert.equal((await del("netrex/s/s9/icon")).status, 500);
  // MANAGE_SERVER rolü olan üye → yetki tamam; rolü olmayan → 403
  for (const u of ["user-3", "user-4"]) {
    allow(u, "servers/s9", { ownerId: { stringValue: "user-1" } });
    allow(u, "servers/s9/meta/perms", { MANAGE_SERVER: { arrayValue: { values: [{ stringValue: "admin" }] } } });
  }
  allow("user-3", "servers/s9/members/user-3", { roles: { arrayValue: { values: [{ stringValue: "admin" }] } } });
  allow("user-4", "servers/s9/members/user-4", { roles: { arrayValue: { values: [{ stringValue: "everyone" }] } } });
  assert.equal((await del("netrex/s/s9/icon", bearer(await idToken({ uid: "user-3" })))).status, 500);
  assert.equal((await del("netrex/s/s9/icon", bearer(await idToken({ uid: "user-4" })))).status, 403);
  assert.deepEqual(ownerOfPublicId("netrex/u/abc/x1"), { kind: "user", id: "abc" });
  assert.equal(ownerOfPublicId("netrex/u/abc/../x"), null);
});

test("cloudinary-sign: klasörü sunucu belirler; imza Cloudinary kuralıyla üretilir", async () => {
  assert.equal((await call(signApi, { body: {} })).status, 401);
  const h = bearer(await idToken());
  assert.equal((await call(signApi, { headers: h, body: {} })).status, 500); // yapılandırılmamış
  process.env.CLOUDINARY_CLOUD_NAME = "demo";
  process.env.CLOUDINARY_API_KEY = "key123";
  process.env.CLOUDINARY_API_SECRET = "abcd";
  try {
    const r = await call(signApi, { headers: h, body: {} });
    assert.equal(r.status, 200);
    assert.equal(r.json.folder, "netrex/u/user-1");
    assert.equal(r.json.signature, signParams({ folder: r.json.folder, timestamp: r.json.timestamp }, "abcd"));
    assert.ok(!JSON.stringify(r.json).includes("abcd")); // secret asla dönmez
    // sunucu klasörü: yalnızca üye
    assert.equal((await call(signApi, { headers: h, body: { serverId: "s9" } })).status, 403);
    allow("user-1", "servers/s9/members/user-1");
    assert.equal((await call(signApi, { headers: h, body: { serverId: "s9" } })).json.folder, "netrex/s/s9");
    // bağımsız doğrulama (Rust testindeki aynı vektör): public_id=sample&timestamp=1315060510 + abcd
    assert.equal(signParams({ timestamp: 1315060510, public_id: "sample" }, "abcd"), "c3470533147774275dd37996cc4d0e68fd03cd4f");
  } finally {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
  }
});

test("CORS: yalnızca uygulama origin'ine izin verilir; OPTIONS 204", async () => {
  const ok = await call(infoApi, { method: "OPTIONS", headers: { origin: "http://tauri.localhost" } });
  assert.equal(ok.status, 204);
  assert.equal(ok.headers["access-control-allow-origin"], "http://tauri.localhost");
  const bad = await call(infoApi, { method: "OPTIONS", headers: { origin: "https://evil.example" } });
  assert.equal(bad.headers["access-control-allow-origin"], undefined);
});
