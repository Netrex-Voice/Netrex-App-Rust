import { create } from "zustand";
import { toast } from "sonner";
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
  arrayUnion,
  arrayRemove,
  setDoc,
  documentId,
  writeBatch
} from "firebase/firestore";
import { ref, onValue, off } from "firebase/database";
import { auth, db, rtdb } from "@/src/lib/firebase";
import { 
  DEFAULT_ROLE_NAME, 
  DEFAULT_ROLE_COLOR,
  SERVER_NAME_MIN_LENGTH,
  SERVER_NAME_MAX_LENGTH
} from "@/src/constants/appConfig";

// ── Sunucu açılırken güncelleme birleştirme ──────────────────────────────
// Bir sunucu açılınca kanallar, roller, üyeler, rozetler ve her sesli kanalın RTDB dinleyicisi art arda kendi
// set() çağrısını yapıyordu: her biri abone olan bileşenleri yeniden render ediyor, arayüz takılıyordu.
// Aynı kare içindeki güncellemeleri tek set()'e birleştiriyoruz. `gen`, sunucu değiştikten sonra gelen
// eski sunucunun verisinin yeni sunucuya yazılmasını engeller.
let serverGen = 0;
let pendingPatch = null;
let flushScheduled = false;

const scheduleFrame = (fn) =>
  typeof requestAnimationFrame === "function" ? requestAnimationFrame(fn) : setTimeout(fn, 16);

function batchedSet(set, gen, patch) {
  if (gen !== serverGen) return; // eski sunucunun geç kalmış verisi
  pendingPatch = { ...(pendingPatch || {}), ...patch };
  if (flushScheduled) return;
  flushScheduled = true;
  scheduleFrame(() => {
    flushScheduled = false;
    const p = pendingPatch;
    pendingPatch = null;
    if (p && gen === serverGen) set(p);
  });
}

export const useServerStore = create((set, get) => ({
  servers: [], // List of servers user is in
  currentServer: null,
  channels: [], // Channels of current server
  roles: [], // Roles of current server
  members: [], // Members of current server
  badges: [], // Badges of current server (sunucu bazlı rozetler)
  isLoading: false,
  error: null,
  isLeavingServer: false, // Flag to prevent "kicked" notification when user leaves voluntarily

  voiceStates: {}, // Map of channelId -> list of users in that channel
  mobileMemberDrawerOpen: false, // 📱 Mobil üye listesi drawer state
  setMobileMemberDrawerOpen: (open) => set({ mobileMemberDrawerOpen: open }),
  
  // Listeners that need cleanup
  _serverListener: null,
  _channelListener: null,
  _roleListener: null,
  _memberListener: null,
  _badgeListener: null,
  _voiceStateListener: null,
  _lastVoiceIds: "",

  // --- Actions ---

  // 1. Initialize: Listen to user's servers
  fetchUserServers: (userId) => {
    if (!userId) return;
    
    // Cleanup old listener
    if (get()._serverListener) get()._serverListener();

    set({ isLoading: true });
    
    // Query servers where this user is a member
    // Note: We need to ensure 'memberIds' array exists on server docs
    const q = query(
      collection(db, "servers"),
      where("memberIds", "array-contains", userId),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userServers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      set({ servers: userServers, isLoading: false });
    }, (error) => {
      console.error("Error fetching servers:", error);
      set({ error: error.message, isLoading: false });
    });

    set({ _serverListener: unsubscribe });
  },

  // 2. Select a server (and listen to its subcollections)
  selectServer: async (serverId) => {
    const prevServerId = get().currentServer?.id;
    if (prevServerId === serverId) return;

    // Yeni sunucu nesli: bekleyen/geç kalan birleştirilmiş güncellemeler artık geçersiz
    const gen = ++serverGen;
    pendingPatch = null;

    // Cleanup previous server listeners
    const { _channelListener, _roleListener, _memberListener, _badgeListener, _inviteListener, _voiceStateListener } = get();
    if (_channelListener) _channelListener();
    if (_roleListener) _roleListener();
    if (_memberListener) _memberListener();
    if (_badgeListener) _badgeListener();
    if (_inviteListener) _inviteListener();
    if (_voiceStateListener) _voiceStateListener();

    // ✅ OPTIMIZATION: Optimistic update - cache'ten sunucu bilgisini hemen göster
    let nextServer = null;
    if (serverId) {
        nextServer = get().servers.find(s => s.id === serverId) || null;
    }

    // ✅ FIX: Tek bir set() ile state'i güncelle - "ileri geri" glitch'ini önle
    // ✅ FIX: _lastVoiceIds eklendi. Null'a ya da başka sunucuya geçildiğinde id cache temizlenir, geri dönüldüğünde presence okuma bloke olmaz.
    set({ 
      currentServer: nextServer, 
      channels: [], 
      roles: [], 
      members: [],
      voiceStates: {},
      activeInvites: [],
      isLoading: true,
      _lastVoiceIds: ""
    });

    if (!serverId) {
      set({ isLoading: false });
      return; // "Home" state
    }

    try {
      // ✅ FIX: getDoc + listener'ları paralel başlat
      // Eski: getDoc → set(currentServer) → set(listeners) = 3 render
      // Yeni: getDoc + listeners paralel, tek set() ile birleştir
      
      const serverDocPromise = getDoc(doc(db, "servers", serverId));
      
      // Channels Listener - hemen başlat (getDoc'u bekleme)
      const channelsQ = query(
        collection(db, "servers", serverId, "channels")
      );
      const unsubChannels = onSnapshot(channelsQ, (snapshot) => {
        const channels = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.position || 0) - (b.position || 0));
        batchedSet(set, gen, { channels });

        // --- Voice States Listener ---
        const voiceChannels = channels.filter(c => c.type === 'voice');
        const voiceIds = voiceChannels.map(c => c.id);
        
        // Check if voice channel IDs changed (to avoid unnecessary re-subscription)
        const sortedIds = [...voiceIds].sort().join(',');
        const prevIds = get()._lastVoiceIds; 
        
        if (sortedIds !== prevIds) {
             const currentVoiceListener = get()._voiceStateListener;
             if (currentVoiceListener) currentVoiceListener();
             
             if (voiceIds.length > 0) {
                 const currentVoiceStates = {};
                 const unsubs = [];
                 
                 voiceIds.forEach(id => {
                     const roomRef = ref(rtdb, `room_presence/${id}`);
                     const unsub = onValue(roomRef, (snapshot) => {
                         const data = snapshot.val();
                         currentVoiceStates[id] = data ? Object.values(data) : [];
                         // currentVoiceStates kümülatif: aynı karedeki birden çok kanal güncellemesi tek set()'e iner
                         batchedSet(set, gen, { voiceStates: { ...get().voiceStates, ...currentVoiceStates } });
                     });
                     // onValue zaten unsubscribe fonksiyonu döndürür; off() callback ile eşleşmediği için listener'ı kapatmıyordu
                     unsubs.push(unsub);
                 });
                 
                 const combinedUnsub = () => {
                     unsubs.forEach(u => u());
                 };
                 
                 set({ _voiceStateListener: combinedUnsub, _lastVoiceIds: sortedIds });
             } else {
                 set({ voiceStates: {}, _voiceStateListener: null, _lastVoiceIds: "" });
             }
        }
      }, (error) => {
        console.error("Channels listener error:", error);
        set({ error: "Channels could not be loaded: " + error.message });
      });

      // Roles Listener
      const rolesQ = query(
        collection(db, "servers", serverId, "roles")
      );
      const unsubRoles = onSnapshot(rolesQ, (snapshot) => {
        const roles = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (b.position || 0) - (a.position || 0)); // Descending for roles
        batchedSet(set, gen, { roles });
      }, (error) => {
        console.error("Roles listener error:", error);
      });

      // Members Listener
      const membersQ = query(collection(db, "servers", serverId, "members"));
      let autoRepairDone = false;

      // Üyeler büyük olabilir (yüzlerce kayıt + liste render'ı). Kanal listesi önce çizilsin diye dinleyici
      // ilk karenin ardına ertelenir; sunucu açılırken her şeyin bir anda yüklenmesi takılma yaratıyordu.
      let unsubMembersInner = null;
      const startMembers = () => { unsubMembersInner = onSnapshot(membersQ, (snapshot) => {
        const members = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        batchedSet(set, gen, { members });

        // Auto-repair: Sadece ilk snapshot'ta, sadece bir kez çalış
        if (!autoRepairDone) {
          autoRepairDone = true;
          const membersNeedingRepair = members.filter(m => !m.displayName || m.displayName === "User");
          
          if (membersNeedingRepair.length > 0) {
            Promise.all(membersNeedingRepair.map(async (member) => {
              try {
                const userId = member.id || member.userId;
                if (!userId) return;
                const userDoc = await getDoc(doc(db, "users", userId));
                if (!userDoc.exists()) return;
                const userData = userDoc.data();
                const newDisplayName = userData.displayName || userData.name || "User";
                if (newDisplayName !== "User") {
                  await updateDoc(doc(db, "servers", serverId, "members", member.id), {
                    displayName: newDisplayName,
                    photoURL: userData.photoURL || null
                  });
                }
              } catch (e) {
                console.warn("Could not auto-repair member data:", e);
              }
            })).catch(() => {});
          }
        }
      }, (error) => {
        console.error("Members listener error:", error);
      }); };
      const membersTimer = setTimeout(startMembers, 150);
      const unsubMembers = () => {
        clearTimeout(membersTimer);
        if (unsubMembersInner) unsubMembersInner();
      };

      // Badges Listener (kritik değil: daha da geç başlar)
      const badgesQ = query(collection(db, "servers", serverId, "badges"));
      let unsubBadgesInner = null;
      const badgesTimer = setTimeout(() => {
        unsubBadgesInner = onSnapshot(badgesQ, (snapshot) => {
          const badges = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
          batchedSet(set, gen, { badges });
        }, (error) => {
          console.error("Badges listener error:", error);
        });
      }, 600);
      const unsubBadges = () => {
        clearTimeout(badgesTimer);
        if (unsubBadgesInner) unsubBadgesInner();
      };

      // ✅ FIX: getDoc sonucunu bekle ve TEK set() ile tüm listener'ları birlikte kaydet
      const serverDoc = await serverDocPromise;
      if (!serverDoc.exists()) {
        // Cleanup listeners we just started
        unsubChannels();
        unsubRoles();
        unsubMembers();
        unsubBadges();
        set({ error: "Server not found", isLoading: false, currentServer: null });
        return; 
      }

      // ✅ TEK set() - currentServer + listeners + isLoading = 1 render
      set({
        currentServer: { id: serverDoc.id, ...serverDoc.data() },
        isLoading: false,
        _channelListener: unsubChannels,
        _roleListener: unsubRoles,
        _memberListener: unsubMembers,
        _badgeListener: unsubBadges
      });

    } catch (error) {
      console.error("Error selecting server:", error);
      set({ error: error.message, isLoading: false });
    }
  },

  // 3. Create a Server
  createServer: async (name, userId, iconUrl = null) => {
    if (!name || name.length < SERVER_NAME_MIN_LENGTH) {
      return { success: false, error: "Server name too short." };
    }
    
    set({ isLoading: true });
    try {
      // Get user data first for member document
      const userDoc = await getDoc(doc(db, "users", userId));
      const userData = userDoc.exists() ? userDoc.data() : {};

      // 1. Create Server Doc
      const serverData = {
        name: name.trim(),
        ownerId: userId,
        iconUrl,
        createdAt: serverTimestamp(),
        memberIds: [userId],
      };
      
      const serverRef = await addDoc(collection(db, "servers"), serverData);
      const serverId = serverRef.id;

      // 2. Create Default Role (@everyone)
      const roleRef = await addDoc(collection(db, "servers", serverId, "roles"), {
        name: DEFAULT_ROLE_NAME,
        color: DEFAULT_ROLE_COLOR,
        permissions: [],
        position: 0,
        isDefault: true
      });

      // 3. Update Server with defaultRoleId
      await updateDoc(serverRef, { defaultRoleId: roleRef.id });

      // 4. Add Creator as Member (with displayName and photoURL)
      // Firebase Auth'tan güncel displayName'i al (users collection'dan daha güncel olabilir)
      const currentAuthUser = auth.currentUser;
      const displayName = 
        userData.displayName && userData.displayName !== "User" 
          ? userData.displayName 
          : userData.name && userData.name !== "User"
            ? userData.name
            : currentAuthUser?.displayName || "User";
      
      await setDoc(doc(db, "servers", serverId, "members", userId), {
        id: userId,
        userId,
        displayName: displayName,
        photoURL: userData.photoURL || null,
        joinedAt: serverTimestamp(),
        roles: [roleRef.id], // Give default role
        nickname: null
      });

      // 5. Create Default Channels
      await addDoc(collection(db, "servers", serverId, "channels"), {
        name: "genel",
        type: "text",
        position: 0
      });
      
      await addDoc(collection(db, "servers", serverId, "channels"), {
        name: "genel-sohbet",
        type: "voice",
        position: 1
      });

      set({ isLoading: false });
      return { success: true, serverId };

    } catch (error) {
      console.error("Error creating server:", error);
      set({ error: error.message, isLoading: false });
      return { success: false, error: error.message };
    }
  },

  // 4. Create Channel
  createChannel: async (serverId, name, type = "text") => {
    if (!serverId) return { success: false, error: "No server selected" };
    
    try {
      const channelData = {
        name: name.trim().toLowerCase().replace(/\s+/g, "-"),
        type,
        createdAt: serverTimestamp(),
        position: get().channels.length
      };
      
      await addDoc(collection(db, "servers", serverId, "channels"), channelData);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Kanalları yeniden sırala (sürükle-bırak / menü). `orderedIds`: o türdeki (text | voice) kanalların YENİ sırası.
  // Diğer türün kanalları kendi yerinde kalır; tüm kanallar 0..n-1 olarak yeniden numaralanır (eski çift/boş
  // position değerleri de düzelir). Ekran anında güncellenir, yazma başarısız olursa geri alınır.
  reorderChannels: async (serverId, type, orderedIds) => {
    if (!serverId || !Array.isArray(orderedIds)) return { success: false };
    const all = get().channels;
    const sameType = all.filter((c) => c.type === type);
    // Liste bu türün TÜM kanallarını içermiyorsa (ör. bazıları görünmüyorsa) yanlış sıra yazmamak için çık
    if (sameType.length !== orderedIds.length || !sameType.every((c) => orderedIds.includes(c.id))) {
      return { success: false, error: "Kanal listesi eşleşmiyor." };
    }

    const queue = [...orderedIds];
    const mergedIds = all.map((c) => (c.type === type ? queue.shift() : c.id));
    const byId = new Map(all.map((c) => [c.id, c]));
    const changed = mergedIds
      .map((id, index) => ({ id, index }))
      .filter(({ id, index }) => byId.get(id)?.position !== index);
    if (changed.length === 0) return { success: true };

    const previous = all;
    set({ channels: mergedIds.map((id, index) => ({ ...byId.get(id), position: index })) });

    try {
      const batch = writeBatch(db);
      changed.forEach(({ id, index }) =>
        batch.update(doc(db, "servers", serverId, "channels", id), { position: index }),
      );
      await batch.commit();
      return { success: true };
    } catch (error) {
      set({ channels: previous });
      return { success: false, error: error.message };
    }
  },

  deleteChannel: async (serverId, channelId) => {
      try {
          await deleteDoc(doc(db, "servers", serverId, "channels", channelId));
          return { success: true };
      } catch (error) {
          console.error("Delete channel failed:", error);
          return { success: false, error: error.message };
      }
  },

  // Update Channel (name, type, permissions)
  updateChannel: async (channelId, data) => {
    const serverId = get().currentServer?.id;
    if (!serverId) return { success: false, error: "No server selected" };
    
    try {
      await updateDoc(doc(db, "servers", serverId, "channels", channelId), data);
      return { success: true };
    } catch (error) {
      console.error("Update channel failed:", error);
      return { success: false, error: error.message };
    }
  },

  // Set channel permission overwrites
  // permissionOverwrites: { [roleId]: { view: boolean, connect: boolean, speak: boolean } }
  setChannelPermissions: async (channelId, permissionOverwrites) => {
    const serverId = get().currentServer?.id;
    if (!serverId) return { success: false, error: "No server selected" };
    
    try {
      await updateDoc(doc(db, "servers", serverId, "channels", channelId), {
        permissionOverwrites
      });
      return { success: true };
    } catch (error) {
      console.error("Set channel permissions failed:", error);
      return { success: false, error: error.message };
    }
  },

  // Check if user can view a channel based on their roles
  canUserViewChannel: (channel, userRoles) => {
    // 1. If no permission overwrites, everyone can see it
    if (!channel.permissionOverwrites || Object.keys(channel.permissionOverwrites).length === 0) {
      return true;
    }
    
    const server = get().currentServer;
    const defaultRoleId = server?.defaultRoleId;
    
    // Ensure we check default role even if not in userRoles list
    const allUserRoles = new Set(userRoles);
    if (defaultRoleId) allUserRoles.add(defaultRoleId);
    
    let explicitAllow = false;
    let explicitDeny = false;
    
    // Check specific role permissions
    for (const roleId of allUserRoles) {
      const perm = channel.permissionOverwrites[roleId];
      if (perm?.view === true) explicitAllow = true;
      if (perm?.view === false) explicitDeny = true;
    }
    
    // Allow wins over Deny (standard permission model)
    if (explicitAllow) return true;
    if (explicitDeny) return false;
    
    // If we are here, all user's roles are Neutral (undefined view permission).
    
    // Check for "Implicit Privacy" (Whitelist)
    // If ANY role in the overwrites is explicitly Allowed, then it's a private channel 
    // and since we weren't allowed above, we can't see it.
    const hasAnyAllow = Object.values(channel.permissionOverwrites).some(p => p.view === true);
    
    // If someone is allowed (Private), we are blocked.
    // If nobody is allowed (Public with only some Denies elsewhere), we are passed.
    if (hasAnyAllow) return false;
    
    return true;
  },

  // 5. Create Role
  createRole: async (name, color, permissions = []) => {
    const serverId = get().currentServer?.id;
    if (!serverId) return { success: false, error: "No server selected" };

    try {
      const roleData = {
        name,
        color,
        permissions,
        position: get().roles.length, 
        isDefault: false
      };
      await addDoc(collection(db, "servers", serverId, "roles"), roleData);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  updateRole: async (roleId, data) => {
      const serverId = get().currentServer?.id;
      if (!serverId) return;
      try {
          await updateDoc(doc(db, "servers", serverId, "roles", roleId), data);
      } catch (error) {
          console.error("Update role failed:", error);
      }
  },

  deleteRole: async (roleId) => {
      const serverId = get().currentServer?.id;
      if (!serverId) return;
      try {
          await deleteDoc(doc(db, "servers", serverId, "roles", roleId));
      } catch (error) {
          console.error("Delete role failed:", error);
      }
  },

  updateServer: async (serverId, data) => {
      try {
          await updateDoc(doc(db, "servers", serverId), data);
          
          // Update local currentServer state for immediate reactivity
          const currentServer = get().currentServer;
          if (currentServer?.id === serverId) {
              set({ currentServer: { ...currentServer, ...data } });
          }
          
          // Also update in servers list
          set(state => ({
              servers: state.servers.map(s => 
                  s.id === serverId ? { ...s, ...data } : s
              )
          }));
      } catch (error) {
          console.error("Update server failed:", error);
      }
  },

  deleteServer: async (serverId) => {
      try {
          // 1. Delete Subcollections (Manual cleanup for client-side)
          // Note: Ideally this should be done via a Cloud Function for reliability and cleaner client code.
          const subcollections = ["channels", "roles", "members", "invites", "bans"];
          
          for (const sub of subcollections) {
              try {
                  const q = query(collection(db, "servers", serverId, sub));
                  const snapshot = await getDocs(q);
                  // Delete in batches or parallel
                  const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
                  await Promise.all(deletePromises);
              } catch (subError) {
                  console.warn(`Could not delete subcollection ${sub}:`, subError);
              }
          }

          // 2. Delete Main Doc
          await deleteDoc(doc(db, "servers", serverId));
          
          if (get().currentServer?.id === serverId) {
              get().selectServer(null);
          }
          return { success: true };
      } catch (error) {
          console.error("Delete server failed:", error);
          return { success: false, error: error.message };
      }
  },

  leaveServer: async (serverId, userId) => {
      try {
          if (!serverId || !userId) return;

          // Set flag to prevent "kicked" notification
          set({ isLeavingServer: true });

          // Remove user from 'members' subcollection
          await deleteDoc(doc(db, "servers", serverId, "members", userId));

          // Remove user from 'memberIds' array in server doc
          await updateDoc(doc(db, "servers", serverId), {
              memberIds: arrayRemove(userId)
          });
          
          if (get().currentServer?.id === serverId) {
              get().selectServer(null);
          }
          
          // Reset flag after a short delay (allow AppShell effect to run)
          setTimeout(() => set({ isLeavingServer: false }), 500);
          
          toast.success("Sunucudan ayrıldınız.", { id: 'leave-notification' });
          return { success: true };
      } catch (error) {
          console.error("Leave server failed:", error);
          set({ isLeavingServer: false }); // Reset flag on error
          return { success: false, error: error.message };
      }
  },

  createInvite: async (serverId, options = {}) => {
      try {
          const inviteCode = Math.random().toString(36).substring(2, 10);
          const inviteData = {
              code: inviteCode,
              serverId,
              creatorId: options.userId,
              createdAt: serverTimestamp(),
              uses: 0,
              maxUses: options.maxUses || 0, // 0 = infinite
              expiresAt: options.expiresAt || null
          };
          
          await setDoc(doc(db, "invites", inviteCode), inviteData);
          await setDoc(doc(db, "servers", serverId, "invites", inviteCode), inviteData);
          
          if (get().currentServer?.id === serverId) {
             set(state => ({ activeInvites: [...(state.activeInvites || []), inviteData] }));
          }
          
          return { success: true, code: inviteCode };
      } catch (error) {
          console.error("Create invite failed:", error);
          return { success: false, error: error.message };
      }
  },

  deleteInvite: async (inviteCode, serverId) => {
      try {
          // Delete from global invites
          await deleteDoc(doc(db, "invites", inviteCode));
          // Delete from server subcollection
          await deleteDoc(doc(db, "servers", serverId, "invites", inviteCode));
          
          if (get().currentServer?.id === serverId) {
             set(state => ({ 
                 activeInvites: state.activeInvites.filter(i => i.code !== inviteCode) 
             }));
          }
          return { success: true };
      } catch (error) {
          console.error("Delete invite failed:", error);
          return { success: false, error: error.message };
      }
  },

  fetchServerInvites: async (serverId) => {
      try {
          const q = query(collection(db, "servers", serverId, "invites"));
          const snapshot = await getDocs(q);
          const invites = snapshot.docs.map(d => d.data());
          set({ activeInvites: invites });
      } catch (error) {
           console.error("Fetch invites failed:", error);
      }
  },

  joinServer: async (inviteCode, userId) => {
    try {
       // Sanitize invite code to prevent invalid path segments
       const cleanCode = inviteCode.trim().replace(/^netrex:\/\//, "");
       
       const inviteRef = doc(db, "invites", cleanCode);
       const inviteDoc = await getDoc(inviteRef);
       
       if (!inviteDoc.exists()) {
           return { success: false, error: "Geçersiz davet kodu." };
       }
       
       const invite = inviteDoc.data();
       
       if (invite.expiresAt && invite.expiresAt.toMillis() < Date.now()) {
           return { success: false, error: "Davet kodunun süresi dolmuş." };
       }
       
       if (invite.maxUses > 0 && invite.uses >= invite.maxUses) {
           return { success: false, error: "Davet limiti dolmuş." };
       }
       
       const serverId = invite.serverId;

       // Check if user is banned
       const banDoc = await getDoc(doc(db, "servers", serverId, "bans", userId));
       if (banDoc.exists()) {
           const banData = banDoc.data();
           return { success: false, error: `Bu sunucudan yasaklandınız! Sebep: ${banData.reason || "Belirtilmedi"}` };
       }
       
       const memberRef = doc(db, "servers", serverId, "members", userId);
       const memberDoc = await getDoc(memberRef);
       if (memberDoc.exists()) {
           get().selectServer(serverId);
           return { success: true, serverId, message: "Zaten bu sunucunun üyesisin! Sunucuya geçiş yapıldı." }; 
       }
       
       const userDoc = await getDoc(doc(db, "users", userId));
       const userData = userDoc.exists() ? userDoc.data() : {};
       
       // Firebase Auth'tan güncel displayName'i al (users collection'dan daha güncel olabilir)
       const currentAuthUser = auth.currentUser;
       const displayName = 
         userData.displayName && userData.displayName !== "User" 
           ? userData.displayName 
           : currentAuthUser?.displayName || "User";
       
       const serverDoc = await getDoc(doc(db, "servers", serverId));
       const defaultRoleId = serverDoc.data()?.defaultRoleId;

       await setDoc(memberRef, {
           id: userId,
           displayName: displayName, // Hesaplanan displayName'i kullan
           photoURL: userData.photoURL || null,
           roles: defaultRoleId ? [defaultRoleId] : [],
           joinedAt: serverTimestamp()
       });
       
       await updateDoc(inviteRef, { uses: invite.uses + 1 });
       try { 
         await updateDoc(doc(db, "servers", serverId, "invites", cleanCode), { uses: invite.uses + 1 }); 
       } catch(e) {}
       
       await updateDoc(doc(db, "servers", serverId), {
           memberIds: arrayUnion(userId)
       });
       
       get().selectServer(serverId);
       return { success: true, serverId };
    } catch (error) {
        console.error("Join server failed:", error);
        return { success: false, error: error.message };
    }
  },

  // Assign role to member
  assignRoleToMember: async (memberId, roleId) => {
    const serverId = get().currentServer?.id;
    if (!serverId) return { success: false, error: "No server selected" };
    
    try {
      const memberRef = doc(db, "servers", serverId, "members", memberId);
      await updateDoc(memberRef, {
        roles: arrayUnion(roleId)
      });
      return { success: true };
    } catch (error) {
      console.error("Assign role failed:", error);
      return { success: false, error: error.message };
    }
  },

  // Remove role from member
  removeRoleFromMember: async (memberId, roleId) => {
    const serverId = get().currentServer?.id;
    if (!serverId) return { success: false, error: "No server selected" };
    
    try {
      const memberRef = doc(db, "servers", serverId, "members", memberId);
      await updateDoc(memberRef, {
        roles: arrayRemove(roleId)
      });
      return { success: true };
    } catch (error) {
      console.error("Remove role failed:", error);
      return { success: false, error: error.message };
    }
  },

  // Set member roles (replace all)
  setMemberRoles: async (memberId, roleIds) => {
    const serverId = get().currentServer?.id;
    if (!serverId) return { success: false, error: "No server selected" };
    
    try {
      const memberRef = doc(db, "servers", serverId, "members", memberId);
      await updateDoc(memberRef, {
        roles: roleIds
      });
      return { success: true };
    } catch (error) {
      console.error("Set member roles failed:", error);
      return { success: false, error: error.message };
    }
  },

  // --- MODERATION ---

  kickMember: async (serverId, userId) => {
    try {
        if (!serverId || !userId) return;

        // Remove from members
        await deleteDoc(doc(db, "servers", serverId, "members", userId));

        // Remove from memberIds array
        await updateDoc(doc(db, "servers", serverId), {
            memberIds: arrayRemove(userId)
        });
        
        return { success: true };
    } catch (error) {
        console.error("Kick failed:", error);
        return { success: false, error: error.message };
    }
  },

  banMember: async (serverId, userId, displayName, reason = "Belirtilmedi") => {
    try {
        if (!serverId || !userId) return;

        // 1. Add to Bans Collection
        await setDoc(doc(db, "servers", serverId, "bans", userId), {
            userId,
            displayName: displayName || "Kullanıcı",
            reason,
            bannedAt: serverTimestamp(),
            bannedBy: auth.currentUser?.uid
        });

        // 2. Remove from members (Kick)
        await deleteDoc(doc(db, "servers", serverId, "members", userId));
        await updateDoc(doc(db, "servers", serverId), {
            memberIds: arrayRemove(userId)
        });

        return { success: true };
    } catch (error) {
        console.error("Ban failed:", error);
        return { success: false, error: error.message };
    }
  },

  unbanMember: async (serverId, userId) => {
      try {
          await deleteDoc(doc(db, "servers", serverId, "bans", userId));
          return { success: true };
      } catch (error) {
          console.error("Unban failed:", error);
          return { success: false, error: error.message };
      }
  },

  fetchBans: async (serverId) => {
      try {
          const snapshot = await getDocs(collection(db, "servers", serverId, "bans"));
          return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (error) {
          console.error("Fetch bans failed:", error);
          return [];
      }
  },

  // --- BADGE MANAGEMENT ---
  
  // Create a new badge for the server
  createBadge: async (serverId, badgeData) => {
    try {
      const badgeRef = await addDoc(collection(db, "servers", serverId, "badges"), {
        ...badgeData,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser?.uid
      });
      return { success: true, badgeId: badgeRef.id };
    } catch (error) {
      console.error("Create badge failed:", error);
      return { success: false, error: error.message };
    }
  },

  // Update an existing badge
  updateBadge: async (serverId, badgeId, data) => {
    try {
      await updateDoc(doc(db, "servers", serverId, "badges", badgeId), {
        ...data,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error("Update badge failed:", error);
      return { success: false, error: error.message };
    }
  },

  // Delete a badge
  deleteBadge: async (serverId, badgeId) => {
    try {
      // First, remove this badge from all members who have it
      const membersSnapshot = await getDocs(collection(db, "servers", serverId, "members"));
      const updatePromises = [];
      
      membersSnapshot.docs.forEach(memberDoc => {
        const memberData = memberDoc.data();
        if (memberData.badges && memberData.badges.includes(badgeId)) {
          updatePromises.push(
            updateDoc(doc(db, "servers", serverId, "members", memberDoc.id), {
              badges: arrayRemove(badgeId)
            })
          );
        }
      });
      
      await Promise.all(updatePromises);
      
      // Then delete the badge itself
      await deleteDoc(doc(db, "servers", serverId, "badges", badgeId));
      return { success: true };
    } catch (error) {
      console.error("Delete badge failed:", error);
      return { success: false, error: error.message };
    }
  },

  // Assign a badge to a member
  assignBadgeToMember: async (serverId, memberId, badgeId) => {
    try {
      await updateDoc(doc(db, "servers", serverId, "members", memberId), {
        badges: arrayUnion(badgeId)
      });
      return { success: true };
    } catch (error) {
      console.error("Assign badge failed:", error);
      return { success: false, error: error.message };
    }
  },

  // Remove a badge from a member
  removeBadgeFromMember: async (serverId, memberId, badgeId) => {
    try {
      await updateDoc(doc(db, "servers", serverId, "members", memberId), {
        badges: arrayRemove(badgeId)
      });
      return { success: true };
    } catch (error) {
      console.error("Remove badge failed:", error);
      return { success: false, error: error.message };
    }
  },

  // Cleanup
  reset: () => {
    const { _serverListener, _channelListener, _roleListener, _memberListener, _badgeListener, _voiceStateListener } = get();
    if (_serverListener) _serverListener();
    if (_channelListener) _channelListener();
    if (_roleListener) _roleListener();
    if (_memberListener) _memberListener();
    if (_badgeListener) _badgeListener();
    if (_voiceStateListener) _voiceStateListener();
    set({ servers: [], currentServer: null, channels: [], roles: [], members: [], badges: [], voiceStates: {}, isLeavingServer: false });
  }
}));
