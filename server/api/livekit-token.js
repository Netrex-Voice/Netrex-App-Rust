// POST /api/livekit-token   gövde: { room, identity, displayName, serverIndex }   başlık: Authorization: Bearer <Firebase ID token>
// Yanıt: { token }

import { allowMethods, cleanText, cors, jsonBody, requireUser } from "../lib/common.js";
import { loadServers, makeToken, pickServer } from "../lib/livekit.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (!allowMethods(req, res, ["POST"])) return;

  const user = await requireUser(req, res);
  if (!user) return;

  const body = jsonBody(req);
  const room = cleanText(body.room, 128);
  const identity = cleanText(body.identity, 128);
  if (!room || !identity) return res.status(400).json({ error: "room and identity are required" });

  // Kimlik sahtecilik koruması: token yalnızca giriş yapmış kullanıcının KENDİ kimliği için verilir.
  // (Eskiden istemcinin yolladığı identity olduğu gibi kullanılıyordu: başkası gibi odaya girilebilirdi.)
  if (identity !== user.uid) return res.status(403).json({ error: "identity does not match the signed-in user" });

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
