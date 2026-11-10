"use client";

import { useState } from "react";
import { useAvatarUrl } from "@/src/hooks/useAvatarUrl";

/**
 * Profil fotoğrafı <img>'i: canlı adresi (useAvatarUrl) çözer, yüklenemezse `fallback` düğümünü gösterir.
 *
 * Neden ayrı bileşen:
 *  - Hata durumu React state'inde ve ADRESE bağlı: adres düzelince (kullanıcı fotoğrafı değiştirince / Google'a
 *    dönünce) yeniden denenir. Eskiden elle DOM gizlenip bir daha geri açılmıyordu.
 *  - referrerPolicy="no-referrer": Google'ın fotoğraf sunucusu (lh3) referrer'lı çok sayıda isteği engelleyebiliyor.
 *  - Döngü içinde (liste satırı) güvenle kullanılabilir: hook bileşenin içinde.
 */
export default function UserPhoto({ uid, src, alt = "", className = "", fallback = null, ...imgProps }) {
  const url = useAvatarUrl(uid, src);
  const [failedUrl, setFailedUrl] = useState(null);

  if (!url || failedUrl === url) return fallback;

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      referrerPolicy="no-referrer"
      decoding="async"
      onError={() => setFailedUrl(url)}
      {...imgProps}
    />
  );
}
