// POST /api/cloudinary-sign   gövde: { serverId? }   başlık: Authorization: Bearer <Firebase ID token>
// Yanıt: { cloudName, apiKey, timestamp, folder, signature }
//
// İmzalı yükleme: istemci bu değerlerle doğrudan Cloudinary'ye yükler. Klasörü SUNUCU belirler (kullanıcının kendi
// klasörü ya da üyesi olduğu sunucunun klasörü); böylece her resmin sahibi klasör adından bilinir ve silme isteği
// buna göre yetkilendirilir. Herkese açık (imzasız) yükleme preset'ine gerek kalmaz.

import { allowMethods, cleanText, cors, jsonBody, rateLimit, requireUser, validUid } from "../lib/common.js";
import { cloudinaryConfig, serverFolder, signParams, userFolder } from "../lib/cloudinary.js";
import { isServerMember, validDocId } from "../lib/firestore.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (!allowMethods(req, res, ["POST"])) return;

  const user = await requireUser(req, res);
  if (!user) return;
  if (!rateLimit(res, "upload", user.uid, 30)) return;
  if (!validUid(user.uid)) return res.status(400).json({ error: "unsupported user id" });

  const cfg = cloudinaryConfig();
  if (!cfg) return res.status(500).json({ error: "Cloudinary not configured" });

  const serverId = cleanText(jsonBody(req).serverId, 128);
  let folder = userFolder(user.uid);
  if (serverId) {
    if (!validDocId(serverId)) return res.status(400).json({ error: "invalid serverId" });
    try {
      if (!(await isServerMember(user.idToken, user.uid, serverId))) {
        return res.status(403).json({ error: "not a member of this server" });
      }
    } catch (e) {
      console.error("Üyelik doğrulanamadı:", e && e.message);
      return res.status(502).json({ error: "could not verify membership" });
    }
    folder = serverFolder(serverId);
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signParams({ folder, timestamp }, cfg.apiSecret);
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ cloudName: cfg.cloudName, apiKey: cfg.apiKey, timestamp, folder, signature });
}
