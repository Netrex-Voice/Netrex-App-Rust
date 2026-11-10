import { create } from "zustand";

// Odaya girdikten sonra mikrofon sesinin GERÇEKTEN karşıya gitmeye başladığı ana kadar geçen süreyi izler.
// Kullanıcı "odadayım ama sesim gidiyor mu?" diye merak etmesin: kendi kartında "Bağlanıyor" görünür.
//
// Hazır = mikrofon yayını yapıldı (published) VE ses işlemcisi bağlandı ya da denendi (processed).
// Geçici durum; kalıcı değil.
export const useMicStatusStore = create((set) => ({
  active: false, // odada mıyız (RoomEventsHandler yönetir)
  published: false,
  processed: false,
  failed: false,

  begin: () => set({ active: true, published: false, processed: false, failed: false }),
  end: () => set({ active: false, published: false, processed: false, failed: false }),
  setPublished: () => set({ published: true }),
  setProcessed: () => set({ processed: true }),
  setFailed: () => set({ failed: true }),
  // Güvenlik: bir şey takılırsa gösterge sonsuza kadar dönmesin
  forceReady: () => set({ published: true, processed: true }),
}));

/** Odadayız ve mikrofon henüz tam hazır değil (hata yoksa) */
export const selectMicConnecting = (s) =>
  s.active && !s.failed && !(s.published && s.processed);

/**
 * Mikrofon tam hazır olana (yayın + ses işlemcisi), hata verene ya da süre dolana kadar bekler.
 * Odaya girişte arayüz/presence bunu bekler: kullanıcı odada görününce sesi gerçekten gidiyor olsun.
 */
export function waitForMicReady(timeoutMs = 5000) {
  return new Promise((resolve) => {
    const isDone = (s) => !s.active || s.failed || (s.published && s.processed);
    if (isDone(useMicStatusStore.getState())) return resolve();
    let unsub = null;
    const timer = setTimeout(() => {
      unsub?.();
      resolve();
    }, timeoutMs);
    unsub = useMicStatusStore.subscribe((s) => {
      if (isDone(s)) {
        clearTimeout(timer);
        unsub?.();
        resolve();
      }
    });
  });
}
