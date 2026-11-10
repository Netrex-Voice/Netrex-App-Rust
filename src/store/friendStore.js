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
  updateDoc,
  serverTimestamp,
  onSnapshot,
  orderBy,
  limit,
  startAt,
  endAt,
} from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import { toast } from "@/src/utils/toast";
import { useSoundManagerStore } from "./soundManagerStore";
import { useSettingsStore } from "./settingsStore";

let friendsUnsubscribe = null;
let requestsUnsubscribe = null;
let searchSeq = 0; // eski arama sonuçları yenilerinin üstüne yazmasın
const sendingTo = new Set(); // aynı kişiye aynı anda iki istek gitmesin (çift tıklama)

// Arkadaş/istek listeleri her değiştiğinde (her anlık görüntüde) tüm kullanıcı belgelerini yeniden
// okumamak için kısa süreli bellek önbelleği. Canlı bilgi (durum, ad) zaten dmStore.users'tan gelir.
const USER_CACHE_TTL_MS = 5 * 60 * 1000;
const userCache = new Map(); // uid -> { data, at }

async function loadUser(uid) {
  if (!uid) return null;
  const cached = userCache.get(uid);
  if (cached && Date.now() - cached.at < USER_CACHE_TTL_MS) return cached.data;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    const data = { uid: snap.id, ...snap.data() };
    userCache.set(uid, { data, at: Date.now() });
    return data;
  } catch {
    return cached?.data || null;
  }
}

export const useFriendStore = create((set, get) => ({
  friends: [],           // { id, friendId, friendData, friendshipId }
  incomingRequests: [],   // Pending gelen istekler
  outgoingRequests: [],   // Pending giden istekler
  blockedUsers: {},       // { [uid]: "byMe" | "byThem" } — engelleme durumları
  recentlySent: {},       // { [uid]: true } — yeni gönderilip listeye henüz yansımamış istekler
  searchResults: [],
  isSearching: false,
  isLoading: false,
  error: null,

  // ── LISTENERS ─────────────────────────────────────────────

  /**
   * Start listening to accepted friendships for current user
   */
  startFriendListener: (userId) => {
    if (!userId) return;
    if (friendsUnsubscribe) friendsUnsubscribe();

    // Firestore farklı alanlarda OR desteklemediği için iki sorgu kurup sonuçları birleştiriyoruz
    const q1 = query(
      collection(db, "friendships"),
      where("senderId", "==", userId),
      where("status", "==", "accepted")
    );

    const q2 = query(
      collection(db, "friendships"),
      where("receiverId", "==", userId),
      where("status", "==", "accepted")
    );

    let results1 = [];
    let results2 = [];

    const mergeFriends = () => {
      const seen = new Set();
      const unique = [...results1, ...results2].filter((f) => {
        if (seen.has(f.friendshipId)) return false;
        seen.add(f.friendshipId);
        return true;
      });
      set({ friends: unique });
    };

    // Her anlık görüntü async işlenir; sonradan gelen daha yeniyse eskisinin sonucu atılır
    const makeHandler = (otherKey, assign) => {
      let seq = 0;
      return async (snapshot) => {
        const mySeq = ++seq;
        const friendships = snapshot.docs.map((d) => ({
          friendshipId: d.id,
          ...d.data(),
          friendId: d.data()[otherKey],
        }));

        const withData = await Promise.all(
          friendships.map(async (f) => ({ ...f, friendData: await loadUser(f.friendId) }))
        );

        if (mySeq !== seq) return;
        assign(withData.filter((f) => f.friendData));
        mergeFriends();
      };
    };

    const onError = (error) => console.error("Friends listener error:", error);

    const unsub1 = onSnapshot(q1, makeHandler("receiverId", (r) => { results1 = r; }), onError);
    const unsub2 = onSnapshot(q2, makeHandler("senderId", (r) => { results2 = r; }), onError);

    friendsUnsubscribe = () => {
      unsub1();
      unsub2();
    };
  },

  /**
   * Start listening to pending friend requests (incoming + outgoing) and blocks
   */
  startRequestListener: (userId) => {
    if (!userId) return;
    if (requestsUnsubscribe) requestsUnsubscribe();

    // Incoming requests (where I am the receiver)
    const incomingQ = query(
      collection(db, "friendships"),
      where("receiverId", "==", userId),
      where("status", "==", "pending")
    );

    // Outgoing requests (where I am the sender)
    const outgoingQ = query(
      collection(db, "friendships"),
      where("senderId", "==", userId),
      where("status", "==", "pending")
    );

    // Engellemeler (iki yönde)
    const blockedAsSenderQ = query(
      collection(db, "friendships"),
      where("senderId", "==", userId),
      where("status", "==", "blocked")
    );
    const blockedAsReceiverQ = query(
      collection(db, "friendships"),
      where("receiverId", "==", userId),
      where("status", "==", "blocked")
    );

    const onError = (error) => console.error("Friend requests listener error:", error);

    let incomingSeq = 0;
    const unsubIncoming = onSnapshot(incomingQ, async (snapshot) => {
      const mySeq = ++incomingSeq;
      const requests = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      const withData = await Promise.all(
        requests.map(async (r) => ({ ...r, senderData: await loadUser(r.senderId) }))
      );
      if (mySeq !== incomingSeq) return;
      set({ incomingRequests: withData.filter((r) => r.senderData) });
    }, onError);

    let outgoingSeq = 0;
    const unsubOutgoing = onSnapshot(outgoingQ, async (snapshot) => {
      const mySeq = ++outgoingSeq;
      const requests = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      const withData = await Promise.all(
        requests.map(async (r) => ({ ...r, receiverData: await loadUser(r.receiverId) }))
      );
      if (mySeq !== outgoingSeq) return;
      // Liste artık güncel: "yeni gönderildi" geçici işaretlerine gerek kalmadı
      set({ outgoingRequests: withData.filter((r) => r.receiverData), recentlySent: {} });
    }, onError);

    // Engeller: blockedBy alanı kimin engellediğini söyler
    let blockedA = {};
    let blockedB = {};
    const applyBlocked = () => set({ blockedUsers: { ...blockedA, ...blockedB } });
    const makeBlockHandler = (otherKey, assign) => (snapshot) => {
      const map = {};
      snapshot.docs.forEach((d) => {
        const data = d.data();
        const other = data[otherKey];
        if (!other) return;
        map[other] = data.blockedBy && data.blockedBy !== userId ? "byThem" : "byMe";
      });
      assign(map);
      applyBlocked();
    };
    const unsubBlockedA = onSnapshot(blockedAsSenderQ, makeBlockHandler("receiverId", (m) => { blockedA = m; }), onError);
    const unsubBlockedB = onSnapshot(blockedAsReceiverQ, makeBlockHandler("senderId", (m) => { blockedB = m; }), onError);

    requestsUnsubscribe = () => {
      unsubIncoming();
      unsubOutgoing();
      unsubBlockedA();
      unsubBlockedB();
    };
  },

  stopListeners: () => {
    if (friendsUnsubscribe) {
      friendsUnsubscribe();
      friendsUnsubscribe = null;
    }
    if (requestsUnsubscribe) {
      requestsUnsubscribe();
      requestsUnsubscribe = null;
    }
  },

  // ── ACTIONS ─────────────────────────────────────────────

  /**
   * Search users by username / displayName (prefix)
   */
  searchUsers: async (searchTerm, currentUserId) => {
    const term = (searchTerm || "").trim();
    if (term.length < 2) {
      searchSeq++; // bekleyen eski aramayı da geçersiz kıl
      set({ searchResults: [], isSearching: false });
      return;
    }

    const mySeq = ++searchSeq;
    set({ isSearching: true });

    try {
      // Firestore'da prefix araması büyük/küçük harfe duyarlıdır. Kullanıcı adı küçük harfle tutuluyor;
      // görünen ad ise "Murat" gibi yazıldığı için "mur" yazınca bulunamıyordu. Birkaç yazım biçimini
      // paralel sorguluyoruz. Her sorguda limit(20) maliyeti sınırlar.
      const lower = term.toLowerCase();
      const capitalized = lower.charAt(0).toUpperCase() + lower.slice(1);
      const titleCase = lower.replace(/(^|\s)(\S)/g, (m, sp, ch) => sp + ch.toUpperCase());
      const displayVariants = [...new Set([term, lower, capitalized, titleCase])];

      const usersRef = collection(db, "users");
      const prefixQuery = (field, value) =>
        getDocs(query(usersRef, orderBy(field), startAt(value), endAt(value + ""), limit(20)))
          .catch(() => ({ docs: [] }));

      const snapshots = await Promise.all([
        prefixQuery("username", lower),
        ...displayVariants.map((v) => prefixQuery("displayName", v)),
      ]);

      // Daha yeni bir arama başladıysa bu sonucu at (yavaş yanıt hızlıyı ezmesin)
      if (mySeq !== searchSeq) return;

      const mergedDocsMap = new Map();
      snapshots.forEach((snap) => {
        snap?.docs?.forEach((docSnap) => {
          if (docSnap.id !== currentUserId) mergedDocsMap.set(docSnap.id, docSnap);
        });
      });

      const { friends, incomingRequests, outgoingRequests, blockedUsers, recentlySent } = get();
      const results = [];

      mergedDocsMap.forEach((docSnap) => {
        const data = docSnap.data();

        // Seni engelleyen kullanıcılar aramada görünmez
        if (blockedUsers[docSnap.id] === "byThem") return;

        let relationshipStatus = "none";
        if (blockedUsers[docSnap.id] === "byMe") relationshipStatus = "blocked";
        else if (friends.some((f) => f.friendId === docSnap.id)) relationshipStatus = "friend";
        else if (incomingRequests.some((r) => r.senderId === docSnap.id)) relationshipStatus = "incoming";
        else if (outgoingRequests.some((r) => r.receiverId === docSnap.id) || recentlySent[docSnap.id]) {
          relationshipStatus = "outgoing";
        }

        results.push({
          uid: docSnap.id,
          displayName: data.displayName || "User",
          username: data.username || null,
          photoURL: data.photoURL || null,
          presence: data.presence || "offline",
          relationshipStatus,
        });
      });

      // Önce kullanıcı adı eşleşmeleri, sonra ada göre
      results.sort((a, b) => {
        const aExact = (a.username || "").toLowerCase().startsWith(lower) ? 0 : 1;
        const bExact = (b.username || "").toLowerCase().startsWith(lower) ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        return (a.displayName || "").localeCompare(b.displayName || "");
      });

      set({ searchResults: results.slice(0, 20), isSearching: false });
    } catch (error) {
      console.error("User search error:", error);
      if (mySeq === searchSeq) set({ isSearching: false, searchResults: [] });
    }
  },

  clearSearch: () => {
    searchSeq++;
    set({ searchResults: [], isSearching: false });
  },

  /**
   * Send a friend request
   */
  sendFriendRequest: async (senderId, receiverId) => {
    if (!senderId || !receiverId) return { success: false };
    if (senderId === receiverId) {
      toast.info("Kendine arkadaşlık isteği gönderemezsin.");
      return { success: false };
    }

    // Çift tıklama / arka arkaya çağrı: aynı kişiye ikinci istek gitmesin
    if (sendingTo.has(receiverId)) return { success: false };
    sendingTo.add(receiverId);

    try {
      const { friends, incomingRequests, outgoingRequests, blockedUsers } = get();

      if (blockedUsers[receiverId] === "byMe") {
        toast.info("Bu kullanıcıyı engelledin. İstek göndermek için önce engeli kaldır.");
        return { success: false };
      }
      if (blockedUsers[receiverId] === "byThem") {
        toast.error("Bu kullanıcıya arkadaşlık isteği gönderilemiyor.");
        return { success: false };
      }

      if (friends.some(f => f.friendId === receiverId)) {
        toast.info("Bu kullanıcı zaten arkadaşınız.");
        return { success: false };
      }

      if (outgoingRequests.some(r => r.receiverId === receiverId)) {
        toast.info("Arkadaşlık isteği zaten gönderildi.");
        return { success: false };
      }

      // If there's an incoming request from this user, auto-accept
      const existingIncoming = incomingRequests.find(r => r.senderId === receiverId);
      if (existingIncoming) {
        return await get().acceptRequest(existingIncoming.id);
      }

      // Check Firestore for existing friendship (any status, both directions)
      const [existingSnap, reverseSnap] = await Promise.all([
        getDocs(query(
          collection(db, "friendships"),
          where("senderId", "==", senderId),
          where("receiverId", "==", receiverId)
        )),
        getDocs(query(
          collection(db, "friendships"),
          where("senderId", "==", receiverId),
          where("receiverId", "==", senderId)
        )),
      ]);

      if (!existingSnap.empty || !reverseSnap.empty) {
        toast.info("Bu kullanıcıyla zaten bir ilişki mevcut.");
        return { success: false };
      }

      await addDoc(collection(db, "friendships"), {
        senderId,
        receiverId,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      // Liste dinleyicisi güncellenene kadar arayüzde "Gönderildi" görünsün
      set((state) => ({ recentlySent: { ...state.recentlySent, [receiverId]: true } }));

      // Play ping sound on success
      const volume = (useSettingsStore.getState().sfxVolume || 100) / 100;
      useSoundManagerStore.getState().play('discord-ping', volume);

      toast.success("Arkadaşlık isteği gönderildi!");
      return { success: true };
    } catch (error) {
      console.error("Send friend request error:", error);
      toast.error("Arkadaşlık isteği gönderilemedi.");
      return { success: false, error: error.message };
    } finally {
      sendingTo.delete(receiverId);
    }
  },

  /**
   * Accept a friend request
   */
  acceptRequest: async (friendshipId) => {
    try {
      await updateDoc(doc(db, "friendships", friendshipId), {
        status: "accepted",
        acceptedAt: serverTimestamp(),
      });
      toast.success("Arkadaşlık isteği kabul edildi!");
      return { success: true };
    } catch (error) {
      console.error("Accept request error:", error);
      toast.error("İstek kabul edilemedi.");
      return { success: false };
    }
  },

  /**
   * Reject/cancel a friend request
   */
  rejectRequest: async (friendshipId) => {
    try {
      await deleteDoc(doc(db, "friendships", friendshipId));
      toast.info("Arkadaşlık isteği reddedildi.");
      return { success: true };
    } catch (error) {
      console.error("Reject request error:", error);
      toast.error("İşlem yapılamadı.");
      return { success: false };
    }
  },

  /**
   * Remove a friend
   */
  removeFriend: async (friendshipId) => {
    try {
      await deleteDoc(doc(db, "friendships", friendshipId));
      toast.info("Arkadaş silindi.");
      return { success: true };
    } catch (error) {
      console.error("Remove friend error:", error);
      toast.error("Arkadaş silinemedi.");
      return { success: false };
    }
  },

  /**
   * Bir kullanıcıyı engelle (arkadaş olması gerekmez).
   * Aradaki arkadaşlık/istek kaydı varsa "engelli"ye çevrilir, yoksa yeni bir engel kaydı açılır.
   * (Eskiden bu işlev sohbet kimliğini arkadaşlık kimliği sanıyordu; hiçbir şey engellenmiyor ama
   * ekran "engellendi" diyordu.)
   */
  blockUserById: async (currentUserId, targetUserId) => {
    if (!currentUserId || !targetUserId || currentUserId === targetUserId) return { success: false };
    try {
      const [a, b] = await Promise.all([
        getDocs(query(
          collection(db, "friendships"),
          where("senderId", "==", currentUserId),
          where("receiverId", "==", targetUserId)
        )),
        getDocs(query(
          collection(db, "friendships"),
          where("senderId", "==", targetUserId),
          where("receiverId", "==", currentUserId)
        )),
      ]);
      const existing = [...a.docs, ...b.docs][0];

      if (existing) {
        await updateDoc(existing.ref, {
          status: "blocked",
          blockedBy: currentUserId,
          blockedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "friendships"), {
          senderId: currentUserId,
          receiverId: targetUserId,
          status: "blocked",
          blockedBy: currentUserId,
          createdAt: serverTimestamp(),
          blockedAt: serverTimestamp(),
        });
      }
      // Listener gelene kadar arayüz hemen tepki versin
      set((state) => ({ blockedUsers: { ...state.blockedUsers, [targetUserId]: "byMe" } }));
      return { success: true };
    } catch (error) {
      console.error("Block user error:", error);
      toast.error("Kullanıcı engellenemedi.");
      return { success: false };
    }
  },

  /**
   * Engeli kaldır (yalnızca engelleyen kaldırabilir). Arkadaşlık geri gelmez.
   */
  unblockUser: async (currentUserId, targetUserId) => {
    if (!currentUserId || !targetUserId) return { success: false };
    try {
      const [a, b] = await Promise.all([
        getDocs(query(
          collection(db, "friendships"),
          where("senderId", "==", currentUserId),
          where("receiverId", "==", targetUserId)
        )),
        getDocs(query(
          collection(db, "friendships"),
          where("senderId", "==", targetUserId),
          where("receiverId", "==", currentUserId)
        )),
      ]);
      const mine = [...a.docs, ...b.docs].filter((d) => {
        const data = d.data();
        return data.status === "blocked" && (!data.blockedBy || data.blockedBy === currentUserId);
      });
      await Promise.all(mine.map((d) => deleteDoc(d.ref)));

      set((state) => {
        const next = { ...state.blockedUsers };
        delete next[targetUserId];
        return { blockedUsers: next };
      });
      toast.info("Engel kaldırıldı.");
      return { success: true };
    } catch (error) {
      console.error("Unblock user error:", error);
      toast.error("Engel kaldırılamadı.");
      return { success: false };
    }
  },

  reset: () => {
    get().stopListeners();
    userCache.clear();
    sendingTo.clear();
    searchSeq++;
    set({
      friends: [],
      incomingRequests: [],
      outgoingRequests: [],
      blockedUsers: {},
      recentlySent: {},
      searchResults: [],
      isSearching: false,
      isLoading: false,
      error: null,
    });
  },
}));
