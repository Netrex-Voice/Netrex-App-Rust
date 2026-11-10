import { create } from "zustand";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  onSnapshot,
  limit,
  startAfter,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { deleteImageFromCloudinary } from "@/src/utils/imageUpload";
import {
  MAX_TEXT_CHANNELS_PER_USER,
  MESSAGE_MAX_LENGTH,
  MESSAGE_COOLDOWN_MS,
  MESSAGE_SPAM_THRESHOLD_MS,
  MESSAGE_SPAM_COOLDOWN_MS,
  CHANNEL_CREATION_COOLDOWN_MS,
  MESSAGE_PAGE_SIZE,
  MAX_STORED_MESSAGES,
  MESSAGE_SEQUENCE_THRESHOLD,
} from "@/src/constants/appConfig";

let textChannelsUnsubscribe = null;
let lastMessageSentAt = 0;
let spamCooldownUntil = 0; // Spam koruması aktifse bu zamana kadar mesaj gönderilemez
let lastChannelCreationAt = 0;
const messagePaginationCursors = new Map();

// randomUUID yalnızca secure context'te var; yoksa eski yönteme düş
const generateMessageId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString() + Math.random().toString(36).substr(2, 9);

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

export const useChatStore = create((set, get) => ({
  textChannels: [],
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

  // YENİ: Sohbet konumu ve genişliği
  chatPosition: "right", // "left" | "right"
  chatWidth: 340,
  setChatPosition: (pos) => set({ chatPosition: pos }),
  setChatWidth: (width) => set({ chatWidth: width }),

  // YENİ: Okunmamış Mesaj Sayıları { channelId: sayi }
  unreadCounts: {},

  startTextChannelListener: () => {
    if (textChannelsUnsubscribe) {
      textChannelsUnsubscribe();
    }

    const channelsQuery = query(
      collection(db, "text_channels"),
      orderBy("createdAt", "desc")
    );

    textChannelsUnsubscribe = onSnapshot(
      channelsQuery,
      (snapshot) => {
        const channels = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        set({ textChannels: channels, isLoading: false, error: null });
      },
      (error) => {
        console.error("Text channel listener error:", error);
        set({ error: error.message, isLoading: false });
      }
    );

    return () => {
      if (textChannelsUnsubscribe) {
        textChannelsUnsubscribe();
        textChannelsUnsubscribe = null;
      }
    };
  },

  stopTextChannelListener: () => {
    if (textChannelsUnsubscribe) {
      textChannelsUnsubscribe();
      textChannelsUnsubscribe = null;
    }
  },

  // Yeni kanal oluştur
  createTextChannel: async (name, userId) => {
    if (!userId) {
      return { success: false, error: "Kullanıcı doğrulanamadı." };
    }

    const normalizedName = name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-_]/g, "");

    if (normalizedName.length < 3 || normalizedName.length > 30) {
      return {
        success: false,
        error: "Kanal adı 3-30 karakter arasında olmalıdır.",
      };
    }

    if (Date.now() - lastChannelCreationAt < CHANNEL_CREATION_COOLDOWN_MS) {
      return {
        success: false,
        error: "Lütfen yeni bir kanal oluşturmadan önce birkaç saniye bekleyin.",
      };
    }

    set({ isLoading: true, error: null });
    try {
      const q = query(
        collection(db, "text_channels"),
        where("createdBy", "==", userId)
      );
      const snapshot = await getDocs(q);

      if (snapshot.size >= MAX_TEXT_CHANNELS_PER_USER) {
        set({
          error: "Maksimum 3 metin kanalı oluşturabilirsiniz.",
          isLoading: false,
        });
        return {
          success: false,
          error: "Maksimum 3 metin kanalı oluşturabilirsiniz.",
        };
      }

      const newChannel = {
        name: normalizedName,
        createdBy: userId,
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, "text_channels"), newChannel);

      set({ isLoading: false });
      lastChannelCreationAt = Date.now();
      return { success: true, channelId: docRef.id };
    } catch (error) {
      console.error("Error creating text channel:", error);
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  // Kanal silme
  deleteTextChannel: async (channelId) => {
    set({ isLoading: true, error: null });
    try {
      const channelRef = doc(db, "text_channels", channelId);
      console.log("🗑️ Text channel Firebase'den siliniyor:", channelId);
      await deleteDoc(channelRef);
      console.log("✅ Text channel Firebase'den silindi:", channelId);

      const updatedChannels = get().textChannels.filter(
        (c) => c.id !== channelId
      );

      const currentCh = get().currentChannel;
      if (currentCh && currentCh.id === channelId) {
        set({ currentChannel: null, messages: [] });
      }

      set({ textChannels: updatedChannels, isLoading: false });
      return { success: true };
    } catch (error) {
      console.error("❌ Text channel silme hatası:", error);
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  // Kanal mesajlarını yükle
  loadChannelMessages: async (channelId, serverId = null) => {
    // Hemen currentChannel'ı güncelle
    const channel = get().textChannels.find(ch => ch.id === channelId);
    set({
      currentChannel: channel ? { id: channelId, serverId, ...channel } : { id: channelId, serverId },
      isLoading: true,
      error: null,
      messages: [],
      hasMoreMessages: false,
    });

    // YENİ: Kanalı açtığımız için okunmamış sayısını sıfırla
    get().markAsRead(channelId);

    try {
      const collectionPath = serverId 
        ? collection(db, "servers", serverId, "channels", channelId, "messages")
        : collection(db, "text_channels", channelId, "messages");
      
      const channelPath = serverId
        ? doc(db, "servers", serverId, "channels", channelId)
        : doc(db, "text_channels", channelId);

      const channelDoc = await getDoc(channelPath);
      // Global kanallar için kontrol, server kanalları için serverStore zaten yüklüyor
      if (!serverId && !channelDoc.exists()) {
        set({
          error: "Kanal bulunamadı",
          isLoading: false,
          currentChannel: null,
        });
        const updatedChannels = get().textChannels.filter(
          (c) => c.id !== channelId
        );
        set({ textChannels: updatedChannels });
        return;
      }

      const channelData = channelDoc.exists() ? channelDoc.data() : {};
      const messagesQuery = query(
        collectionPath,
        orderBy("timestamp", "desc"),
        limit(MESSAGE_PAGE_SIZE)
      );

      const snapshot = await getDocs(messagesQuery);
      const docs = snapshot.docs;
      const messages = docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .reverse();

      const hasMore = docs.length === MESSAGE_PAGE_SIZE;
      messagePaginationCursors.set(
        channelId,
        docs.length > 0 ? docs[docs.length - 1] : null
      );

      set({
        messages,
        currentChannel: { id: channelId, serverId, ...channelData },
        isLoading: false,
        hasMoreMessages: hasMore,
      });
    } catch (error) {
      console.error("Error loading channel messages:", error);
      set({ error: error.message, isLoading: false });
    }
  },

  loadOlderMessages: async (channelId) => {
    const lastDoc = messagePaginationCursors.get(channelId);
    if (!lastDoc) {
      set({ hasMoreMessages: false });
      return { success: false, error: "Daha fazla mesaj yok." };
    }

    const currentChannel = get().currentChannel;
    const serverId = currentChannel?.serverId;

    set({ isLoadingOlderMessages: true });
    try {
      const collectionPath = serverId
        ? collection(db, "servers", serverId, "channels", channelId, "messages")
        : collection(db, "text_channels", channelId, "messages");

      const olderMessagesQuery = query(
        collectionPath,
        orderBy("timestamp", "desc"),
        startAfter(lastDoc),
        limit(MESSAGE_PAGE_SIZE)
      );

      const snapshot = await getDocs(olderMessagesQuery);
      const docs = snapshot.docs;

      if (docs.length === 0) {
        messagePaginationCursors.set(channelId, null);
        set({ hasMoreMessages: false, isLoadingOlderMessages: false });
        return { success: true };
      }

      const olderMessages = docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .reverse();

      messagePaginationCursors.set(
        channelId,
        docs.length > 0 ? docs[docs.length - 1] : null
      );

      set((state) => ({
        messages: [...olderMessages, ...state.messages],
        hasMoreMessages: docs.length === MESSAGE_PAGE_SIZE,
        isLoadingOlderMessages: false,
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

    const now = Date.now();
    const timeSinceLastMessage = now - lastMessageSentAt;
    
    // Spam koruması aktifse kontrol et
    if (now < spamCooldownUntil) {
      const remainingTime = Math.ceil((spamCooldownUntil - now) / 1000);
      return {
        success: false,
        error: "Çok hızlı mesaj gönderiyorsunuz. Lütfen bekleyin.",
        cooldownRemaining: remainingTime,
      };
    }
    
    // Spam tespiti: Son mesajdan itibaren çok kısa sürede yeni mesaj gönderilmeye çalışılıyorsa
    if (timeSinceLastMessage < MESSAGE_SPAM_THRESHOLD_MS) {
      // Spam korumasını aktif et
      spamCooldownUntil = now + MESSAGE_SPAM_COOLDOWN_MS;
      const remainingTime = Math.ceil(MESSAGE_SPAM_COOLDOWN_MS / 1000);
      return {
        success: false,
        error: "Çok hızlı mesaj gönderiyorsunuz. Lütfen bekleyin.",
        cooldownRemaining: remainingTime,
      };
    }

    const message = {
      id: generateMessageId(),
      text: cleanedText,
      userId,
      username,
      timestamp: Date.now(),
      ...(extraData || {})
    };

    try {
      // LiveKit Data Channel ile gönder
      if (room && room.localParticipant) {
        const encoder = new TextEncoder();
        const data = encoder.encode(
          JSON.stringify({
            type: "chat",
            channelId,
            message,
          })
        );

        await room.localParticipant.publishData(data, {
          topic: "chat",
          reliable: true,
        });
      }

      set((state) => {
        const newMessages = [...state.messages, message];
        if (newMessages.length > MAX_STORED_MESSAGES) {
           return { messages: newMessages.slice(-MAX_STORED_MESSAGES) };
        }
        return { messages: newMessages };
      });

      const messageRef = doc(
        serverId 
          ? collection(db, "servers", serverId, "channels", channelId, "messages")
          : collection(db, "text_channels", channelId, "messages"),
        message.id
      );

      const finalMessage = {
        ...message,
        createdAt: serverTimestamp(),
      };

      // Filter out undefined values to prevent Firestore errors
      const cleanMessage = Object.fromEntries(
        Object.entries(finalMessage).filter(([_, v]) => v !== undefined)
      );

      await setDoc(messageRef, cleanMessage);

      lastMessageSentAt = Date.now();

      return { success: true };
    } catch (error) {
      console.error("Error sending message:", error);
      return { success: false, error: error.message };
    }
  },

  // Gelen Mesajı Ekle
  addIncomingMessage: (message) => {
    set((state) => {
      const exists = state.messages.some((m) => m.id === message.id);
      if (exists) return state;
      const newMessages = [...state.messages, message];
      if (newMessages.length > MAX_STORED_MESSAGES) {
         return { messages: newMessages.slice(-MAX_STORED_MESSAGES) };
      }
      return { messages: newMessages };
    });
  },

  // YENİ: Okunmamış Sayısını Artır
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

  // YENİ: Okundu İşaretle
  markAsRead: (channelId) => {
    set((state) => {
      const newCounts = { ...state.unreadCounts };
      delete newCounts[channelId];
      return { unreadCounts: newCounts };
    });
  },

  deleteMessage: async (channelId, messageId) => {
    try {
      const currentChannel = get().currentChannel;
      const serverId = currentChannel?.serverId;
      const currentMessages = get().messages;
      
      const targetMessage = currentMessages.find((m) => m.id === messageId);
      if (targetMessage?.imageUrl) {
        deleteImageFromCloudinary(targetMessage.imageUrl).catch(err => 
            console.error("Resim silinirken hata:", err)
        );
      }

      const updatedMessages = currentMessages.filter((m) => m.id !== messageId);
      set({ messages: updatedMessages });

      const collectionPath = serverId
        ? collection(db, "servers", serverId, "channels", channelId, "messages")
        : collection(db, "text_channels", channelId, "messages");

      const messageRef = doc(collectionPath, messageId);
      await deleteDoc(messageRef);

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
      
      // Güvenlik: Sadece kendi mesajını düzenleyebilir
      if (targetMessage.userId !== userId) {
        return { success: false, error: "Sadece kendi mesajınızı düzenleyebilirsiniz." };
      }

      // Zaman kısıtlaması: 5 dakika
      const msgTs = targetMessage.timestamp?.toDate ? targetMessage.timestamp.toDate().getTime() : targetMessage.timestamp;
      if (Date.now() - msgTs > MESSAGE_SEQUENCE_THRESHOLD) {
        return { success: false, error: "Mesajı düzenleme süresi doldu (5 dakika)." };
      }

      // Local update
      const updatedMessages = [...currentMessages];
      updatedMessages[messageIndex] = {
        ...targetMessage,
        text: cleanedText,
        edited: true,
        editedAt: Date.now()
      };
      set({ messages: updatedMessages });

      // Firestore update
      const currentChannel = get().currentChannel;
      const serverId = currentChannel?.serverId;
      const collectionPath = serverId
        ? collection(db, "servers", serverId, "channels", channelId, "messages")
        : collection(db, "text_channels", channelId, "messages");

      const messageRef = doc(collectionPath, messageId);
      await updateDoc(messageRef, {
        text: cleanedText,
        edited: true,
        editedAt: serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      console.error("Mesaj düzenlenemedi:", error);
      return { success: false, error: error.message };
    }
  },

  // Sequence mesajlarını toplu silme
  deleteMessageSequence: async (channelId, messageId) => {
    try {
      const currentMessages = get().messages;
      const targetMessage = currentMessages.find((m) => m.id === messageId);
      if (!targetMessage) {
        return { success: false, error: "Mesaj bulunamadı." };
      }

      // Sequence'ı bul: Aynı kullanıcının ardışık mesajları
      const sequenceMessages = [];
      let startIndex = -1;

      // Mesajın index'ini bul
      for (let i = 0; i < currentMessages.length; i++) {
        if (currentMessages[i].id === messageId) {
          startIndex = i;
          break;
        }
      }

      if (startIndex === -1) {
        return { success: false, error: "Mesaj bulunamadı." };
      }

      // Geriye doğru sequence'ı bul
      for (let i = startIndex; i >= 0; i--) {
        const msg = currentMessages[i];
        if (msg.userId === targetMessage.userId) {
          const timeDiff = Math.abs(targetMessage.timestamp - msg.timestamp);
          if (timeDiff < MESSAGE_SEQUENCE_THRESHOLD) {
            sequenceMessages.unshift(msg);
          } else {
            break;
          }
        } else {
          break;
        }
      }

      // İleriye doğru sequence'ı bul
      for (let i = startIndex + 1; i < currentMessages.length; i++) {
        const msg = currentMessages[i];
        if (msg.userId === targetMessage.userId) {
          const timeDiff = Math.abs(msg.timestamp - targetMessage.timestamp);
          if (timeDiff < MESSAGE_SEQUENCE_THRESHOLD) {
            sequenceMessages.push(msg);
          } else {
            break;
          }
        } else {
          break;
        }
      }

      if (sequenceMessages.length === 0) {
        return { success: false, error: "Sequence bulunamadı." };
      }

      // Local state'ten sil
      const sequenceIds = sequenceMessages.map((m) => m.id);
      const updatedMessages = currentMessages.filter(
        (m) => !sequenceIds.includes(m.id)
      );
      set({ messages: updatedMessages });

      // Firestore'dan sil
      const currentChannel = get().currentChannel;
      const serverId = currentChannel?.serverId;
      const collectionPath = serverId
        ? collection(db, "servers", serverId, "channels", channelId, "messages")
        : collection(db, "text_channels", channelId, "messages");

      const deletePromises = sequenceMessages.map((msg) => {
        const messageRef = doc(collectionPath, msg.id);
        return deleteDoc(messageRef);
      });

      await Promise.all(deletePromises);

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
      
      if (!reactions[emoji]) reactions[emoji] = [];
      
      const userIndex = reactions[emoji].indexOf(userId);
      if (userIndex === -1) {
        reactions[emoji].push(userId);
      } else {
        reactions[emoji].splice(userIndex, 1);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      }

      const updatedMessages = [...currentMessages];
      updatedMessages[messageIndex] = { ...targetMessage, reactions };
      set({ messages: updatedMessages });

      const currentChannel = get().currentChannel;
      const serverId = currentChannel?.serverId;
      const collectionPath = serverId
        ? collection(db, "servers", serverId, "channels", channelId, "messages")
        : collection(db, "text_channels", channelId, "messages");

      const messageRef = doc(collectionPath, messageId);
      await updateDoc(messageRef, { reactions });

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
      const encoder = new TextEncoder();
      const data = encoder.encode(
        JSON.stringify({
          type: "typing",
          channelId,
          userId,
          username,
          isTyping,
        })
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
