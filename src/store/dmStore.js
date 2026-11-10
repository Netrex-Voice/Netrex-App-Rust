import { create } from "zustand";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  orderBy,
  limit,
  startAfter,
  writeBatch,
  increment,
  runTransaction,
} from "firebase/firestore";
import { db, auth } from "@/src/lib/firebase";
import { toast } from "@/src/utils/toast";
import { MESSAGE_SEQUENCE_THRESHOLD } from "@/src/constants/appConfig";
import { useFriendStore } from "./friendStore";

const DM_MESSAGE_PAGE_SIZE = 50;
const DM_MESSAGE_MAX_LENGTH = 2000;

let conversationsUnsubscribe = null;
let activeMessageListener = null;
const userPresenceListeners = new Map(); // otherId -> unsubscribe function
const dmPaginationCursors = new Map();

// Sohbet listesi her güncellendiğinde (her mesajda, her "okundu" yazımında) tüm karşı tarafların
// kullanıcı belgelerini yeniden okumak yerine bellekte tutulur. Canlı güncellemeler zaten `users` içinde.
const partnerDocCache = new Map(); // uid -> kullanıcı verisi
let conversationSnapshotSeq = 0;

const unknownUser = (uid) => ({ uid, displayName: "Bilinmeyen" });

// Açılışta her DM partneri için ayrı kullanıcı dinleyicisi başlar ve her biri `users`'a kendi set()'ini yapardı
// (50 sohbette ilk saniyede 50 art arda güncelleme). Aynı kare içindekileri tek set()'e birleştiriyoruz.
let pendingUsers = null;
let usersFlushScheduled = false;
function queueUserUpdate(set, userId, data) {
  pendingUsers = { ...(pendingUsers || {}), [userId]: data };
  if (usersFlushScheduled) return;
  usersFlushScheduled = true;
  const schedule = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (fn) => setTimeout(fn, 16);
  schedule(() => {
    usersFlushScheduled = false;
    const patch = pendingUsers;
    pendingUsers = null; // reset() sırasında temizlenmişse patch null gelir
    if (patch) set((state) => ({ users: { ...state.users, ...patch } }));
  });
}

async function loadPartner(uid) {
  const live = useDMStore.getState().users[uid];
  if (live) return live;
  if (partnerDocCache.has(uid)) return partnerDocCache.get(uid);
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return unknownUser(uid); // yok olanı önbelleğe alma, sonra tekrar denensin
    const data = { uid: snap.id, ...snap.data() };
    partnerDocCache.set(uid, data);
    return data;
  } catch {
    return unknownUser(uid);
  }
}

const previewOf = (text, isImage) =>
  isImage ? "📷 Fotoğraf" : text && text.length > 100 ? `${text.slice(0, 100)}...` : text || "";

export const useDMStore = create((set, get) => ({
  conversations: [],       // List of DM conversations
  activeConversation: null, // Currently selected conversation
  messages: [],             // Messages of active conversation
  isLoading: false,
  isLoadingOlder: false,
  hasMoreMessages: false,
  unreadDMCounts: {},       // { conversationId: count }
  users: {},                // { userId: userData } - Real-time user data for presence
  typingUsers: {},          // { conversationId: { userId: username } }
  isLoadingOlderMessages: false, // Alias for consistency with ChatView if needed

  // ── LISTENERS ─────────────────────────────────────────────

  /**
   * Listen to all DM conversations for current user
   */
  startConversationListener: (userId) => {
    if (!userId) return;
    if (conversationsUnsubscribe) conversationsUnsubscribe();

    // Listen to conversations where user is a participant
    const q = query(
      collection(db, "dm_conversations"),
      where("participantIds", "array-contains", userId)
    );

    conversationsUnsubscribe = onSnapshot(q, async (snapshot) => {
      // Her anlık görüntü yavaş (async) işlenir; sonradan gelen daha yeniyse eskisinin sonucu atılır
      const mySeq = ++conversationSnapshotSeq;

      const convos = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data({ serverTimestamps: 'estimate' }),
      }));

      // Sort in memory by lastMessageAt desc
      convos.sort((a, b) => {
        const timeA = a.lastMessageAt?.toMillis?.() || a.lastMessageAt || 0;
        const timeB = b.lastMessageAt?.toMillis?.() || b.lastMessageAt || 0;
        return timeB - timeA;
      });

      // Okunmamış sayıları. Şu an GÖRÜNTÜLENEN sohbet okunmamış sayılmaz (yoksa açıkken bile rozet ve
      // bildirim sesi çıkıyordu); onun sayacı hemen sıfırlanır.
      const activeId = get().activeConversation?.id;
      const unreadMap = {};
      let activeNeedsRead = false;
      convos.forEach((c) => {
        const n = c.unreadCounts?.[userId] || 0;
        if (!n) return;
        if (c.id === activeId) activeNeedsRead = true;
        else unreadMap[c.id] = n;
      });

      // Karşı tarafın verisi: yalnızca bellekte olmayanlar okunur
      const otherIds = [...new Set(convos.map(c => c.participantIds?.find(id => id !== userId)).filter(Boolean))];
      otherIds.forEach((id) => get().startUserPresenceListener(id));
      const partners = {};
      await Promise.all(otherIds.map(async (id) => { partners[id] = await loadPartner(id); }));

      if (mySeq !== conversationSnapshotSeq) return;

      const convosWithData = convos.map((convo) => {
        const otherId = convo.participantIds?.find(id => id !== userId);
        if (!otherId) return convo;
        return { ...convo, otherId, otherUser: get().users[otherId] || partners[otherId] || unknownUser(otherId) };
      });

      // ✅ OKUNMAMIŞ SAYILARI VE KONUŞMALARI AYNI ANDA GÜNCELLE (BİLDİRİM SENKRONİZASYONU İÇİN KRİTİK)
      set({
        unreadDMCounts: unreadMap,
        conversations: convosWithData,
      });

      if (activeNeedsRead && activeId) get().markDMAsRead(activeId, userId);
    }, (error) => {
      console.error("DM conversations listener error:", error);
    });
  },

  /**
   * Listen to a specific user's data (presence, displayName, etc.) in real-time
   */
  startUserPresenceListener: (userId) => {
    if (!userId || userPresenceListeners.has(userId)) return;

    const unsub = onSnapshot(doc(db, "users", userId), (docSnap) => {
      if (docSnap.exists()) {
        const data = { uid: docSnap.id, ...docSnap.data() };
        partnerDocCache.set(userId, data);
        queueUserUpdate(set, userId, data);
      }
    }, (error) => {
      console.error("User presence listener error:", error);
      userPresenceListeners.delete(userId); // hata sonrası yeniden denenebilsin
    });

    userPresenceListeners.set(userId, unsub);
  },

  /**
   * Start real-time message listener for a conversation
   */
  startMessageListener: (conversationId) => {
    if (!conversationId) return;
    if (activeMessageListener) activeMessageListener();

    const messagesQ = query(
      collection(db, "dm_conversations", conversationId, "messages"),
      orderBy("timestamp", "desc"),
      orderBy("__name__", "desc"),
      limit(DM_MESSAGE_PAGE_SIZE)
    );

    activeMessageListener = onSnapshot(messagesQ, (snapshot) => {
      // Henüz sunucuya yazılmamış (bekleyen) mesajlarda timestamp null gelir; tahmini değerle doldur
      const live = snapshot.docs
        .map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }))
        .reverse();

      // Kullanıcının yukarı kaydırıp yüklediği ESKİ mesajları koru. Eskiden her yeni mesajda liste yalnızca
      // son 50 mesajla değiştiriliyor, yüklenen geçmiş siliniyor ve kaydırma zıplıyordu.
      const prev = get().messages;
      let older = [];
      if (prev.length > 0 && live.length > 0) {
        const liveIds = new Set(live.map(m => m.id));
        const firstShared = prev.findIndex(m => liveIds.has(m.id));
        if (firstShared > 0) older = prev.slice(0, firstShared);
      }

      if (older.length === 0) {
        // Geçmiş yüklenmemiş: sayfalama imlecini ve "daha fazla var mı" durumunu bu pencereden kur
        dmPaginationCursors.set(
          conversationId,
          snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null
        );
        set({
          messages: live,
          hasMoreMessages: snapshot.docs.length === DM_MESSAGE_PAGE_SIZE,
          isLoading: false,
        });
      } else {
        // Geçmiş yüklenmiş: imleç ve hasMore olduğu gibi kalır
        set({ messages: [...older, ...live], isLoading: false });
      }
    }, (error) => {
      console.error("DM messages listener error:", error);
      set({ isLoading: false });
    });
  },

  setTypingStatus: (conversationId, userId, username, isTyping) => {
    set((state) => {
      const typing = { ...state.typingUsers };
      typing[conversationId] = { ...(typing[conversationId] || {}) };

      if (isTyping) {
        typing[conversationId][userId] = username;
      } else {
        delete typing[conversationId][userId];
      }

      return { typingUsers: typing };
    });
  },

  sendTypingStatus: (conversationId, userId, username, isTyping, room) => {
    // DM'de "yazıyor..." göstergesi henüz uygulanmadı (Firestore üzerinden gitmesi çok pahalı olurdu;
    // Realtime Database ya da çağrı sırasında LiveKit üzerinden eklenebilir).
  },

  stopMessageListener: () => {
    if (activeMessageListener) {
      activeMessageListener();
      activeMessageListener = null;
    }
  },

  stopListeners: () => {
    if (conversationsUnsubscribe) {
      conversationsUnsubscribe();
      conversationsUnsubscribe = null;
    }
    if (activeMessageListener) {
      activeMessageListener();
      activeMessageListener = null;
    }
    // Stop all user presence listeners
    userPresenceListeners.forEach(unsub => unsub());
    userPresenceListeners.clear();
    set({ users: {} });
  },

  // ── ACTIONS ─────────────────────────────────────────────

  /**
   * Open or create a DM conversation with another user.
   * `activate: false` → yalnızca sohbetin kimliğini döndürür, açık sohbeti/mesaj dinleyicisini değiştirmez
   * (arama başlatma, davet gönderme gibi arka plan işlemleri için).
   */
  openOrCreateConversation: async (currentUserId, targetUserId, { activate = true } = {}) => {
    if (!currentUserId || !targetUserId) return null;

    if (activate) set({ isLoading: true });

    try {
      // 1) Önce bellekteki listeye bak (ağ gerektirmez), yoksa sunucudan sorgula
      let existingConvo = null;
      const local = get().conversations.find(c => c.participantIds?.includes(targetUserId));
      if (local) {
        existingConvo = { id: local.id, participantIds: local.participantIds };
      } else {
        const snapshot = await getDocs(query(
          collection(db, "dm_conversations"),
          where("participantIds", "array-contains", currentUserId)
        ));
        snapshot.docs.forEach(d => {
          const data = d.data();
          if (data.participantIds.includes(targetUserId)) existingConvo = { id: d.id, ...data };
        });
      }

      let conversationId = existingConvo?.id;
      let baseConvo = existingConvo;

      // 2) Yoksa oluştur. Kimlik iki kullanıcıdan türetilir (sabit): iki taraf aynı anda ya da arka arkaya
      //    açsa bile TEK sohbet oluşur (eskiden her seferinde rastgele kimlikle çift sohbet açılabiliyordu).
      if (!conversationId) {
        const [a, b] = [currentUserId, targetUserId].sort();
        conversationId = `dm_${a}_${b}`;
        baseConvo = {
          id: conversationId,
          participantIds: [a, b],
        };
        // merge: sohbet bu arada karşı taraftan açıldıysa mevcut son mesaj/okunmamış bilgisi ezilmez
        await setDoc(
          doc(db, "dm_conversations", conversationId),
          { participantIds: [a, b], createdAt: serverTimestamp(), lastMessageAt: serverTimestamp() },
          { merge: true }
        );
      }

      if (!activate) return conversationId;

      const otherUser = await loadPartner(targetUserId);
      get().stopMessageListener();
      set({
        activeConversation: { ...baseConvo, otherUser },
        messages: [],              // önceki sohbetin mesajları bir an görünmesin
        hasMoreMessages: false,
        isLoading: true,
      });
      get().startMessageListener(conversationId);
      get().markDMAsRead(conversationId, currentUserId);
      return conversationId;
    } catch (error) {
      console.error("Open/create DM error:", error);
      if (activate) set({ isLoading: false });
      toast.error("Sohbet açılamadı.");
      return null;
    }
  },

  /**
   * Select an existing conversation
   */
  selectConversation: (conversation) => {
    // Stop previous listener
    get().stopMessageListener();

    set({
      activeConversation: conversation,
      messages: [],
      hasMoreMessages: false,
    });

    if (conversation?.id) {
      get().startMessageListener(conversation.id);
      get().markDMAsRead(conversation.id, auth.currentUser?.uid);
    }
  },

  /**
   * Send a DM message
   */
  sendMessage: async (conversationId, text, senderId, senderName, extra = {}) => {
    const cleanedText = (text || "").trim();
    const isImage = extra.type === "image";

    if (!cleanedText && !isImage) return { success: false, error: "Mesaj boş olamaz" };
    if (cleanedText.length > DM_MESSAGE_MAX_LENGTH) {
      return { success: false, error: `Mesaj en fazla ${DM_MESSAGE_MAX_LENGTH} karakter olabilir.` };
    }

    try {
      const convoRef = doc(db, "dm_conversations", conversationId);

      // Karşı tarafı bul. Yeni açılmış bir sohbet henüz `conversations` listesinde olmayabilir; eskiden bu
      // durumda okunmamış sayaç hiç artmıyor, ilk mesaj karşıya bildirim/rozet olarak ulaşmıyordu.
      const active = get().activeConversation;
      let participantIds =
        get().conversations.find(c => c.id === conversationId)?.participantIds ||
        (active?.id === conversationId ? active.participantIds : null);
      if (!participantIds) {
        try {
          participantIds = (await getDoc(convoRef)).data()?.participantIds || null;
        } catch {
          participantIds = null;
        }
      }
      const otherId = participantIds?.find(id => id !== senderId);

      // Engellenmiş kullanıcıyla mesajlaşılmaz
      const blockState = otherId ? useFriendStore.getState().blockedUsers?.[otherId] : null;
      if (blockState === "byMe") {
        return { success: false, error: "Bu kullanıcıyı engelledin. Mesaj göndermek için önce engeli kaldır." };
      }
      if (blockState === "byThem") {
        return { success: false, error: "Bu kullanıcıya mesaj gönderemezsin." };
      }

      // Mesaj + sohbet özeti TEK işlemde (biri yazılıp diğeri yazılamazsa özet eski kalmasın)
      const messageRef = doc(collection(db, "dm_conversations", conversationId, "messages"));
      const updateData = {
        lastMessage: {
          id: messageRef.id,
          text: previewOf(cleanedText, isImage),
          senderId,
          senderName,
          timestamp: Date.now(), // Local timestamp for UI immediate update
        },
        lastMessageAt: serverTimestamp(),
      };
      if (otherId) updateData[`unreadCounts.${otherId}`] = increment(1);

      const batch = writeBatch(db);
      batch.set(messageRef, {
        senderId,
        senderName,
        text: cleanedText,
        timestamp: serverTimestamp(),
        isImage,
        createdAt: serverTimestamp(),
        ...extra,
      });
      batch.update(convoRef, updateData);
      await batch.commit();

      return { success: true };
    } catch (error) {
      console.error("DM send error:", error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Load older messages (pagination)
   */
  loadOlderMessages: async (conversationId) => {
    const lastDoc = dmPaginationCursors.get(conversationId);
    if (!lastDoc) {
      set({ hasMoreMessages: false });
      return;
    }
    if (get().isLoadingOlder) return; // art arda tetiklenirse aynı sayfa iki kez yüklenmesin

    set({ isLoadingOlder: true });

    try {
      const olderQ = query(
        collection(db, "dm_conversations", conversationId, "messages"),
        orderBy("timestamp", "desc"),
        startAfter(lastDoc),
        limit(DM_MESSAGE_PAGE_SIZE)
      );

      const snapshot = await getDocs(olderQ);

      // Yükleme sırasında başka sohbete geçildiyse sonucu uygulama
      if (get().activeConversation?.id !== conversationId) {
        set({ isLoadingOlder: false });
        return;
      }

      if (snapshot.docs.length === 0) {
        dmPaginationCursors.set(conversationId, null);
        set({ hasMoreMessages: false, isLoadingOlder: false });
        return;
      }

      const olderMessages = snapshot.docs
        .map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }))
        .reverse();

      dmPaginationCursors.set(
        conversationId,
        snapshot.docs[snapshot.docs.length - 1]
      );

      set((state) => {
        const existingIds = new Set(state.messages.map(m => m.id));
        return {
          messages: [...olderMessages.filter(m => !existingIds.has(m.id)), ...state.messages],
          hasMoreMessages: snapshot.docs.length === DM_MESSAGE_PAGE_SIZE,
          isLoadingOlder: false,
        };
      });
    } catch (error) {
      console.error("Load older DM messages error:", error);
      set({ isLoadingOlder: false });
    }
  },

  /**
   * Edit a message
   */
  editMessage: async (conversationId, messageId, newText, userId) => {
    const clean = (newText || "").trim();
    if (!clean) return { success: false, error: "Mesaj boş olamaz." };
    if (clean.length > DM_MESSAGE_MAX_LENGTH) {
      return { success: false, error: `Mesaj en fazla ${DM_MESSAGE_MAX_LENGTH} karakter olabilir.` };
    }

    // Yalnızca kendi mesajı düzenlenebilir
    const target = get().messages.find(m => m.id === messageId);
    if (target && userId && target.senderId !== userId) {
      return { success: false, error: "Yalnızca kendi mesajını düzenleyebilirsin." };
    }
    if (target && target.text === clean) return { success: true }; // değişiklik yok

    try {
      const msgRef = doc(db, "dm_conversations", conversationId, "messages", messageId);
      await updateDoc(msgRef, {
        text: clean,
        isEdited: true,
        editedAt: serverTimestamp(),
      });

      // Update lastMessage preview if it was the last message
      const convo = get().conversations.find(c => c.id === conversationId);
      if (convo?.lastMessage?.id === messageId) {
        await updateDoc(doc(db, "dm_conversations", conversationId), {
          "lastMessage.text": previewOf(clean, false),
        });
      }

      return { success: true };
    } catch (error) {
      console.error("DM edit message error:", error);
      return { success: false, error: "Mesaj düzenlenemedi." };
    }
  },

  /**
   * Delete a message
   */
  deleteMessage: async (conversationId, messageId) => {
    try {
      await deleteDoc(
        doc(db, "dm_conversations", conversationId, "messages", messageId)
      );

      // Denormalized lastMessage update
      const convo = get().conversations.find(c => c.id === conversationId);

      // If we are deleting the message that is currently the 'lastMessage' in the conversation doc
      if (convo?.lastMessage?.id === messageId) {
        const remaining = get().messages.filter(m => m.id !== messageId);
        const newLast = remaining[remaining.length - 1];

        if (newLast) {
          await updateDoc(doc(db, "dm_conversations", conversationId), {
            lastMessage: {
              id: newLast.id,
              text: previewOf(newLast.text, !!newLast.isImage),
              senderId: newLast.senderId,
              senderName: newLast.senderName,
              timestamp: newLast.timestamp?.toMillis?.() || newLast.timestamp || Date.now(),
            },
            lastMessageAt: newLast.timestamp || serverTimestamp(),
          });
        } else {
          await updateDoc(doc(db, "dm_conversations", conversationId), {
            lastMessage: null,
            lastMessageAt: serverTimestamp()
          });
        }
      }

      return { success: true };
    } catch (error) {
      console.error("DM delete message error:", error);
      return { success: false };
    }
  },

  /**
   * Delete a sequence of messages from a user
   */
  deleteMessageSequence: async (conversationId, messageId) => {
    try {
      const currentMessages = get().messages;
      const targetMessage = currentMessages.find(m => m.id === messageId);
      if (!targetMessage) return { success: false, error: "Mesaj bulunamadı." };

      const sequenceIds = [];
      let startIndex = currentMessages.findIndex(m => m.id === messageId);

      const getTs = (ts) => ts?.toMillis?.() || (typeof ts === 'number' ? ts : (ts ? new Date(ts).getTime() : Date.now()));
      const targetTs = getTs(targetMessage.timestamp);

      // Geriye doğru sequence'ı bul (Older in index space)
      for (let i = startIndex; i >= 0; i--) {
        const msg = currentMessages[i];
        if (msg.senderId === targetMessage.senderId) {
          const timeDiff = Math.abs(targetTs - getTs(msg.timestamp));
          if (timeDiff < MESSAGE_SEQUENCE_THRESHOLD) {
            sequenceIds.push(msg.id);
          } else {
            break;
          }
        } else {
          break;
        }
      }

      // İleriye doğru sequence'ı bul (Newer in index space)
      for (let i = startIndex + 1; i < currentMessages.length; i++) {
        const msg = currentMessages[i];
        if (msg.senderId === targetMessage.senderId) {
          const timeDiff = Math.abs(getTs(msg.timestamp) - targetTs);
          if (timeDiff < MESSAGE_SEQUENCE_THRESHOLD) {
            sequenceIds.push(msg.id);
          } else {
            break;
          }
        } else {
          break;
        }
      }

      const uniqueSequenceIds = [...new Set(sequenceIds)];

      // Delete all in parallel
      await Promise.all(uniqueSequenceIds.map(id =>
        deleteDoc(doc(db, "dm_conversations", conversationId, "messages", id))
      ));

      return { success: true, deletedCount: uniqueSequenceIds.length };
    } catch (error) {
      console.error("DM delete sequence error:", error);
      return { success: false, error: "Mesajlar silinemedi." };
    }
  },

  /**
   * Toggle a reaction on a message
   * (işlem tek transaction'da: iki kişi aynı anda tepki verirse biri ötekini ezmesin)
   */
  toggleReaction: async (conversationId, messageId, emoji, userId) => {
    try {
      const msgRef = doc(db, "dm_conversations", conversationId, "messages", messageId);
      await runTransaction(db, async (tx) => {
        const msgDoc = await tx.get(msgRef);
        if (!msgDoc.exists()) return;

        const reactions = msgDoc.data().reactions || {};
        const emojiReactions = reactions[emoji] || [];

        const newEmojiReactions = emojiReactions.includes(userId)
          ? emojiReactions.filter(id => id !== userId)
          : [...emojiReactions, userId];

        const newReactions = { ...reactions };
        if (newEmojiReactions.length > 0) newReactions[emoji] = newEmojiReactions;
        else delete newReactions[emoji];

        tx.update(msgRef, { reactions: newReactions });
      });
    } catch (error) {
      console.error("DM toggle reaction error:", error);
    }
  },

  // ── UNREAD COUNTS ─────────────────────────────────────────

  incrementDMUnread: (conversationId) => {
    const active = get().activeConversation;
    if (active?.id === conversationId) return;

    set((state) => ({
      unreadDMCounts: {
        ...state.unreadDMCounts,
        [conversationId]: (state.unreadDMCounts[conversationId] || 0) + 1,
      },
    }));
  },

  markDMAsRead: async (conversationId, userId) => {
    if (!conversationId || !userId) return;

    const localUnread = get().unreadDMCounts[conversationId] || 0;
    const remoteUnread =
      get().conversations.find(c => c.id === conversationId)?.unreadCounts?.[userId] || 0;

    // Local reset
    if (localUnread) {
      set((state) => {
        const newCounts = { ...state.unreadDMCounts };
        delete newCounts[conversationId];
        return { unreadDMCounts: newCounts };
      });
    }

    // Okunmamış bir şey yoksa Firestore'a yazma. Eskiden sohbet açıkken her mesajda (kendi gönderdiğin
    // dahil) gereksiz yazma yapılıyor, bu da sohbet listesinin yeniden işlenmesine yol açıyordu.
    if (!localUnread && !remoteUnread) return;

    // Firestore reset
    try {
      await updateDoc(doc(db, "dm_conversations", conversationId), {
        [`unreadCounts.${userId}`]: 0,
      });
    } catch (error) {
      console.error("Failed to mark DM as read in Firestore:", error);
    }
  },

  getTotalUnreadCount: () => {
    const counts = get().unreadDMCounts;
    return Object.values(counts).reduce((sum, c) => sum + c, 0);
  },

  // ── CALLS ───────────────────────────────────────────────

  startCall: async (conversationId, callerId) => {
    try {
      await updateDoc(doc(db, "dm_conversations", conversationId), {
        callData: {
          status: 'ringing',
          callerId,
          timestamp: serverTimestamp()
        },
        lastMessageAt: serverTimestamp() // Update to push convo to top
      });
      return true;
    } catch (error) {
      console.error("Failed to start call:", error);
      return false;
    }
  },

  /**
   * Aramayı kabul et. Yalnızca arama HÂLÂ çalıyorsa kabul edilir: arayan bu arada vazgeçtiyse
   * eskiden boş bir "kabul edildi" kaydı oluşuyor ve kabul eden kişi odaya tek başına giriyordu.
   * Başarılıysa true, arama artık geçerli değilse false döner.
   */
  acceptCall: async (conversationId) => {
    try {
      const ref = doc(db, "dm_conversations", conversationId);
      return await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (snap.data()?.callData?.status !== 'ringing') return false;
        tx.update(ref, {
          "callData.status": 'accepted',
          "callData.acceptedAt": serverTimestamp(),
        });
        return true;
      });
    } catch (error) {
      console.error("Failed to accept call:", error);
      return false;
    }
  },

  endCall: async (conversationId) => {
    try {
      await updateDoc(doc(db, "dm_conversations", conversationId), {
        callData: null
      });
      return true;
    } catch (error) {
      console.error("Failed to end call:", error);
      return false;
    }
  },

  clearConversation: async (conversationId) => {
    if (!conversationId) return { success: false, error: "Conversation ID is missing" };

    try {
      // 1. Get all messages for this DM
      const q = query(collection(db, "dm_conversations", conversationId, "messages"));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return { success: true };
      }

      // 2. Batch delete (max 500 per batch standard, chunked to 400 safely)
      const docs = snapshot.docs;
      const chunkSize = 400;
      for (let i = 0; i < docs.length; i += chunkSize) {
        const chunk = docs.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        chunk.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      }

      // Clear from local state immediately if active
      if (get().activeConversation?.id === conversationId) {
        set({ messages: [], hasMoreMessages: false });
      }
      dmPaginationCursors.delete(conversationId);

      // 3. Reset conversation preview
      await updateDoc(doc(db, "dm_conversations", conversationId), {
        lastMessage: null,
        lastMessageAt: serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      console.error("Failed to clear DM conversation:", error);
      return { success: false, error: error.message };
    }
  },

  // ── CLEANUP ─────────────────────────────────────────────

  clearActiveConversation: () => {
    get().stopMessageListener();
    set({
      activeConversation: null,
      messages: [],
      hasMoreMessages: false,
    });
  },

  reset: () => {
    get().stopListeners();
    partnerDocCache.clear();
    dmPaginationCursors.clear();
    pendingUsers = null; // çıkış yapılırken bekleyen kullanıcı güncellemeleri yeni oturuma sızmasın
    set({
      conversations: [],
      activeConversation: null,
      messages: [],
      isLoading: false,
      isLoadingOlder: false,
      hasMoreMessages: false,
      unreadDMCounts: {},
      typingUsers: {},
    });
  },
}));
