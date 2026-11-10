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
const { validPublicId } = await import("../lib/common.js");

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
  const r = await call(tokenApi, { headers: bearer(await idToken()), body: { room: "oda1", identity: "user-1", displayName: "Ali", serverIndex: 1 } });
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
  const r = await call(tokenApi, { headers: h, body: { room: "oda1", identity: "user-1", serverIndex: 999 } });
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

test("cloudinary-delete: giriş şart, public_id doğrulanır", async () => {
  assert.equal((await call(deleteApi, { body: { public_id: "a/b" } })).status, 401);
  const h = bearer(await idToken());
  for (const bad of ["", "../x", "a b", "a&b=c", "/abs", "x".repeat(201), 5, null]) {
    assert.equal((await call(deleteApi, { headers: h, body: { public_id: bad } })).status, 400, `reddedilmeliydi: ${bad}`);
  }
  assert.ok(validPublicId("server_icons/abc-123"));
  // geçerli kimlik + geçerli id → Cloudinary yapılandırılmadığı için 500 (ağ çağrısına gidilmez)
  const r = await call(deleteApi, { headers: h, body: { public_id: "server_icons/abc" } });
  assert.equal(r.status, 500);
});

test("CORS: yalnızca uygulama origin'ine izin verilir; OPTIONS 204", async () => {
  const ok = await call(infoApi, { method: "OPTIONS", headers: { origin: "http://tauri.localhost" } });
  assert.equal(ok.status, 204);
  assert.equal(ok.headers["access-control-allow-origin"], "http://tauri.localhost");
  const bad = await call(infoApi, { method: "OPTIONS", headers: { origin: "https://evil.example" } });
  assert.equal(bad.headers["access-control-allow-origin"], undefined);
});
