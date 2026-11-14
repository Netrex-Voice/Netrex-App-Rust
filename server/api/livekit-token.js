// POST /api/livekit-token
//   gövde: { room, identity, displayName, serverIndex, serverId }   başlık: Authorization: Bearer <Firebase ID token>
// Yanıt: { token }
//
// Token yalnızca (1) giriş yapmış kullanıcının KENDİ kimliği için ve (2) girmeye yetkili olduğu oda için verilir:
// sunucu kanalıysa o sunucunun üyesi, DM aramasıysa (dm_call_<id>) konuşmanın katılımcısı olmalıdır.

import { allowMethods, cleanText, cors, jsonBody, legacyClientsAllowed, rateLimit, requireUser } from "../lib/common.js";
import { canJoinRoom } from "../lib/firestore.js";
import { loadServers, makeToken, pickServer } from "../lib/livekit.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (!allowMethods(req, res, ["POST"])) return;

  const user = await requireUser(req, res);
  if (!user) return;
  if (!rateLimit(res, "token", user.uid, 40)) return;

  const body = jsonBody(req);
  const room = cleanText(body.room, 128);
  const identity = cleanText(body.identity, 128);
  if (!room || !identity) return res.status(400).json({ error: "room and identity are required" });

  // Kimlik sahtecilik koruması: token yalnızca giriş yapmış kullanıcının KENDİ kimliği için verilir.
  if (identity !== user.uid) return res.status(403).json({ error: "identity does not match the signed-in user" });

  // Oda yetkisi. `serverId` göndermeyen eski istemciler yalnızca ALLOW_LEGACY_CLIENTS=1 iken kabul edilir.
  const serverId = cleanText(body.serverId, 128);
  const isDmRoom = room.startsWith("dm_call_");
  if (isDmRoom || serverId || !legacyClientsAllowed()) {
    let allowed;
    try {
      allowed = await canJoinRoom(user.idToken, room, serverId);
    } catch (e) {
      console.error("Oda yetkisi doğrulanamadı:", e && e.message);
      return res.status(502).json({ error: "could not verify room access" });
    }
    if (!allowed) return res.status(403).json({ error: "you do not have access to this room" });
  }

  const servers = loadServers();
  if (servers.length === 0) return res.status(500).json({ error: "LiveKit servers not configured" });
  const { index, server } = pickServer(servers, body.serverIndex);
  if (!server || !server.key || !server.secret) {
    return res.status(500).json({ error: `Server ${index} credentials missing` });
  }

  try {
    const token = await makeToken(server, { room, identity, name: cleanText(body.displayName, 64) || identity });
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ token });
  } catch (e) {
    console.error("LiveKit token hatası:", e && e.message);
    return res.status(500).json({ error: "token generation failed" });
  }
}
