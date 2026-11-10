"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { ref, onValue, onDisconnect, set, push, remove, serverTimestamp } from "firebase/database";
import { rtdb } from "@/src/lib/firebase";

/**
 * 🟢 GERÇEK ZAMANLI BAĞLANTI DURUMU (Realtime Database + onDisconnect)
 *
 * Firestore'daki presence (online / idle / dnd) kullanıcının SEÇTİĞİ durumdur ve heartbeat ile tazelenir;
 * uygulama çökerse veya internet kesilirse dakikalarca "çevrimiçi" kalırdı.
 *
 * Burada ayrıca yalnızca "şu an en az bir cihazım bağlı mı?" bilgisi tutulur:
 *   user_presence/{uid}/connections/{bağlantıId} = true      ← her açık cihaz/sekme için bir kayıt
 *   user_presence/{uid}/lastOnline               = zaman      ← en son kopma anı
 *
 * Her bağlantı kendi kaydını yazar ve sunucuya "bağlantı koparsa bu kaydı sil" der (onDisconnect).
 * Bağlantı gracefully kapansa da, çökse de, internet de kesilse de sunucu kaydı kendisi siler
 * (kopma TCP/WebSocket zaman aşımına göre genelde ~1 dk içinde algılanır; istemci beklemez).
 * Kullanıcı birden çok cihazdan bağlıysa (bilgisayar + telefon) yalnızca TÜMÜ koptuğunda çevrimdışı olur.
 *
 * Okuyucular `getEffectivePresence` içinden bu bilgiyi kullanır; bilgi YOKSA (kural izin vermiyor,
 * eski sürüm kullanıcısı vb.) eski heartbeat/bayatlama mantığına sessizce düşülür.
 *
 * ── Gerekli Realtime Database güvenlik kuralı (Firebase Konsolu > Realtime Database > Kurallar) ──
 *   "user_presence": {
 *     "$uid": {
 *       ".read": "auth != null",
 *       ".write": "auth != null && auth.uid === $uid"
 *     }
 *   }
 */

const PATH = "user_presence";

// ──────────────────────────────────────
// OKUYUCU: uid -> { connected }
// ──────────────────────────────────────
const states = new Map();
const watchers = new Map(); // uid -> { count, unsub }
const subscribers = new Set();
let version = 0;
let bumpTimer = null;

// Çok sayıda üye aynı anda yüklenirken tek bir yeniden çizim yetsin
function scheduleBump() {
  if (bumpTimer) return;
  bumpTimer = setTimeout(() => {
    bumpTimer = null;
    version += 1;
    subscribers.forEach((fn) => {
      try { fn(); } catch (e) {}
    });
  }, 100);
}

/** Anlık bağlantı bilgisi: { connected } ya da bilinmiyorsa undefined */
export function getRtdbPresence(uid) {
  return uid ? states.get(uid) : undefined;
}

function attach(uid) {
  return onValue(
    ref(rtdb, `${PATH}/${uid}`),
    (snap) => {
      const v = snap.val();
      const connections = v && typeof v === "object" ? v.connections : null;
      const hasConnections = !!connections && typeof connections === "object" && Object.keys(connections).length > 0;
      // Bilgi var sayılması için bu sistemi en az bir kez kullanmış olmalı (bağlantı ya da lastOnline kaydı)
      if (v && (hasConnections || v.lastOnline)) states.set(uid, { connected: hasConnections });
      else states.delete(uid);
      scheduleBump();
    },
    () => {
      // Okuma izni yok / hata: bilgi yok say, eski mantığa düşülsün
      states.delete(uid);
      scheduleBump();
    },
  );
}

/** uid listesini dinlemeye başlar (sayaçlı: aynı uid'yi birden çok bileşen izleyebilir). Temizleme fonksiyonu döner. */
export function watchPresence(uids) {
  const list = [...new Set((uids || []).filter(Boolean))];
  list.forEach((uid) => {
    const w = watchers.get(uid);
    if (w) w.count += 1;
    else watchers.set(uid, { count: 1, unsub: attach(uid) });
  });
  return () => {
    list.forEach((uid) => {
      const w = watchers.get(uid);
      if (!w) return;
      w.count -= 1;
      if (w.count <= 0) {
        try { w.unsub(); } catch (e) {}
        watchers.delete(uid);
        // Artık güncellenmeyen bilgi bayatlar ("hep bağlı" görünmesin): sil, eski mantık devralsın
        states.delete(uid);
      }
    });
  };
}

function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}
const getVersion = () => version;

/**
 * React: verilen kullanıcıların bağlantı durumunu dinler ve değiştiğinde bileşeni yeniden çizdirir.
 * Dönen sayı, useMemo bağımlılıklarına eklenebilir.
 */
export function useRtdbPresenceWatch(uids) {
  const key = useMemo(() => [...new Set((uids || []).filter(Boolean))].sort().join(","), [uids]);
  const v = useSyncExternalStore(subscribe, getVersion, getVersion);
  useEffect(() => {
    if (!key) return;
    return watchPresence(key.split(","));
  }, [key]);
  return v;
}

// ──────────────────────────────────────
// YAZICI: kendi bağlantım
// ──────────────────────────────────────
// Bu oturumun (cihaz/sekme) bağlantı kaydı; markMyConnectionOffline bunu siler
let myConnectionRef = null;

/**
 * Bu cihazın bağlantısını yayınlar ve kopmaya karşı onDisconnect kaydeder. Temizleme fonksiyonu döner
 * (çıkış yapınca çağrılır). Yazma izni yoksa sessizce hiçbir şey olmaz (heartbeat yöntemi sürer).
 */
export function startMyConnectionPresence(uid) {
  if (!uid) return () => {};
  const connectionsRef = ref(rtdb, `${PATH}/${uid}/connections`);
  const lastOnlineRef = ref(rtdb, `${PATH}/${uid}/lastOnline`);

  const stop = onValue(ref(rtdb, ".info/connected"), async (snap) => {
    if (snap.val() !== true) return;
    try {
      // Her (yeniden) bağlanmada bu oturum için yeni bir kayıt açılır
      const conRef = push(connectionsRef);
      myConnectionRef = conRef;
      // Sıra önemli: önce "koparsa sil" kaydı, sonra "bağlıyım" (arada kopma olursa kayıt takılı kalmasın)
      await onDisconnect(conRef).remove();
      await set(conRef, true);
      await onDisconnect(lastOnlineRef).set(serverTimestamp());
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        console.warn("RTDB presence yazılamadı (kurallar user_presence'a izin vermiyor olabilir):", e?.code || e);
      }
    }
  });

  return () => {
    try { stop(); } catch (e) {}
    markMyConnectionOffline(uid);
  };
}

/** Çıkışta/kapanışta bu cihazın bağlantısını hemen sil (en iyi çaba; diğer cihazlar etkilenmez) */
export function markMyConnectionOffline(uid) {
  if (!uid) return;
  const conRef = myConnectionRef;
  myConnectionRef = null;
  if (conRef) {
    remove(conRef).catch(() => {});
    onDisconnect(conRef).cancel().catch(() => {});
  }
  set(ref(rtdb, `${PATH}/${uid}/lastOnline`), serverTimestamp()).catch(() => {});
}
