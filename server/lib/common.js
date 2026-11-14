// Ortak yardımcılar: CORS, Firebase ID token doğrulama, girdi temizleme.
//
// Eski Next API route'larında hiç kimlik doğrulama yoktu: herkes LiveKit token üretebiliyor ve Cloudinary'den
// resim silebiliyordu. Burada her uç nokta, Firebase girişinin ID token'ını (Authorization: Bearer ...) ister.

import { createLocalJWKSet, createRemoteJWKSet, jwtVerify } from "jose";

// Firebase ID token'larını imzalayan Google anahtarları (jose önbelleğe alır ve döndürür)
const GOOGLE_JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
let jwks = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

/** Yalnızca testler için: yerel anahtar kümesiyle değiştirir. */
export function __setJwksForTest(jwkSet) {
  jwks = createLocalJWKSet(jwkSet);
}

// Masaüstü uygulamanın WebView origin'leri (Windows: http://tauri.localhost, macOS/Linux: tauri://localhost)
const DEFAULT_ORIGINS = ["http://tauri.localhost", "https://tauri.localhost", "tauri://localhost"];

function allowedOrigins() {
  const extra = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return new Set([...DEFAULT_ORIGINS, ...extra]);
}

/** CORS başlıklarını yazar. Önizleme (OPTIONS) isteğini kendisi bitirirse `true` döner. */
export function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins().has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

/**
 * Firebase ID token'ını doğrular. Başarılıysa `{ uid, name }` döner; değilse yanıtı kendisi yazar ve `null` döner.
 * Hata ayrıntısı istemciye verilmez (yalnızca 401), günlüğe yazılır.
 */
export async function requireUser(req, res) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    console.error("FIREBASE_PROJECT_ID tanımlı değil");
    res.status(500).json({ error: "server misconfigured" });
    return null;
  }
  const m = /^Bearer\s+(.+)$/i.exec(String(req.headers.authorization || ""));
  if (!m) {
    res.status(401).json({ error: "missing token" });
    return null;
  }
  try {
    const { payload } = await jwtVerify(m[1], jwks, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ["RS256"],
      clockTolerance: 10,
    });
    if (typeof payload.sub !== "string" || !payload.sub) throw new Error("sub yok");
    // idToken: Firestore'u kullanıcının kendi yetkisiyle okumak için (bkz. lib/firestore.js)
    return { uid: payload.sub, name: typeof payload.name === "string" ? payload.name : "", idToken: m[1] };
  } catch (e) {
    console.warn("token reddedildi:", e && e.code ? e.code : e && e.message);
    res.status(401).json({ error: "invalid token" });
    return null;
  }
}

/** Kontrol karakterlerini boşluğa çevirir, kırpar, uzunluğu sınırlar. */
export function cleanText(v, max) {
  return String(v ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** İstek gövdesi (Vercel JSON'u kendisi ayrıştırır; metin gelirse ayrıştırmayı dener). */
export function jsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(String(req.body || "{}"));
  } catch {
    return {};
  }
}

/** Yalnızca belirtilen yöntemlere izin verir; olmazsa 405 yazar ve `false` döner. */
export function allowMethods(req, res, methods) {
  if (methods.includes(req.method)) return true;
  res.setHeader("Allow", methods.join(", "));
  res.status(405).json({ error: "method not allowed" });
  return false;
}

/** Rust sürümüyle (cloudinary.rs) aynı kural: yol gezintisi / sorgu enjeksiyonu yok. */
export function validPublicId(id) {
  return (
    typeof id === "string" &&
    id.length > 0 &&
    id.length <= 200 &&
    !id.includes("..") &&
    /^[A-Za-z0-9_\-./]+$/.test(id) &&
    !id.startsWith("/")
  );
}

/** Eski (güncellenmemiş) istemcilere geçiş süresince izin ver: Vercel'de ALLOW_LEGACY_CLIENTS=1. Varsayılan: kapalı. */
export function legacyClientsAllowed() {
  return process.env.ALLOW_LEGACY_CLIENTS === "1";
}

// ── Hız sınırı (en iyi çaba) ──────────────────────────────────────────────
// Sunucusuz işlevlerde bellek, örnek (instance) başınadır ve örnekler arasında paylaşılmaz; bu yüzden kesin bir
// sınır değildir, ama tek bir istemcinin aynı örneği dakikada yüzlerce istekle dövmesini engeller.
const buckets = new Map(); // "kapsam:uid" -> { count, resetAt }

/** Sınır aşıldıysa 429 yazar ve `false` döner. */
export function rateLimit(res, scope, uid, max, windowMs = 60_000) {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const key = `${scope}:${uid}`;
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  if (b.count > max) {
    res.setHeader("Retry-After", String(Math.ceil((b.resetAt - now) / 1000)));
    res.status(429).json({ error: "too many requests" });
    return false;
  }
  return true;
}

/** Yalnızca testler için. */
export function __resetRateLimitsForTest() {
  buckets.clear();
}

/** Firebase kullanıcı kimliği (yol/klasör adında güvenle kullanılabilir mi?). */
export function validUid(uid) {
  return typeof uid === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(uid);
}
