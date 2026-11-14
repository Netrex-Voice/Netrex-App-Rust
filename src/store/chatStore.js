import { create } from "zustand";
import {
  collection,
  query,
  getDocs,
  doc,
  getDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  limit,
  startAfter,
  setDoc,
  updateDoc,
  FieldPath,
} from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { deleteImageFromCloudinary } from "@/src/utils/imageUpload";
import { registerCleanupTask } from "@/src/utils/cleanup";
import { useServerStore } from "@/src/store/serverStore";
import { createBatcher, expandMessageDocs, mergeMessages, FLUSH_DELAY_MS } from "@/src/store/chatBatch";
import {
  MESSAGE_MAX_LENGTH,
  MESSAGE_SPAM_THRESHOLD_MS,
  MESSAGE_SPAM_COOLDOWN_MS,
  MESSAGE_PAGE_SIZE,
  MAX_STORED_MESSAGES,
  MESSAGE_SEQUENCE_THRESHOLD,
} from "@/src/constants/appConfig";

// ── Sunucu kanalı sohbeti ────────────────────────────────────────────────
// Canlı iletim: LiveKit veri kanalı (odadakilere anında, ücretsiz).
// Kalıcı kayıt: Firestore'a TOPLU yazılır (bkz. chatBatch.js): bir yazarın ~20 sn içindeki mesajları tek belge = tek yazma.
// Firestore'da canlı dinleyici YOKTUR (okuma kotası); kanal açılınca son sayfa bir kez okunur.

let lastMessageSentAt = 0;
let spamCooldownUntil = 0; // Spam koruması aktifse bu zamana kadar mesaj gönderilemez
const messagePaginationCursors = new Map();

// randomUUID yalnızca secure context'te var; yoksa eski yönteme düş
const generateMessageId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString() + Math.random().toString(36).substr(2, 9);

const messagesCol = (serverId, channelId) =>
  collection(db, "servers", serverId, "channels", channelId, "messages");

const batcher = createBatcher({
  write: ({ serverId, channelId, docId, data }) =>
    setDoc(doc(messagesCol(serverId, channelId), docId), { ...data, createdAt: serverTimestamp() }),
});

// Uygulama kapanırken / sekme kapanırken bekleyen mesajları yaz
if (typeof window !== "undefined") {
  registerCleanupTask(() => batcher.flushAll());
  window.addEventListener("pagehide", () => { batcher.flushAll(); });
}

/** Bekleyen (henüz Firestore'a yazılmamış) mesajları hemen yazar. Çıkış yapmadan önce çağrılır. */
export const flushPendingChatMessages = () => batcher.flushAll();

// Son dakikalarda canlı gelen/giden mesajlar: kanal değiştirip geri dönünce, henüz Firestore'a yazılmamış (toplu
// yazma bekleyen) mesajlar listeden kaybolmasın diye kanal yüklenirken bunlarla birleştirilir.
const RECENT_LIVE_TTL_MS = FLUSH_DELAY_MS + 40_000;
const recentLive = new Map(); // channelId -> mesajlar
function rememberLive(channelId, message) {
  const now = Date.now();
  const list = (recentLive.get(channelId) || []).filter((m) => now - m.timestamp < RECENT_LIVE_TTL_MS && m.id !== message.id);
  list.push(message);
  recentLive.set(channelId, list);
}
function recentLiveFor(channelId) {
  const now = Date.now();
  return (recentLive.get(channelId) || []).filter((m) => now - m.timestamp < RECENT_LIVE_TTL_MS);
}
function forgetLive(channelId, messageIds) {
  const list = recentLive.get(channelId);
  if (list) recentLive.set(channelId, list.filter((m) => !messageIds.includes(m.id)));
}

// Typing göstergesi zaman aşımı: `${channelId}:${userId}` -> timeout id
const TYPING_TTL_MS = 6000;
const typingTimers = new Map();
const clearTypingTimers = (channelId) => {
  const prefix = `${channelId}:`;
  for (const [key, timer] of typingTimers) {
    if (key.startsWith(prefix)) {
      clearTimeout(timer);
      typingTimers.delete(key);
    }
  }
};

const capMessages = (messages) =>
  messages.length > MAX_STORED_MESSAGES ? messages.slice(-MAX_STORED_MESSAGES) : messages;

const numericTs = (m) => (m.timestamp?.toDate ? m.timestamp.toDate().getTime() : m.timestamp);

/**
 * Toplu belgedeki mesajları değiştirir (oku → değiştir → yaz). `mutate(items)` yeni dizi döner; boş dönerse belge silinir.
 * Belge henüz yazılmamışsa (başkasının bekleyen toplu yazması) `false` döner.
 */
async function rewriteChunk(serverId, channelId, docId, mutate) {
  const ref = doc(messagesCol(serverId, channelId), docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;
  const items = Array.isArray(snap.data().items) ? snap.data().items : [];
  const next = mutate(items);
  if (next.length === 0) await deleteDoc(ref);
  else await updateDoc(ref, { items: next });
  return true;
}

export const useChatStore = create((set, get) => ({
  currentChannel: null,
  messages: [],
  isLoading: false,
  isLoadingOlderMessages: false,
  hasMoreMessages: false,
  typingUsers: {}, // { channelId: { userId: username } }
  error: null,

  // UI State: Sohbet paneli açık/kapalı
  showChatPanel: false,
  setShowChatPanel: (show) => set({ showChatPanel: show }),
  toggleChatPanel: () => set((state) => ({ showChatPanel: !state.showChatPanel })),

  // Sohbet konumu ve genişliği
  chatPosition: "right", // "left" | "right"
  chatWidth: 340,
  setChatPosition: (pos) => set({ chatPosition: pos }),
  setChatWidth: (width) => set({ chatWidth: width }),

  // Okunmamış Mesaj Sayıları { channelId: sayi }
  unreadCounts: {},

  // Kanal mesajlarını yükle (son sayfa; canlı dinleyici yok)
  loadChannelMessages: async (channelId, serverId = null) => {
    const channel = useServerStore.getState().channels.find((ch) => ch.id === channelId);
    set({
      currentChannel: { ...(channel || {}), id: channelId, serverId },
      isLoading: true,
      error: null,
      messages: [],
      hasMoreMessages: false,
    });
    get().markAsRead(channelId);

    if (!serverId) {
      set({ error: "Kanal bir sunucuya ait değil.", isLoading: false });
      return;
    }

    try {
      const snapshot = await getDocs(
        query(messagesCol(serverId, channelId), orderBy("timestamp", "desc"), limit(MESSAGE_PAGE_SIZE))
      );
      // Bu arada başka kanala geçildiyse sonucu yazma
      if (get().currentChannel?.id !== channelId) return;

      const docs = snapshot.docs;
      const loaded = expandMessageDocs(docs.map((d) => ({ id: d.id, data: d.data() })));
      messagePaginationCursors.set(channelId, docs.length > 0 ? docs[docs.length - 1] : null);

      set({
        // Henüz Firestore'a yazılmamış canlı mesajlar + yükleme sürerken gelenler kaybolmasın
        messages: capMessages(mergeMessages(mergeMessages(loaded, recentLiveFor(channelId)), get().messages)),
        isLoading: false,
        hasMoreMessages: docs.length === MESSAGE_PAGE_SIZE,
      });
    } catch (error) {
      console.error("Error loading channel messages:", error);
      set({ error: error.message, isLoading: false });
    }
  },

  loadOlderMessages: async (channelId) => {
    const lastDoc = messagePaginationCursors.get(channelId);
    const serverId = get().currentChannel?.serverId;
    if (!lastDoc || !serverId) {
      set({ hasMoreMessages: false });
      return { success: false, error: "Daha fazla mesaj yok." };
    }

    set({ isLoadingOlderMessages: true });

    try {
      const snapshot = await getDocs(
        query(messagesCol(serverId, channelId), orderBy("timestamp", "desc"), startAfter(lastDoc), limit(MESSAGE_PAGE_SIZE))
      );
      const docs = snapshot.docs;

      if (docs.length === 0) {
        messagePaginationCursors.set(channelId, null);
        set({ hasMoreMessages: false, isLoadingOlderMessages: false });
        return { success: true };
      }

      const older = expandMessageDocs(docs.map((d) => ({ id: d.id, data: d.data() })));
      messagePaginationCursors.set(channelId, docs[docs.length - 1]);

      set((state) => ({
        messages: mergeMessages(older, state.messages),
        isLoadingOlderMessages: false,
        hasMoreMessages: docs.length === MESSAGE_PAGE_SIZE,
      }));

      return { success: true };
    } catch (error) {
      console.error("Daha eski mesajlar yüklenemedi:", error);
      set({ isLoadingOlderMessages: false });
      return { success: false, error: error.message };
    }
  },

  // Mesaj Gönder
  sendMessage: async (channelId, messageText, userId, username, room, serverId = null, extraData = {}) => {
    const cleanedText = messageText.trim();
    // Resim varsa metin boş olabilir
    if (!cleanedText && !extraData?.imageUrl)
      return { success: false, error: "Mesaj boş olamaz" };

    if (cleanedText.length > MESSAGE_MAX_LENGTH) {
      return {
        success: false,
        error: `Mesaj en fazla ${MESSAGE_MAX_LENGTH} karakter olabilir.`,
      };
    }
    if (!serverId) return { success: false, error: "Kanal bir sunucuya ait değil." };

    const now = Date.now();
    const timeSinceLastMessage = now - lastMessageSentAt;

    // Spam koruması aktifse kontrol et
    if (now < spamCooldownUntil) {
      return {
        success: false,
        error: "Çok hızlı mesaj gönderiyorsunuz. Lütfen bekleyin.",
        cooldownRemaining: Math.ceil((spamCooldownUntil - now) / 1000),
      };
    }

    // Spam tespiti: Son mesajdan itibaren çok kısa sürede yeni mesaj gönderilmeye çalışılıyorsa
    if (timeSinceLastMessage < MESSAGE_SPAM_THRESHOLD_MS) {
      spamCooldownUntil = now + MESSAGE_SPAM_COOLDOWN_MS;
      return {
        success: false,
        error: "Çok hızlı mesaj gönderiyorsunuz. Lütfen bekleyin.",
        cooldownRemaining: Math.ceil(MESSAGE_SPAM_COOLDOWN_MS / 1000),
      };
    }

    const message = {
      id: generateMessageId(),
      text: cleanedText,
      userId,
      username,
      timestamp: now,
      ...(extraData || {}),
    };

    try {
      // Kalıcı kayıt kuyruğu: mesajın yazılacağı toplu belgenin kimliği hemen bellidir
      message._doc = batcher.add({ serverId, channelId, message });
      message._chunk = true;
      lastMessageSentAt = now;
      rememberLive(channelId, message);

      set((state) => ({ messages: capMessages([...state.messages, message]) }));

      // Canlı iletim: LiveKit veri kanalı
      if (room && room.localParticipant) {
        const data = new TextEncoder().encode(JSON.stringify({ type: "chat", channelId, message }));
        await room.localParticipant.publishData(data, { topic: "chat", reliable: true });
      }

      return { success: true };
    } catch (error) {
      console.error("Error sending message:", error);
      return { success: false, error: error.message };
    }
  },

  // Gelen mesajı (LiveKit) açık kanalın listesine ekle
  addIncomingMessage: (message) => {
    set((state) => {
      if (state.messages.some((m) => m.id === message.id)) return state;
      return { messages: capMessages([...state.messages, message]) };
    });
  },

  // Canlı gelen her mesaj (açık kanal olsun olmasın) kısa süre hatırlanır: bkz. recentLive
  rememberLiveMessage: (channelId, message) => {
    if (channelId && message?.id) rememberLive(channelId, message);
  },

  // Okunmamış Sayısını Artır
  incrementUnread: (channelId) => {
    const current = get().currentChannel;
    const isPanelOpen = get().showChatPanel;

    // Eğer şu an o kanal açıksa VE panel görünüyorsa artırma
    if (current && current.id === channelId && isPanelOpen) return;

    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [channelId]: (state.unreadCounts[channelId] || 0) + 1,
      },
    }));
  },

  // Okundu İşaretle
  markAsRead: (channelId) => {
    set((state) => {
      if (!(channelId in state.unreadCounts)) return state;
      const newCounts = { ...state.unreadCounts };
      delete newCounts[channelId];
      return { unreadCounts: newCounts };
    });
  },

  /** Verilen mesajları (aynı kanalda) hem listeden hem Firestore'dan siler. */
  _deleteMessages: async (channelId, targets) => {
    const serverId = get().currentChannel?.serverId;
    const ids = targets.map((m) => m.id);
    set((state) => ({ messages: state.messages.filter((m) => !ids.includes(m.id)) }));
    forgetLive(channelId, ids);
    if (!serverId) return;

    targets.forEach((m) => {
      if (m.imageUrl) deleteImageFromCloudinary(m.imageUrl).catch(() => {});
    });

    // Toplu belgeler: belge başına tek yazma. Eski tek-mesaj belgeleri: doğrudan silinir.
    const byChunk = new Map();
    const tasks = [];
    for (const m of targets) {
      if (batcher.removePending(serverId, channelId, m.id)) continue; // henüz yazılmamıştı
      if (m._chunk && m._doc) {
        byChunk.set(m._doc, [...(byChunk.get(m._doc) || []), m.id]);
      } else {
        tasks.push(deleteDoc(doc(messagesCol(serverId, channelId), m._doc || m.id)));
      }
    }
    byChunk.forEach((messageIds, docId) => {
      tasks.push(rewriteChunk(serverId, channelId, docId, (items) => items.filter((i) => !messageIds.includes(i.id))));
    });
    await Promise.all(tasks);
  },

  deleteMessage: async (channelId, messageId) => {
    try {
      const target = get().messages.find((m) => m.id === messageId);
      if (!target) return { success: false, error: "Mesaj bulunamadı." };
      await get()._deleteMessages(channelId, [target]);
      return { success: true };
    } catch (error) {
      console.error("Mesaj silinemedi:", error);
      return { success: false, error: error.message };
    }
  },

  editMessage: async (channelId, messageId, newText, userId) => {
    const cleanedText = newText.trim();
    if (!cleanedText) return { success: false, error: "Mesaj boş olamaz" };
    if (cleanedText.length > MESSAGE_MAX_LENGTH) {
      return { success: false, error: `Mesaj en fazla ${MESSAGE_MAX_LENGTH} karakter olabilir.` };
    }

    try {
      const currentMessages = get().messages;
      const messageIndex = currentMessages.findIndex((m) => m.id === messageId);
      if (messageIndex === -1) return { success: false, error: "Mesaj bulunamadı." };

      const targetMessage = currentMessages[messageIndex];

      // Sadece kendi mesajını düzenleyebilir (kurallar da bunu zorlar)
      if (targetMessage.userId !== userId) {
        return { success: false, error: "Sadece kendi mesajınızı düzenleyebilirsiniz." };
      }

      // Zaman kısıtlaması: 5 dakika
      if (Date.now() - numericTs(targetMessage) > MESSAGE_SEQUENCE_THRESHOLD) {
        return { success: false, error: "Mesajı düzenleme süresi doldu (5 dakika)." };
      }

      const patch = { text: cleanedText, edited: true, editedAt: Date.now() };
      const updatedMessages = [...currentMessages];
      updatedMessages[messageIndex] = { ...targetMessage, ...patch };
      set({ messages: updatedMessages });

      const serverId = get().currentChannel?.serverId;
      if (!serverId) return { success: true };

      if (batcher.editPending(serverId, channelId, messageId, patch)) return { success: true }; // henüz yazılmamıştı
      if (targetMessage._chunk && targetMessage._doc) {
        await rewriteChunk(serverId, channelId, targetMessage._doc, (items) =>
          items.map((i) => (i.id === messageId ? { ...i, ...patch } : i)));
      } else {
        await updateDoc(doc(messagesCol(serverId, channelId), targetMessage._doc || messageId), {
          text: cleanedText,
          edited: true,
          editedAt: serverTimestamp(),
        });
      }

      return { success: true };
    } catch (error) {
      console.error("Mesaj düzenlenemedi:", error);
      return { success: false, error: error.message };
    }
  },

  // Sequence mesajlarını toplu silme: aynı kullanıcının ardışık (5 dk içindeki) mesajları
  deleteMessageSequence: async (channelId, messageId) => {
    try {
      const currentMessages = get().messages;
      const startIndex = currentMessages.findIndex((m) => m.id === messageId);
      if (startIndex === -1) return { success: false, error: "Mesaj bulunamadı." };
      const targetMessage = currentMessages[startIndex];
      const inSequence = (msg) =>
        msg.userId === targetMessage.userId &&
        Math.abs(numericTs(msg) - numericTs(targetMessage)) < MESSAGE_SEQUENCE_THRESHOLD;

      const sequenceMessages = [];
      for (let i = startIndex; i >= 0 && inSequence(currentMessages[i]); i--) sequenceMessages.unshift(currentMessages[i]);
      for (let i = startIndex + 1; i < currentMessages.length && inSequence(currentMessages[i]); i++) {
        sequenceMessages.push(currentMessages[i]);
      }
      if (sequenceMessages.length === 0) return { success: false, error: "Sequence bulunamadı." };

      await get()._deleteMessages(channelId, sequenceMessages);
      return { success: true, deletedCount: sequenceMessages.length };
    } catch (error) {
      console.error("Sequence mesajları silinemedi:", error);
      return { success: false, error: error.message };
    }
  },

  toggleReaction: async (channelId, messageId, emoji, userId) => {
    try {
      const currentMessages = get().messages;
      const messageIndex = currentMessages.findIndex((m) => m.id === messageId);
      if (messageIndex === -1) return { success: false, error: "Mesaj bulunamadı." };

      const targetMessage = currentMessages[messageIndex];
      const reactions = { ...(targetMessage.reactions || {}) };
      const users = [...(reactions[emoji] || [])];
      const userIndex = users.indexOf(userId);
      if (userIndex === -1) users.push(userId);
      else users.splice(userIndex, 1);
      if (users.length > 0) reactions[emoji] = users;
      else delete reactions[emoji];

      const updatedMessages = [...currentMessages];
      updatedMessages[messageIndex] = { ...targetMessage, reactions };
      set({ messages: updatedMessages });

      const serverId = get().currentChannel?.serverId;
      if (!serverId) return { success: true };

      // Kendi mesajım henüz yazılmadıysa tepki, toplu belgeyle birlikte yazılır
      if (batcher.setPendingReactions(serverId, channelId, messageId, reactions)) return { success: true };

      const ref = doc(messagesCol(serverId, channelId), targetMessage._doc || messageId);
      const write = () =>
        targetMessage._chunk
          ? updateDoc(ref, new FieldPath("reactions", messageId), reactions)
          : updateDoc(ref, { reactions });
      try {
        await write();
      } catch (error) {
        if (error?.code !== "not-found") throw error;
        // Mesaj başkasının henüz yazılmamış toplu belgesinde: yazıldıktan sonra bir kez daha dene
        setTimeout(() => write().catch(() => {}), FLUSH_DELAY_MS + 5000);
      }

      return { success: true };
    } catch (error) {
      console.error("Reaksiyon hatası:", error);
      return { success: false, error: error.message };
    }
  },

  clearCurrentChannel: () => {
    const channelId = get().currentChannel?.id;
    if (channelId) {
      messagePaginationCursors.delete(channelId);
      clearTypingTimers(channelId);
    }
    set({
      currentChannel: null,
      messages: [],
      hasMoreMessages: false,
    });
  },

  // --- TYPING INDICATORS (LiveKit Data Channel - Zero Cost) ---
  setTypingStatus: (channelId, userId, username, isTyping) => {
    const timerKey = `${channelId}:${userId}`;
    clearTimeout(typingTimers.get(timerKey));

    if (isTyping) {
      // "Durdu" paketi (reliable:false) kaybolursa gösterge takılı kalmasın
      typingTimers.set(
        timerKey,
        setTimeout(() => get().setTypingStatus(channelId, userId, username, false), TYPING_TTL_MS)
      );
    } else {
      typingTimers.delete(timerKey);
    }

    set((state) => {
      const channelTyping = { ...(state.typingUsers[channelId] || {}) };
      if (isTyping) {
        channelTyping[userId] = username;
      } else {
        delete channelTyping[userId];
      }

      const newTypingUsers = { ...state.typingUsers };
      if (Object.keys(channelTyping).length > 0) {
        newTypingUsers[channelId] = channelTyping;
      } else {
        delete newTypingUsers[channelId];
      }

      return { typingUsers: newTypingUsers };
    });
  },

  sendTypingStatus: async (channelId, userId, username, isTyping, room) => {
    if (!room || !room.localParticipant) return;

    try {
      const data = new TextEncoder().encode(
        JSON.stringify({ type: "typing", channelId, userId, username, isTyping })
      );
      await room.localParticipant.publishData(data, {
        topic: "typing",
        reliable: false, // Typing is low priority
      });
    } catch (error) {
      // Silent error for typing
    }
  },
}));
