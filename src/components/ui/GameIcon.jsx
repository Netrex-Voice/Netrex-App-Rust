"use client";

import { useState, useEffect } from "react";

export default function GameIcon({ iconUrl, icon, name, className, emojiClassName = "" }) {
  const [imgError, setImgError] = useState(false);

  // Eğer iconUrl değişirse (başka oyuna geçerse) hata durumunu sıfırla
  // Böylece yeni oyunun resmi varsa onu deneme şansı olur
  useEffect(() => {
    setImgError(false);
  }, [iconUrl]);

  // URL var ve henüz hata almadıysak resmi dene
  if (iconUrl && !imgError) {
    return (
      <img
        src={iconUrl}
        alt={name}
        className={className}
        onError={() => {
          // Resim yüklenemedi, fallback moduna geç
          console.log(`🖼️ Oyun resmi yüklenemedi (${name}), emojiye geçiliyor.`);
          setImgError(true);
        }}
      />
    );
  }

  // URL yoksa veya resim hata verdiyse emojiyi göster
  return <span className={emojiClassName}>{icon}</span>;
}
