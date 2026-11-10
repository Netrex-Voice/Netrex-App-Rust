import { ref, push, serverTimestamp } from "firebase/database";
import { doc, getDoc, getDocs, collection } from "firebase/firestore";
import { db, rtdb } from "@/src/lib/firebase";

/**
 * 🎛️ Sesli kanal yönetim komutları (taşı / sesli kanaldan at)
 *
 * Neden LiveKit veri kanalı değil de Realtime Database?
 *  - LiveKit veri mesajı yalnızca AYNI odadaki kişilere gider. Bir yetkili, başka bir kanaldaki kişiyi kenar
 *    çubuğundan taşımak/atmak isteyebilir (Discord'daki gibi); o kişiyle aynı odada olmak zorunda olmamalı.
 *  - Mevcut moderasyon komutları (sustur/at) alıcı tarafta gönderenin yetkisini HİÇ doğrulamıyor. Burada doğruluyoruz.
 *
 * Akış:
 *   Gönderen  → voice_commands/{hedefUid}/{id} = { type, serverId, toChannelId, by, byName, ts }
 *   Hedef     → komutu okur, tek kullanımlık siler, `by` kişisinin yetkisini Firestore'dan DOĞRULAR, sonra uygular.
 *
 * `by` alanı kurallarla `auth.uid`'e eşitlenir (database.rules.json), yani kimse başkası adına komut yazamaz.
 */

export const VOICE_COMMAND_TYPES = {
  MOVE: "MOVE",
  DISCONNECT: "DISCONNECT",
};

// Komut türü → gereken sunucu izni
export const VOICE_COMMAND_PERMISSION = {
  MOVE: "MOVE_MEMBERS",
  DISCONNECT: "KICK_VOICE_MEMBERS",
};

let lastError = null; // en son gönderim hatası (kullanıcıya anlaşılır mesaj vermek için)

/** Son gönderim hatasının kullanıcıya gösterilecek açıklaması */
export function describeVoiceCommandError(fallback = "İstek gönderilemedi.") {
  const text = String(lastError?.code || lastError?.message || "");
  if (/permission[_ ]denied/i.test(text)) {
    return "Gönderilemedi: Realtime Database kuralları 'voice_commands' yoluna izin vermiyor. database.rules.json içeriğini Firebase konsolunda yayınla.";
  }
  if (/network|offline|disconnect/i.test(text)) return "Gönderilemedi: internet bağlantısı yok gibi görünüyor.";
  return text ? `${fallback} (${text})` : fallback;
}

/** Hedef kullanıcıya komut gönderir. Başarılıysa true. */
export async function sendVoiceCommand({ serverId, targetUid, type, toChannelId = null, byUid, byName }) {
  lastError = null;
  if (!serverId || !targetUid || !type || !byUid) return false;
  try {
    await push(ref(rtdb, `voice_commands/${targetUid}`), {
      type,
      serverId,
      toChannelId,
      by: byUid,
      byName: (byName || "").slice(0, 60),
      ts: serverTimestamp(),
    });
    return true;
  } catch (e) {
    lastError = e;
    console.error("Sesli komut gönderilemedi:", e);
    return false;
  }
}

/**
 * Alıcı tarafı: komutu gönderen kişi bu sunucuda gerçekten bu izne sahip mi?
 * (sunucu sahibi ya da izni olan bir role sahip üye)
 */
export async function issuerHasPermission(serverId, issuerUid, permissionId) {
  try {
    const serverSnap = await getDoc(doc(db, "servers", serverId));
    if (!serverSnap.exists()) return false;
    if (serverSnap.data().ownerId === issuerUid) return true;

    const memberSnap = await getDoc(doc(db, "servers", serverId, "members", issuerUid));
    if (!memberSnap.exists()) return false;
    const roleIds = memberSnap.data().roles || [];
    if (roleIds.length === 0) return false;

    const rolesSnap = await getDocs(collection(db, "servers", serverId, "roles"));
    return rolesSnap.docs.some(
      (d) => roleIds.includes(d.id) && (d.data().permissions || []).includes(permissionId),
    );
  } catch (e) {
    console.error("Yetki doğrulanamadı:", e);
    return false;
  }
}
