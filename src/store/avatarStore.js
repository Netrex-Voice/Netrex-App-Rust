import { create } from "zustand";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/src/lib/firebase";

// Profil fotoğrafı için TEK canlı kaynak: Firestore `users/{uid}.photoURL`.
//
// Sorun: fotoğraf adresi birçok yerde kopyalanıyor (sunucu üye kaydı, LiveKit metadata'sı, oda varlık kaydı,
// mesajlar, DM/arkadaş önbelleği) ve kullanıcı fotoğrafını değiştirince ya da silince bu kopyalar eskiyor.
// Silinen bir resme işaret eden kopya yüklenemeyince harf/gradyan yedeği görünüyordu; üstelik kimi ekran
// fotoğrafı gösteriyor, kimi göstermiyordu.
//
// Çözüm: ekrandaki her kullanıcı için `users/{uid}` belgesini (ref-sayaçlı) dinleyip güncel adresi burada
// tutuyoruz; tüm avatarlar bunu okuyor (bkz. useAvatarUrl / UserPhoto / Avatar). Kopyalar yalnızca ilk anda
// (belge gelene kadar) yedek olarak kullanılır.

export const useAvatarStore = create(() => ({
  photos: {}, // uid -> string | null (belge okunduysa)
}));

const watchers = new Map(); // uid -> { count, unsub, teardownTimer }
let pending = null;
let flushScheduled = false;

const schedule = (fn) =>
  typeof requestAnimationFrame === "function" ? requestAnimationFrame(fn) : setTimeout(fn, 16);

// Açılışta onlarca belge art arda gelir: kare başına tek set()
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

const TEARDOWN_DELAY_MS = 30_000; // liste kaydırılırken/yeniden bağlanırken dinleyici sürekli kapanıp açılmasın

/** uid'yi izlemeye başlar (sayaçlı). Bırakma fonksiyonu döner. */
export function watchAvatar(uid) {
  if (!uid) return () => {};

  let w = watchers.get(uid);
  if (w) {
    clearTimeout(w.teardownTimer);
    w.teardownTimer = null;
    w.count += 1;
  } else {
    const unsub = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const url = snap.exists() ? snap.data().photoURL || null : null;
        queuePhoto(uid, url);
      },
      () => {
        // Okuma izni yok / hata: bilgi yok say, kopya adrese düşülür
      },
    );
    w = { count: 1, unsub, teardownTimer: null };
    watchers.set(uid, w);
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    const cur = watchers.get(uid);
    if (!cur) return;
    cur.count -= 1;
    if (cur.count <= 0) {
      cur.teardownTimer = setTimeout(() => {
        const again = watchers.get(uid);
        if (again && again.count <= 0) {
          try { again.unsub(); } catch (e) {}
          watchers.delete(uid);
        }
      }, TEARDOWN_DELAY_MS);
    }
  };
}

/** Oturum kapanınca tüm dinleyicileri ve önbelleği temizle */
export function resetAvatarStore() {
  watchers.forEach((w) => {
    clearTimeout(w.teardownTimer);
    try { w.unsub(); } catch (e) {}
  });
  watchers.clear();
  pending = null;
  useAvatarStore.setState({ photos: {} });
}
