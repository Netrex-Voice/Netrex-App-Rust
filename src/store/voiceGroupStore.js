import { create } from "zustand";

/**
 * 🎙️ Konuşma Grupları Store
 *
 * Odadaki kişileri alt gruplara ayırır: aynı gruptakiler birbirini duyar, farklı gruptakiler duymaz.
 * Varsayılan olarak herkes Grup 1'dedir (= özellik kapalı gibi, ses hiç değişmez).
 *
 * Grup atamaları odada paylaşılır (LiveKit data mesajı, bkz. useVoiceGroups). Bu store sadece durumu tutar:
 *  - assignments: { [identity]: groupId }  (yoksa Grup 1)
 *  - version/versionBy: eşzamanlı değişikliklerde hangisinin kazanacağını belirler
 *  - talk: bu cihazda basılı tutulan konuşma modu
 *  - whisperTargetId: "Fısılda" tuşunun hedefi
 *  - incoming: bana özel/gruba konuşan kişiler (kartlarda "sana fısıldıyor" göstergesi)
 */

export const VOICE_GROUPS = [
  { id: 1, name: "Grup 1", color: "#6366f1" }, // indigo
  { id: 2, name: "Grup 2", color: "#10b981" }, // emerald
  { id: 3, name: "Grup 3", color: "#f59e0b" }, // amber
];

export const DEFAULT_GROUP_ID = 1;

export const TALK_MODES = {
  NORMAL: "normal", // sadece kendi grubum
  ALL: "all", // herkes
  GROUP: "group", // kendi grubum + seçili grup
  WHISPER: "whisper", // sadece hedef kişi
};

export const getGroupMeta = (id) =>
  VOICE_GROUPS.find((g) => g.id === id) || VOICE_GROUPS[0];

export const IDLE_TALK = { mode: TALK_MODES.NORMAL, groupId: null };

export const useVoiceGroupStore = create((set, get) => ({
  assignments: {},
  version: 0,
  versionBy: "",

  localIdentity: null, // kendi kimliğim (rozetlerde "benim grubum" için)
  talk: IDLE_TALK,
  whisperTargetId: null,
  incoming: {}, // { [speakerIdentity]: { mode, at } }

  // Başka grupları dinleyenler: { [identity]: number[] } — o kişi hangi grupların sesini duymak istiyor.
  // Gönderen, kendi grubunu dinleyen kişilere de sesini açar (bkz. computeAudience).
  listeners: {},
  setListener: (identity, groups) =>
    set((s) => {
      const next = { ...s.listeners };
      if (groups && groups.length) next[identity] = groups;
      else delete next[identity];
      return { listeners: next };
    }),

  // Bana fısıldayan kişiye otomatik yanıt: o kişi konuşurken ve bitince kısa bir süre sesim SADECE ona gider.
  // until: Infinity = hâlâ fısıldıyor, sayı = yanıt penceresinin bitiş zamanı (ms)
  replyTo: null, // { id, until }
  setReplyTo: (id, until) => set({ replyTo: id ? { id, until } : null }),

  setLocalIdentity: (id) => set({ localIdentity: id || null }),

  getGroupOf: (identity) => get().assignments[identity] ?? DEFAULT_GROUP_ID,

  /** Yerel değişiklik: sürüm artar. Yayınlanacak durumu döndürür. */
  assign: (identities, groupId, myIdentity) => {
    const ids = Array.isArray(identities) ? identities : [identities];
    const next = { ...get().assignments };
    ids.forEach((id) => {
      if (groupId === DEFAULT_GROUP_ID) delete next[id];
      else next[id] = groupId;
    });
    const version = get().version + 1;
    set({ assignments: next, version, versionBy: myIdentity || "" });
    return { assignments: next, version, versionBy: myIdentity || "" };
  },

  /** Herkesi tek grupta birleştir. */
  mergeAll: (myIdentity) => {
    const version = get().version + 1;
    set({ assignments: {}, version, versionBy: myIdentity || "" });
    return { assignments: {}, version, versionBy: myIdentity || "" };
  },

  /** Uzaktan gelen durumu uygula (yalnızca daha yeniyse). */
  applyRemote: ({ assignments, version, versionBy }) => {
    const s = get();
    const newer =
      version > s.version || (version === s.version && String(versionBy) > String(s.versionBy));
    if (!newer) return false;
    set({ assignments: assignments || {}, version, versionBy: versionBy || "" });
    return true;
  },

  setTalk: (talk) => set({ talk: talk || IDLE_TALK }),
  setWhisperTarget: (id) => set({ whisperTargetId: id || null }),

  setIncoming: (speakerId, mode) =>
    set((s) => ({ incoming: { ...s.incoming, [speakerId]: { mode, at: Date.now() } } })),
  clearIncoming: (speakerId) =>
    set((s) => {
      if (!s.incoming[speakerId]) return s;
      const next = { ...s.incoming };
      delete next[speakerId];
      return { incoming: next };
    }),

  /** Odadan çıkınca her şeyi sıfırla. */
  reset: () =>
    set({
      assignments: {},
      version: 0,
      versionBy: "",
      localIdentity: null,
      talk: IDLE_TALK,
      whisperTargetId: null,
      incoming: {},
      listeners: {},
      replyTo: null,
    }),
}));

/** Fısıltıya otomatik yanıt penceresi şu an açık mı? */
export function isReplyActive(replyTo, remoteIdentities) {
  if (!replyTo) return false;
  if (remoteIdentities && !remoteIdentities.includes(replyTo.id)) return false;
  return replyTo.until === Infinity || replyTo.until > Date.now();
}

/**
 * Konuşurken sesimi kimler duyar?
 * @returns {Set<string>} duyabilecek uzak katılımcı kimlikleri
 */
export function computeAudience(myIdentity, remoteIdentities, state) {
  const { assignments, talk, whisperTargetId, replyTo, listeners = {} } = state;
  const groupOf = (id) => assignments[id] ?? DEFAULT_GROUP_ID;
  const myGroup = groupOf(myIdentity);
  const out = new Set();

  // Elle basılı tuş yokken, bana fısıldayan kişiye yanıt penceresi açıksa sesim sadece ona gider
  if (talk.mode === TALK_MODES.NORMAL && isReplyActive(replyTo, remoteIdentities)) {
    out.add(replyTo.id);
    return out;
  }

  if (talk.mode === TALK_MODES.WHISPER) {
    if (whisperTargetId && remoteIdentities.includes(whisperTargetId)) out.add(whisperTargetId);
    return out;
  }
  for (const id of remoteIdentities) {
    const g = groupOf(id);
    if (talk.mode === TALK_MODES.ALL) out.add(id);
    else if (g === myGroup) out.add(id);
    else if (talk.mode === TALK_MODES.GROUP && g === talk.groupId) out.add(id);
    else if (listeners[id]?.includes(myGroup)) out.add(id); // o kişi benim grubumu dinliyor
  }
  return out;
}

/** Özel sohbet (fısıltı) sürerken diğer herkesin sesi bu çarpanla kısılır: karşılıklı konuşan iki kişi öne çıkar. */
export const DUCK_FACTOR = 0.3;

/** Şu an özel konuştuğum kişiler: fısıldadığım, yanıtımın gittiği, bana fısıldayanlar. */
function getPartners(state, remoteIdentities) {
  const { talk, whisperTargetId, replyTo, incoming } = state;
  const partners = new Set();
  if (talk.mode === TALK_MODES.WHISPER && whisperTargetId) partners.add(whisperTargetId);
  if (talk.mode === TALK_MODES.NORMAL && isReplyActive(replyTo, remoteIdentities)) partners.add(replyTo.id);
  Object.entries(incoming).forEach(([id, v]) => {
    if (v.mode === TALK_MODES.WHISPER) partners.add(id);
  });
  return partners;
}

/**
 * Bir kişinin sesine uygulanacak çarpan (0–1), kullanıcının kendi ses ayarının ÜSTÜNE biner:
 *  - Özel sohbet ettiğim kişi: tam ses.
 *  - Bana doğrudan konuşan (grup/herkes): tam ses.
 *  - Başka gruptaki: o grup için ayarladığım "dinleme" seviyesi (0 = duymam).
 *  - Özel sohbet sürerken partner dışındaki herkes kısılır.
 */
export function computeListenFactor(identity, state, groupListenVolumes = {}, remoteIdentities) {
  const { assignments, localIdentity, incoming } = state;
  const partners = getPartners(state, remoteIdentities);
  if (partners.has(identity)) return 1;

  const groupOf = (id) => assignments[id] ?? DEFAULT_GROUP_ID;
  let factor = 1;
  if (!incoming[identity] && localIdentity && groupOf(identity) !== groupOf(localIdentity)) {
    const v = groupListenVolumes[groupOf(identity)];
    factor = Math.max(0, Math.min(100, Number(v) || 0)) / 100;
  }
  if (partners.size > 0) factor *= DUCK_FACTOR;
  return factor;
}
