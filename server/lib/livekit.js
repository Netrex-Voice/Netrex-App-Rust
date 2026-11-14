// LiveKit sunucu havuzu ve token üretimi (eski _reference/api/livekit-token + livekit-server-info birleşimi).

import { AccessToken } from "livekit-server-sdk";

/**
 * Sunucu havuzu: LIVEKIT_SERVERS_<i>_URL / _KEY / _SECRET (i = 0..19).
 * Yedek: tek sunucu (LIVEKIT_API_KEY / LIVEKIT_API_SECRET / LIVEKIT_URL).
 * `env` parametresi testler içindir.
 */
export function loadServers(env = process.env) {
  const servers = [];
  for (let i = 0; i < 20; i++) {
    const url = env[`LIVEKIT_SERVERS_${i}_URL`];
    if (!url) break;
    servers.push({ url, key: env[`LIVEKIT_SERVERS_${i}_KEY`], secret: env[`LIVEKIT_SERVERS_${i}_SECRET`] });
  }
  if (servers.length === 0 && env.LIVEKIT_API_KEY && env.LIVEKIT_API_SECRET) {
    servers.push({ url: env.LIVEKIT_URL || "", key: env.LIVEKIT_API_KEY, secret: env.LIVEKIT_API_SECRET });
  }
  return servers;
}

/** Sınır dışı indeks en yakın geçerli sunucuya sıkıştırılır (Electron/Rust ile aynı). */
export function pickServer(servers, index) {
  const n = Number.isFinite(Number(index)) ? Math.trunc(Number(index)) : 0;
  const i = Math.min(Math.max(0, n), servers.length - 1);
  return { index: i, server: servers[i] };
}

/** 6 saatlik oda token'ı (yalnızca bağlanırken gerekir; oturum sürerken LiveKit kendisi yeniler). `identity` çağıran tarafından DOĞRULANMIŞ kullanıcı kimliği olmalıdır. */
export async function makeToken(server, { room, identity, name }) {
  const at = new AccessToken(server.key, server.secret, {
    identity,
    name,
    ttl: "6h",
    // Katılımcı odaya girer girmez diğerleri "bağlanıyor" görsün (mikrofon hazır olunca istemci temizler).
    // Anahtar adı: src/utils/micConnectingAttr.js ile aynı olmalı.
    attributes: { netrexMicConnecting: "1" },
  });
  at.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: true,
  });
  return at.toJwt();
}
