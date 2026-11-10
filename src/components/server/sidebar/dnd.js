// Kenar çubuğunda sürükle-bırak için dataTransfer türleri.
// Tür adları dragover sırasında okunabilir (veri okunamaz), bu yüzden neyin sürüklendiği tür adından anlaşılır.
export const USER_MIME = "application/x-netrex-voice-user";
export const CHANNEL_MIME = "application/x-netrex-channel";

export function hasType(e, mime) {
  return Array.from(e.dataTransfer?.types || []).includes(mime);
}

export function readDragData(e, mime) {
  try {
    return JSON.parse(e.dataTransfer.getData(mime));
  } catch (err) {
    return null;
  }
}
