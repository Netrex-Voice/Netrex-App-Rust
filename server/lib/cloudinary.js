// Cloudinary yardımcıları: yapılandırma, imzalı yükleme parametreleri, klasör sahipliği.
//
// Klasör düzeni (sahiplik klasör adından anlaşılır; imzayı sunucu ürettiği için istemci bunu değiştiremez):
//   netrex/u/<uid>/...        kullanıcının kendi resimleri (profil, arka plan, mesaj resmi)
//   netrex/s/<sunucuId>/...   sunucuya ait resimler (simge, rozet)

import { createHash } from "node:crypto";

export function cloudinaryConfig(env = process.env) {
  const cloudName = env.CLOUDINARY_CLOUD_NAME || env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;
  return cloudName && apiKey && apiSecret ? { cloudName, apiKey, apiSecret } : null;
}

/** Cloudinary imzası: parametreler anahtara göre sıralı `k=v&k=v` + secret, SHA-1 (hex). `api_key`/`file` dahil edilmez. */
export function signParams(params, apiSecret) {
  const joined = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(joined + apiSecret).digest("hex");
}

export const userFolder = (uid) => `netrex/u/${uid}`;
export const serverFolder = (serverId) => `netrex/s/${serverId}`;

/** `public_id` hangi kapsama ait? `{ kind: "user", id } | { kind: "server", id } | null` (eski/sahipsiz yükleme) */
export function ownerOfPublicId(publicId) {
  const m = /^netrex\/(u|s)\/([A-Za-z0-9_-]{1,128})\/[^/]+$/.exec(String(publicId || ""));
  if (!m) return null;
  return { kind: m[1] === "u" ? "user" : "server", id: m[2] };
}
