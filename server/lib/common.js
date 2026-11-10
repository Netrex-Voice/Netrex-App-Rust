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
    return { uid: payload.sub, name: typeof payload.name === "string" ? payload.name : "" };
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
