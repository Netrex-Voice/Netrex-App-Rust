// Firestore'u KULLANICININ KENDİ kimliğiyle okur (REST). Servis hesabı gerekmez: okuma, depodaki güvenlik kurallarından
// (firestore.rules) geçer. Yani "bu belgeyi okuyabiliyor mu?" sorusu, "kurallara göre üye mi / katılımcı mı?" sorusunun
// cevabıdır ve yetki mantığı tek yerde (kurallarda) kalır.

let fetchImpl = (...args) => fetch(...args);

/** Yalnızca testler için: ağ çağrısını taklit eder. */
export function __setFetchForTest(fn) {
  fetchImpl = fn || ((...args) => fetch(...args));
}

/** Firestore belge/koleksiyon kimliği: yol enjeksiyonuna karşı dar bir alfabe. */
export function validDocId(id) {
  return typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id);
}

/**
 * Belgeyi kullanıcının token'ıyla okur. Okunabiliyorsa alanları (REST biçimi `fields`) döner; okunamıyorsa
 * (yetki yok / belge yok) `null`. Ağ ya da sunucu hatasında fırlatır (çağıran 502 döner; "yetkisiz" sanılmasın).
 */
export async function readAsUser(idToken, segments) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID tanımlı değil");
  if (!Array.isArray(segments) || segments.length % 2 !== 0 || !segments.every(validDocId)) return null;
  const host = process.env.FIRESTORE_EMULATOR_HOST
    ? `http://${process.env.FIRESTORE_EMULATOR_HOST}`
    : "https://firestore.googleapis.com";
  const url = `${host}/v1/projects/${projectId}/databases/(default)/documents/${segments.join("/")}`;
  const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (res.status === 200) {
    const body = await res.json();
    return body.fields || {};
  }
  if (res.status === 403 || res.status === 404) return null;
  throw new Error(`Firestore ${res.status}`);
}

/** REST `fields` içinden düz metin değeri. */
export function stringField(fields, name) {
  return fields && fields[name] && typeof fields[name].stringValue === "string" ? fields[name].stringValue : "";
}

/** REST `fields` içinden metin dizisi. */
export function stringArrayField(fields, name) {
  const values = fields && fields[name] && fields[name].arrayValue && fields[name].arrayValue.values;
  return Array.isArray(values) ? values.map((v) => v.stringValue).filter((v) => typeof v === "string") : [];
}

/**
 * Kullanıcı bu LiveKit odasına girebilir mi?
 *   • `dm_call_<konuşmaId>`  → DM konuşmasının katılımcısı olmalı
 *   • diğerleri (kanal kimliği) → `serverId` verilmeli ve kullanıcı o sunucunun üyesi olmalı (kanal belgesini okuyabilmeli)
 */
export async function canJoinRoom(idToken, room, serverId) {
  if (room.startsWith("dm_call_")) {
    const conversationId = room.slice("dm_call_".length);
    return (await readAsUser(idToken, ["dm_conversations", conversationId])) !== null;
  }
  if (!validDocId(serverId)) return false;
  return (await readAsUser(idToken, ["servers", serverId, "channels", room])) !== null;
}

/** Kullanıcı sunucunun sahibi mi ya da rollerinden biri bu izne sahip mi? (firestore.rules > hasPerm ile aynı mantık) */
export async function hasServerPermission(idToken, uid, serverId, permission) {
  if (!validDocId(serverId)) return false;
  const server = await readAsUser(idToken, ["servers", serverId]);
  if (!server) return false;
  if (stringField(server, "ownerId") === uid) return true;
  const member = await readAsUser(idToken, ["servers", serverId, "members", uid]);
  if (!member) return false;
  const perms = await readAsUser(idToken, ["servers", serverId, "meta", "perms"]);
  if (!perms) return false;
  const allowedRoles = stringArrayField(perms, permission);
  const myRoles = stringArrayField(member, "roles");
  return myRoles.some((r) => allowedRoles.includes(r));
}

/** Kullanıcı sunucunun üyesi mi? (kendi üyelik belgesini okuyabilir) */
export async function isServerMember(idToken, uid, serverId) {
  if (!validDocId(serverId)) return false;
  return (await readAsUser(idToken, ["servers", serverId, "members", uid])) !== null;
}
