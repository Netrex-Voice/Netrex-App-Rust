// Odaya yeni katılan kişinin mikrofonu hazır olana kadar diğerlerine "bağlanıyor" göstermek için LiveKit
// katılımcı özniteliği (attributes). Metadata yerine öznitelik kullanıyoruz: anahtar bazında birleşir,
// metadata'yı baştan yazan BottomControls / SettingsUpdater ile birbirinin alanını ezmez.

export const MIC_CONNECTING_ATTR = "netrexMicConnecting";

/** Yerel katılımcı için bayrağı ayarla/temizle. Hata fırlatmaz (eski sunucuda öznitelik yoksa gösterge sessizce çıkmaz). */
export function setLocalMicConnecting(localParticipant, connecting) {
  if (!localParticipant?.setAttributes) return;
  // LiveKit'te boş string anahtarı siler
  localParticipant
    .setAttributes({ [MIC_CONNECTING_ATTR]: connecting ? "1" : "" })
    .catch((e) => console.warn("Mikrofon bağlanma özniteliği ayarlanamadı:", e?.message || e));
}

/** Verilen öznitelik haritasında karşı tarafın mikrofonu hazırlanıyor mu */
export function isMicConnectingAttr(attributes) {
  return attributes?.[MIC_CONNECTING_ATTR] === "1";
}
