// Kanal mesajlarını Firestore'a TOPLU yazma (kota tasarrufu).
//
// Mesajlar anında LiveKit veri kanalıyla odadakilere gider (ücretsiz). Kalıcı kayıt için her mesaja ayrı bir Firestore
// yazması yapmak yerine, bir yazarın kısa süre içindeki mesajları tek belgede ("toplu belge") birikir ve tek yazmayla
// kaydedilir:
//
//   servers/{sid}/channels/{cid}/messages/{topluId} = {
//     userId, username, timestamp (ilk mesajın zamanı), lastTimestamp,
//     items: [ { id, text, timestamp, ...ek alanlar } ],
//     reactions: { <mesajId>: { <emoji>: [uid, ...] } }
//   }
//
// Okurken de kazanç var: 25 mesajlık bir toplu belge tek okuma sayılır.
// Bu dosyada Firebase YOKTUR (saf mantık): yazma işlevi dışarıdan verilir, böylece birim testi yapılabilir.

export const FLUSH_DELAY_MS = 20_000; // ilk mesajdan sonra en geç bu kadar bekleyip yaz
export const MAX_BATCH_ITEMS = 25;    // bu kadar mesaj birikince beklemeden yaz
const MAX_WRITE_ATTEMPTS = 4;

// Toplu belgede her mesajda tekrarlanmayan (belge düzeyinde tutulan) alanlar
const CHUNK_LEVEL_FIELDS = ["userId", "username"];

const defaultId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 11);

/**
 * @param {object} deps
 * @param {(chunk: {serverId, channelId, docId, data}) => Promise<void>} deps.write  toplu belgeyi yazar
 * @param {number} [deps.delayMs]
 * @param {number} [deps.maxItems]
 * @param {() => string} [deps.newId]
 */
export function createBatcher({ write, delayMs = FLUSH_DELAY_MS, maxItems = MAX_BATCH_ITEMS, newId = defaultId }) {
  const buffers = new Map(); // "sunucu/kanal" -> { serverId, channelId, docId, userId, username, items, reactions, timer, attempts }
  const inFlight = new Set();

  const keyOf = (serverId, channelId) => `${serverId}/${channelId}`;

  function toData(buf) {
    const data = {
      userId: buf.userId,
      username: buf.username || "",
      timestamp: buf.items[0].timestamp,
      lastTimestamp: buf.items[buf.items.length - 1].timestamp,
      items: buf.items,
    };
    if (Object.keys(buf.reactions).length > 0) data.reactions = buf.reactions;
    return data;
  }

  async function flush(key) {
    const buf = buffers.get(key);
    if (!buf) return;
    clearTimeout(buf.timer);
    buffers.delete(key); // sonraki mesajlar yeni bir toplu belgeye gider
    if (buf.items.length === 0) return;
    const job = (async () => {
      for (let attempt = 1; attempt <= MAX_WRITE_ATTEMPTS; attempt++) {
        try {
          await write({ serverId: buf.serverId, channelId: buf.channelId, docId: buf.docId, data: toData(buf) });
          return;
        } catch (e) {
          if (attempt === MAX_WRITE_ATTEMPTS) {
            console.error("Mesajlar kaydedilemedi (toplu yazma):", e?.code || e);
            return;
          }
          await new Promise((r) => setTimeout(r, 1500 * attempt));
        }
      }
    })();
    inFlight.add(job);
    try {
      await job;
    } finally {
      inFlight.delete(job);
    }
  }

  return {
    /**
     * Mesajı kuyruğa ekler; içinde kaydedileceği toplu belgenin kimliğini döner (canlı mesajla birlikte yayınlanır ki
     * alıcılar tepki/silme için hangi belgeye bakacaklarını bilsin).
     */
    add({ serverId, channelId, message }) {
      const key = keyOf(serverId, channelId);
      let buf = buffers.get(key);
      // Yazar değiştiyse (hesap değişimi) eskiyi kapat
      if (buf && buf.userId !== message.userId) {
        flush(key);
        buf = null;
      }
      if (!buf) {
        buf = {
          serverId, channelId, docId: newId(),
          userId: message.userId, username: message.username,
          items: [], reactions: {}, timer: null,
        };
        buf.timer = setTimeout(() => flush(key), delayMs);
        buffers.set(key, buf);
      }
      const item = {};
      for (const [k, v] of Object.entries(message)) {
        if (v === undefined || k.startsWith("_") || CHUNK_LEVEL_FIELDS.includes(k)) continue;
        item[k] = v;
      }
      buf.items.push(item);
      const docId = buf.docId;
      if (buf.items.length >= maxItems) flush(key);
      return docId;
    },

    /** Henüz yazılmamış bir mesajı günceller. Bulunduysa true. */
    editPending(serverId, channelId, messageId, patch) {
      const buf = buffers.get(keyOf(serverId, channelId));
      const item = buf?.items.find((i) => i.id === messageId);
      if (!item) return false;
      Object.assign(item, patch);
      return true;
    },

    /** Henüz yazılmamış bir mesajı kuyruktan çıkarır. Bulunduysa true. */
    removePending(serverId, channelId, messageId) {
      const buf = buffers.get(keyOf(serverId, channelId));
      if (!buf) return false;
      const before = buf.items.length;
      buf.items = buf.items.filter((i) => i.id !== messageId);
      delete buf.reactions[messageId];
      return buf.items.length !== before;
    },

    /** Henüz yazılmamış bir mesajın tepkilerini ayarlar (kendi mesajıma yazılmadan tepki gelirse). Bulunduysa true. */
    setPendingReactions(serverId, channelId, messageId, reactions) {
      const buf = buffers.get(keyOf(serverId, channelId));
      if (!buf || !buf.items.some((i) => i.id === messageId)) return false;
      if (reactions && Object.keys(reactions).length > 0) buf.reactions[messageId] = reactions;
      else delete buf.reactions[messageId];
      return true;
    },

    flushChannel(serverId, channelId) {
      return flush(keyOf(serverId, channelId));
    },

    /** Bekleyen her şeyi yazar (uygulama kapanırken / çıkış yaparken). */
    async flushAll() {
      await Promise.all([...buffers.keys()].map((k) => flush(k)));
      await Promise.all([...inFlight]);
    },

    pendingCount() {
      let n = 0;
      buffers.forEach((b) => { n += b.items.length; });
      return n;
    },
  };
}

/**
 * Firestore belgelerini (eski tek-mesaj biçimi + toplu biçim) düz mesaj listesine çevirir, zamana göre sıralar.
 * Her mesaj `_doc` (içinde durduğu belge) ve `_chunk` (toplu belge mi) bilgisini taşır.
 * @param {{id: string, data: object}[]} docs
 */
export function expandMessageDocs(docs) {
  const out = [];
  for (const { id, data } of docs) {
    if (data && Array.isArray(data.items)) {
      const reactions = data.reactions || {};
      for (const item of data.items) {
        if (!item || !item.id) continue;
        const msg = { userId: data.userId, username: data.username, ...item, _doc: id, _chunk: true };
        if (reactions[item.id]) msg.reactions = reactions[item.id];
        out.push(msg);
      }
    } else if (data) {
      out.push({ id, ...data, _doc: id, _chunk: false });
    }
  }
  const ts = (m) => (typeof m.timestamp === "number" ? m.timestamp : m.timestamp?.toMillis?.() ?? 0);
  // Kararlı sıralama: aynı zamanlılar geliş sırasını korur
  return out.map((m, i) => [m, i]).sort((a, b) => ts(a[0]) - ts(b[0]) || a[1] - b[1]).map(([m]) => m);
}

/** Aynı kimlikli mesajları tekilleştirerek birleştirir (sonraki kazanır) ve zamana göre sıralar. */
export function mergeMessages(base, extra) {
  if (!extra || extra.length === 0) return base;
  const byId = new Map(base.map((m) => [m.id, m]));
  for (const m of extra) if (!byId.has(m.id)) byId.set(m.id, m);
  const ts = (m) => (typeof m.timestamp === "number" ? m.timestamp : m.timestamp?.toMillis?.() ?? 0);
  return [...byId.values()].map((m, i) => [m, i]).sort((a, b) => ts(a[0]) - ts(b[0]) || a[1] - b[1]).map(([m]) => m);
}
