import { create } from "zustand";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/src/lib/firebase";

// Profil fotoğrafı için tek kaynak: Firestore `users/{uid}.photoURL`.
//
// Fotoğraf adresi birçok yerde kopyalanıyor (sunucu üye kaydı, LiveKit metadata'sı, oda varlık kaydı, mesajlar) ve
// kullanıcı fotoğrafını değiştirince bu kopyalar eskiyor. Tüm avatarlar güncel adresi buradan okur
// (bkz. useAvatarUrl / UserPhoto / Avatar); kopyalar yalnızca ilk anda yedek olarak kullanılır.
//
// Maliyet: eskiden ekrandaki HER kullanıcı için `users/{uid}` belgesine canlı dinleyici açılıyordu; o belge durum/
// son görülme/oyun etkinliği için sık yazıldığından her yazma, fotoğraf değişmese de bir okuma demekti. Artık belge
// kullanıcı başına BİR KEZ okunur ve önbelleğe alınır; uzun süre sonra yeniden istenirse tazelenir. Zaten canlı
// dinlenen yerler (üye listesi, arkadaşlar, DM) gördükleri adresi `primeAvatars` ile buraya ücretsiz aktarır.

export const useAvatarStore = create(() => ({
  photos: {}, // uid -> string | null (belge okunduysa)
}));

const REFRESH_AFTER_MS = 15 * 60 * 1000;
const fetchedAt = new Map(); // uid -> son okuma/aktarma zamanı
const inFlight = new Set();
let pending = null;
let flushScheduled = false;

const schedule = (fn) =>
  typeof requestAnimationFrame === "function" ? requestAnimationFrame(fn) : setTimeout(fn, 16);

// Açılışta onlarca adres art arda gelir: kare başına tek set()
function queuePhoto(uid, url) {
  pending = { ...(pending || {}), [uid]: url };
  if (flushScheduled) return;
  flushScheduled = true;
  schedule(() => {
    flushScheduled = false;
    const patch = pending;
    pending = null;
    if (!patch) return;
    useAvatarStore.setState((s) => {
      // Değişen yoksa referansı koru (gereksiz render olmasın)
      let changed = false;
      for (const k of Object.keys(patch)) {
        if (s.photos[k] !== patch[k]) { changed = true; break; }
      }
      return changed ? { photos: { ...s.photos, ...patch } } : s;
    });
  });
}

function fetchAvatar(uid) {
  if (inFlight.has(uid)) return;
  inFlight.add(uid);
  getDoc(doc(db, "users", uid))
    .then((snap) => {
      fetchedAt.set(uid, Date.now());
      queuePhoto(uid, snap.exists() ? snap.data().photoURL || null : null);
    })
    .catch(() => {
      // Okuma izni yok / hata: bilgi yok say, kopya adrese düşülür
    })
    .finally(() => inFlight.delete(uid));
}

/**
 * uid'nin fotoğrafını hazır eder (gerekirse bir kez okur). Eski canlı-dinleyici arayüzüyle uyum için bırakma
 * fonksiyonu döner; artık bırakılacak bir dinleyici yoktur.
 */
export function watchAvatar(uid) {
  if (uid) {
    const at = fetchedAt.get(uid);
    if (at === undefined || Date.now() - at > REFRESH_AFTER_MS) fetchAvatar(uid);
  }
  return () => {};
}

/** Başka bir dinleyicinin zaten okuduğu güncel adresleri aktarır (ek okuma yok): { uid: photoURL | null } */
export function primeAvatars(map) {
  if (!map) return;
  const now = Date.now();
  for (const uid of Object.keys(map)) {
    fetchedAt.set(uid, now);
    queuePhoto(uid, map[uid] || null);
  }
}

/** Oturum kapanınca önbelleği temizle */
export function resetAvatarStore() {
  fetchedAt.clear();
  pending = null;
  useAvatarStore.setState({ photos: {} });
}
