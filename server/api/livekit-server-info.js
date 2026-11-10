// GET /api/livekit-server-info?serverIndex=0   başlık: Authorization: Bearer <Firebase ID token>
// Yanıt: { url, serverCount, serverIndex, poolMode }. Key/secret ASLA döndürülmez.

import { allowMethods, cors, requireUser } from "../lib/common.js";
import { loadServers, pickServer } from "../lib/livekit.js";

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (!allowMethods(req, res, ["GET"])) return;

  const user = await requireUser(req, res);
  if (!user) return;

  const servers = loadServers();
  if (servers.length === 0) {
    return res
      .status(200)
      .json({ url: "", serverCount: 0, serverIndex: 0, poolMode: false, error: "No LiveKit servers configured" });
  }
  const { index, server } = pickServer(servers, req.query && req.query.serverIndex);
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ url: server.url, serverCount: servers.length, serverIndex: index, poolMode: servers.length > 1 });
}
