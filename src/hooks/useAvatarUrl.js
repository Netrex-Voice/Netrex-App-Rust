import { useEffect } from "react";
import { useAvatarStore, watchAvatar } from "@/src/store/avatarStore";

/**
 * Kullanıcının GÜNCEL profil fotoğrafı adresi.
 *
 * Öncelik: Firestore'dan canlı gelen adres > çağıranın verdiği adres (üye kaydı, metadata, mesaj… kopyası).
 * Canlı adres henüz gelmediyse ya da belgede fotoğraf yoksa kopya adrese düşülür (bkz. avatarStore).
 */
export function useAvatarUrl(uid, fallback) {
  useEffect(() => {
    if (!uid) return;
    return watchAvatar(uid);
  }, [uid]);

  const live = useAvatarStore((s) => (uid ? s.photos[uid] : undefined));
  return live || fallback || null;
}
