// POST /api/cloudinary-delete   gövde: { public_id }   başlık: Authorization: Bearer <Firebase ID token>
// Yanıt: { success: true, result: <Cloudinary yanıtı> }
//
// Yalnızca SAHİBİ silebilir (bkz. lib/cloudinary.js klasör düzeni):
//   netrex/u/<uid>/...       → yalnızca o kullanıcı
//   netrex/s/<sunucuId>/...  → sunucunun sahibi ya da MANAGE_SERVER izni olan üye
// Sahibi bilinmeyen eski yüklemeler (klasörsüz) yalnızca ALLOW_LEGACY_CLIENTS=1 iken silinebilir.

import { v2 as cloudinary } from "cloudinary";
import { allowMethods, cors, jsonBody, legacyClientsAllowed, rateLimit, requireUser, validPublicId } from "../lib/common.js";
import { cloudinaryConfig, ownerOfPublicId } from "../lib/cloudinary.js";
import { hasServerPermission } from "../lib/firestore.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (!allowMethods(req, res, ["POST"])) return;

  const user = await requireUser(req, res);
  if (!user) return;
  if (!rateLimit(res, "delete", user.uid, 30)) return;

  const publicId = jsonBody(req).public_id;
  if (!validPublicId(publicId)) return res.status(400).json({ error: "invalid public_id" });

  const owner = ownerOfPublicId(publicId);
  let allowed = false;
  try {
    if (!owner) allowed = legacyClientsAllowed();
    else if (owner.kind === "user") allowed = owner.id === user.uid;
    else allowed = await hasServerPermission(user.idToken, user.uid, owner.id, "MANAGE_SERVER");
  } catch (e) {
    console.error("Silme yetkisi doğrulanamadı:", e && e.message);
    return res.status(502).json({ error: "could not verify ownership" });
  }
  if (!allowed) return res.status(403).json({ error: "you do not own this image" });

  const cfg = cloudinaryConfig();
  if (!cfg) return res.status(500).json({ error: "Cloudinary not configured" });
  cloudinary.config({ cloud_name: cfg.cloudName, api_key: cfg.apiKey, api_secret: cfg.apiSecret, secure: true });

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return res.status(200).json({ success: true, result });
  } catch (e) {
    console.error("Cloudinary silme hatası:", e && e.message);
    return res.status(502).json({ error: "delete failed" });
  }
}
