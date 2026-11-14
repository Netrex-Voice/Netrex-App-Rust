import { doc, getDoc } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { getLiveKitServerInfo, getLiveKitToken } from "@/src/lib/platformBridge";
import { getPreferredUrl } from "@/src/lib/livekitRegion";

/**
 * Sesli odaya girişi ÖNCEDEN ısıtır: fare odanın üstüne gelince (veya odaklanınca) sunucu bilgisi, aktif LiveKit
 * sunucusu (Firebase havuz belgesi), token ve LiveKit sunucusuna DNS+TLS bağlantısı hazırlanır. Tıklayınca ActiveRoom
 * aynı çağrıları yapar ama sonuçlar bellekte hazır olduğundan beklemez.
 *
 * ActiveRoom'daki giriş mantığının (havuz belgesi → sunucu indeksi → token) AYNI sırasını izler; farklı bir indeks
 * seçilirse önbellek ıskalar, bir şey bozulmaz (yalnızca kazanç olmaz).
 */
const lastRun = new Map(); // roomId -> zaman (aynı oda için art arda tetiklemeyi sınırla)

export function prefetchJoin(roomId, userId, username, serverId = null) {
  if (!roomId || !userId) return;
  const now = Date.now();
  if (now - (lastRun.get(roomId) || 0) < 60_000) return;
  lastRun.set(roomId, now);

  (async () => {
    try {
      const info0 = await getLiveKitServerInfo(0);
      let index = 0;
      if (info0 && info0.poolMode) {
        const snap = await getDoc(doc(db, "system", "livekitPool")).catch(() => null);
        const a = snap && snap.exists() ? snap.data().activeServerIndex : 0;
        if (typeof a === "number" && a >= 0 && a < (info0.serverCount || 1)) index = a;
      }
      const info = index === 0 ? info0 : await getLiveKitServerInfo(index);
      await getLiveKitToken(roomId, userId, username, index, serverId);
      // LiveKit sunucusuna DNS + TLS'i ısıt (WebSocket el sıkışması ~1 gidiş-dönüş daha kısa olur)
      const url = info && info.url ? getPreferredUrl(info.url) : null;
      if (url && /^wss:/.test(url)) { // yalnızca TLS'li adresler (yerel ws:// test sunucusunda ısıtılacak TLS yok)
        fetch(url.replace(/^wss:/, "https:"), { mode: "no-cors", cache: "no-store" }).catch(() => {});
      }
    } catch {
      // Isıtma başarısızsa sorun yok: tıklayınca normal yol çalışır
    }
  })();
}
