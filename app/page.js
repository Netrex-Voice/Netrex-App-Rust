"use client";

/**
 * 🏠 Home Page - Main Application Entry
 * NDS v2.0 - Netrex Design System
 */

import dynamic from "next/dynamic";
import { useEffect, useState, useRef, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { useLayoutStore } from "@/src/store/layoutStore";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "@/src/store/authStore";
import { toast } from "@/src/utils/toast";
import { doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { useVoiceCommands } from "@/src/hooks/useVoiceCommands";
import { db } from "@/src/lib/firebase";

// Page Components
import { LoginPage, LoadingScreen } from "@/src/components/pages";
import { WelcomeScreen } from "@/src/components/layout";

// Splash Screen
import SplashScreen from "@/src/components/SplashScreen";
import ModalA11yManager from "@/src/components/ModalA11yManager";
import VoiceConnectedBar from "@/src/components/layout/VoiceConnectedBar";
import VoiceMiniWidget from "@/src/components/layout/VoiceMiniWidget";
import { useRoomPresenceStore } from "@/src/store/roomPresenceStore";
import { AppShell } from "@/src/components/layout";
import ServerRail from "@/src/components/layout/ServerRail";
import CreateServerModal from "@/src/components/server/CreateServerModal";
import JoinServerModal from "@/src/components/server/JoinServerModal";
import AddServerSelectionModal from "@/src/components/server/AddServerSelectionModal";
import ServerSidebar from "@/src/components/server/ServerSidebar";
import { useServerStore } from "@/src/store/serverStore";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useChatStore } from "@/src/store/chatStore";
import { useUpdateStore } from "@/src/store/updateStore";

// ✅ Friends & DM System
import { useFriendStore } from "@/src/store/friendStore";
import { useDMStore } from "@/src/store/dmStore";
import { FriendsPanel, DMSidebar, DMConversation } from "@/src/components/friends";
import { useSoundEffects } from "@/src/hooks/useSoundEffects";

const ActiveRoom = dynamic(() => import("@/src/components/ActiveRoom"), {
  loading: () => <LoadingScreen message="Oda yükleniyor..." />,
});
const StandaloneChatView = dynamic(
  () => import("@/src/components/StandaloneChatView"),
  {
    loading: () => <LoadingScreen message="Sohbet yükleniyor..." />,
  },
);

import UpdateNotification from "@/src/components/UpdateNotification";
import InfoModal from "@/src/components/InfoModal";
import VoiceChannelSwitchModal from "@/src/components/VoiceChannelSwitchModal";
const InstallUpdateSplash = dynamic(
  () => import("@/src/components/InstallUpdateSplash"),
);

import ServerMemberList from "@/src/components/server/ServerMemberList";
import ServerSidebarSkeleton from "@/src/components/server/skeletons/ServerSidebarSkeleton";
import ServerMemberListSkeleton from "@/src/components/server/skeletons/ServerMemberListSkeleton";
import IncomingCallModal from "@/src/components/friends/IncomingCallModal";
import OutgoingCallModal from "@/src/components/friends/OutgoingCallModal";

// Güvenli ve Temizlenen Loop Ses Component'i
const LoopingAudio = ({ src }) => {
  const audioRef = useRef(null);
  const sfxVolume = useSettingsStore(state => state.sfxVolume);

  // Uygulamanın ses ayarına göre volume belirle
  useEffect(() => {
    if (audioRef.current && sfxVolume !== undefined) {
      audioRef.current.volume = Math.max(0, Math.min(1, sfxVolume / 100));
    }
  }, [sfxVolume]);

  // Memory Leak olmaması için kesin cleanup
  useEffect(() => {
    const audioEl = audioRef.current;
    
    // Play with catch to avoid DOM Exception on sudden unmounts
    if (audioEl) {
      audioEl.play().catch(e => {
        // Silently ignore play interruptions
      });
    }

    return () => {
      if (audioEl) {
        audioEl.pause();
        audioEl.src = "";
      }
    };
  }, [src]);

  return <audio ref={audioRef} src={src} loop />;
};

export default function Home() {
  // Seçicisiz useXStore() çağrısı depodaki HER değişiklikte (üye listesi, ses durumları, yazıyor bilgisi…) tüm
  // sayfayı yeniden render ediyordu; sunucu açılırken bu onlarca kez art arda oluyor ve arayüz takılıyordu.
  // useShallow ile yalnızca gerçekten kullanılan alanlara abone oluyoruz.
  const { user, isAuth, isLoading, initializeAuth, loginAnonymously } = useAuthStore(
    useShallow((s) => ({
      user: s.user,
      isAuth: s.isAuth,
      isLoading: s.isLoading,
      initializeAuth: s.initializeAuth,
      loginAnonymously: s.loginAnonymously,
    })),
  );
  const { currentServer, servers, isLoading: isServerLoading, channels } = useServerStore(
    useShallow((s) => ({
      currentServer: s.currentServer,
      servers: s.servers,
      isLoading: s.isLoading,
      channels: s.channels,
    })),
  );

  const [currentRoom, setCurrentRoom] = useState(null);
  const [currentTextChannel, setCurrentTextChannel] = useState(null);

  // ✅ Global Chat State
  const showChatPanel = useChatStore((state) => state.showChatPanel);
  const setShowChatPanel = useChatStore((state) => state.setShowChatPanel);

  // ✅ Friends & DM State
  const [friendsMode, setFriendsMode] = useState(false); // Ayrı sekme: ServerRail'den aktif edilir
  const [showFriendsPanel, setShowFriendsPanel] = useState(true);
  const {
    conversations,
    activeConversation,
    openOrCreateConversation,
    selectConversation,
    clearActiveConversation,
    acceptCall,
    endCall,
    markDMAsRead,
    unreadDMCounts,
    startConversationListener,
    stopListeners: stopDMListeners,
  } = useDMStore(
    useShallow((s) => ({
      conversations: s.conversations,
      activeConversation: s.activeConversation,
      openOrCreateConversation: s.openOrCreateConversation,
      selectConversation: s.selectConversation,
      clearActiveConversation: s.clearActiveConversation,
      acceptCall: s.acceptCall,
      endCall: s.endCall,
      markDMAsRead: s.markDMAsRead,
      unreadDMCounts: s.unreadDMCounts,
      startConversationListener: s.startConversationListener,
      stopListeners: s.stopListeners,
    })),
  );

  const {
    friends,
    incomingRequests,
    startFriendListener,
    startRequestListener,
    stopListeners: stopFriendListeners
  } = useFriendStore(
    useShallow((s) => ({
      friends: s.friends,
      incomingRequests: s.incomingRequests,
      startFriendListener: s.startFriendListener,
      startRequestListener: s.startRequestListener,
      stopListeners: s.stopListeners,
    })),
  );
  const { playSound } = useSoundEffects();

  // Çağrı yaşını (zaman aşımı için) güvenli hesapla
  const getCallAge = useCallback((ts) => {
    if (!ts) return 0; // If pending serverTimestamp, treat as new
    const now = Date.now();
    let time = 0;
    
    if (typeof ts === 'object' && ts.toMillis) {
      time = ts.toMillis();
    } else if (typeof ts === 'number') {
      time = ts;
    } else if (ts instanceof Date) {
      time = ts.getTime();
    } else {
      time = new Date(ts).getTime();
    }
    
    return isNaN(time) ? 0 : now - time;
  }, []);

  // Arayan taraf biz değilsek ve 'ringing' statüsünde ise modalı göster (60 saniye limitli)
  const incomingCallConvo = conversations.find(c => {
    const data = c.callData;
    if (data?.status === 'ringing' && data?.callerId !== user?.uid) {
      return getCallAge(data.timestamp) < 65000; // 60s + 5s buffer
    }
    return false;
  });

  // Arayan taraf BİZ isek ve çalma durumundaysa modalı göster (İptal için)
  const outgoingCallConvo = conversations.find(c => {
    const data = c.callData;
    if (data?.status === 'ringing' && data?.callerId === user?.uid) {
      return getCallAge(data.timestamp) < 65000;
    }
    return false;
  });

  // 🔔 Bildirim ve Ses Sistemi için Yardımcı Fonksiyon
  const triggerNotification = useCallback((title, options = {}) => {
    // Ses çal (Her zaman çal)
    if (options.sound) playSound(options.sound);

    // Bildirim gönder
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        try {
          const notification = new Notification(title, {
            body: options.body || "",
            icon: options.icon || "/icons/icon-512x512.png",
            silent: true, // Zaten biz kendi sesimizi çalıyoruz
          });
          
          notification.onclick = () => {
            window.focus();
            if (options.onClick) options.onClick();
          };
        } catch (err) {
          console.error("Bildirim hatası:", err);
        }
      } else if (Notification.permission !== "denied") {
        Notification.requestPermission();
      }
    }
    
    // Uygulama içi Toast (Opsiyonel)
    if (options.showToast) {
       toast.info(`${title}: ${options.body}`);
    }
  }, [playSound]);

  // --- 1. DM BİLDİRİMLERİ ---
  const prevUnreadTotal = useRef(0);
  const prevUnreadCounts = useRef({});
  useEffect(() => {
    const currentTotal = Object.values(unreadDMCounts).reduce((acc, count) => acc + count, 0);
    
    // Sesi her durumda çal, bildirimi sadece başkası attıysa gönder
    if (currentTotal > prevUnreadTotal.current) {
      conversations.forEach(convo => {
        const count = unreadDMCounts[convo.id] || 0;
        const prevCount = prevUnreadCounts.current[convo.id] || 0;

        if (count > prevCount && convo.lastMessage?.senderId !== user?.uid) {
           triggerNotification(convo.otherUser?.displayName || "Yeni Mesaj", {
             body: convo.lastMessage?.text || "Bir fotoğraf gönderdi",
             sound: "message"
           });
        }
      });
    }

    prevUnreadCounts.current = { ...unreadDMCounts };
    prevUnreadTotal.current = currentTotal;
  }, [unreadDMCounts, conversations, user?.uid, triggerNotification]);

  // --- 2. ARKADAŞLIK İSTEĞİ BİLDİRİMLERİ ---
  const prevRequestsLength = useRef(0);
  useEffect(() => {
    if (incomingRequests.length > prevRequestsLength.current) {
      const newRequest = incomingRequests[0];
      if (newRequest && newRequest.senderData) {
        // Sound & Browser Notification
        triggerNotification("Yeni Arkadaşlık İsteği", {
          body: `${newRequest.senderData.displayName} size bir istek gönderdi.`,
          sound: "friend-notificaiton"
        });

        // Toast Bildirimi
        toast.info(`${newRequest.senderData.displayName} size arkadaşlık isteği gönderdi.`, {
          title: "Yeni Arkadaşlık İsteği"
        });
      }
    }
    prevRequestsLength.current = incomingRequests.length;
  }, [incomingRequests, triggerNotification]);

  // --- 3. ARKADAŞLIK KABUL EDİLDİ BİLDİRİMİ ---
  const prevFriendsLength = useRef(0);
  useEffect(() => {
    // Sadece arkadaşlar listesi büyüdüğünde kontrol et
    if (friends.length > prevFriendsLength.current) {
      // En son eklenen arkadaşı bul (acceptedAt'e göre)
      const sorted = [...friends].sort((a, b) => (b.acceptedAt || 0) - (a.acceptedAt || 0));
      const latestFriend = sorted[0];
      
      if (latestFriend && latestFriend.friendData) {
        const timeSinceAccepted = Date.now() - (latestFriend.acceptedAt?.toMillis?.() || latestFriend.acceptedAt || 0);
        // Sadece son 10 saniye içinde kabul edilenler için bildirim yap
        if (timeSinceAccepted < 10000) {
          triggerNotification("Arkadaşlık İsteği Kabul Edildi", {
            body: `${latestFriend.friendData.displayName} artık arkadaşınız!`,
            sound: "undeafen" // Farklı bir ses
          });
        }
      }
    }
    prevFriendsLength.current = friends.length;
  }, [friends, triggerNotification]);

  // Çağrı durumu 'accepted' olduğunda arayanı da odaya al
  // (aynı kabul birkaç sohbet güncellemesi boyunca görünür kalabilir; odaya iki kez girmesin)
  const handledAcceptedCalls = useRef(new Set());
  const acceptingCallRef = useRef(false);
  useEffect(() => {
    if (!conversations.length || !user?.uid) return;
    
    conversations.forEach(c => {
      if (c.callData?.status === 'accepted' && c.callData?.callerId === user.uid) {
        if (handledAcceptedCalls.current.has(c.id)) return;
        handledAcceptedCalls.current.add(c.id);
        setTimeout(() => handledAcceptedCalls.current.delete(c.id), 5000);
        playSound("join");
        selectConversation(c); // ✅ Açılan DMyi seç (chat butonu için gerekli)
        setShowFriendsPanel(false); // gri panel katmanı odanın üstünde kalmasın
        // Odaya gir
        setCurrentRoom({
           id: "dm_call_" + c.id,
           name: `${c.otherUser?.displayName || "Bilinmeyen"} - ${user.displayName}`,
           type: 'voice',
           isDM: true,
           dmConversationId: c.id
        });
        setCurrentTextChannel(null);
        useChatStore.getState().clearCurrentChannel();
        setViewMode("voice");
        
        // İşlemi tekrarlamamak için call statüsünü temizle
        endCall(c.id);
      }
    });
  }, [conversations, user?.uid, endCall, playSound, selectConversation]);

  // 🕒 Çağrı Temizlik Döngüsü (Arayan bizsek ve cevap gelmediyse)
  useEffect(() => {
    if (!user?.uid) return;
    
    const interval = setInterval(() => {
      const activeCalls = useDMStore.getState().conversations;
      activeCalls.forEach(c => {
        if (c.callData?.status === 'ringing' && c.callData?.callerId === user.uid) {
          const age = getCallAge(c.callData.timestamp);
          if (age > 60000) {
            console.log("☎️ Call timed out for convo:", c.id);
            endCall(c.id);
            playSound("someone-left");
            toast.error("Aradığınız kişi şu anda cevap vermiyor.");
          }
        }
      });
    }, 5000); // 5 saniyede bir kontrol
    
    return () => clearInterval(interval);
  }, [user?.uid, endCall, getCallAge, playSound]);

  const [viewMode, setViewMode] = useState("voice");
  const [showSplash, setShowSplash] = useState(true);
  const [showInstallUpdateSplash, setShowInstallUpdateSplash] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const isElectronApp = typeof window !== "undefined" && !!window.netrex;
    if (!isElectronApp) {
      const check = () => setIsMobile(window.innerWidth <= 768);
      check();
      window.addEventListener("resize", check);
      return () => window.removeEventListener("resize", check);
    }
  }, []);

  // ✅ Voice channel switch confirmation modal
  const [voiceChannelSwitch, setVoiceChannelSwitch] = useState({
    isOpen: false,
    currentChannel: null,
    targetChannel: null,
  });

  // currentRoom null olduğunda modal'ı kapat
  useEffect(() => {
    if (!currentRoom) {
      setVoiceChannelSwitch((prev) => {
        if (prev.isOpen) {
          return { isOpen: false, currentChannel: null, targetChannel: null };
        }
        return prev;
      });
    }
  }, [currentRoom]);

  // Ref'ler: IPC callback'leri sadece 1 kez mount'ta kaydediliyor
  // Eski: [user?.uid, currentRoom, currentTextChannel, currentServer] dependency'si
  //       her state değişiminde onAppWillQuit/onRequestExit callback'lerini yeniden register ediyordu
  // Yeni: [] dependency, ref'ler üzerinden güncel veri okunuyor
  const userRef = useRef(null);
  const currentRoomRef = useRef(null);
  const currentTextChannelRef = useRef(null);
  const currentServerRef = useRef(null);

  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { currentRoomRef.current = currentRoom; }, [currentRoom]);
  useEffect(() => { currentTextChannelRef.current = currentTextChannel; }, [currentTextChannel]);
  useEffect(() => { currentServerRef.current = currentServer; }, [currentServer]);

  // 🎛️ Yetkili biri beni başka sesli kanala taşıdı / sesli kanaldan attı.
  // Komutun gönderen yetkisi useVoiceCommands içinde doğrulanır; burada yalnızca uygulanır.
  const handleVoiceMoved = useCallback(async (cmd) => {
    const room = currentRoomRef.current;
    // Yalnızca o sunucuda bir sesli kanaldaysam taşınırım (başka sunucudayken ya da hiçbir yerde değilken değil)
    if (!room || room._serverId !== cmd.serverId || !cmd.toChannelId || room.id === cmd.toChannelId) return;
    try {
      const snap = await getDoc(doc(db, "servers", cmd.serverId, "channels", cmd.toChannelId));
      if (!snap.exists() || snap.data().type !== "voice") return;
      const server = useServerStore.getState().servers.find((s) => s.id === cmd.serverId);
      setCurrentRoom({
        id: snap.id,
        ...snap.data(),
        _sessionStart: Date.now(),
        _serverId: cmd.serverId,
        _serverName: server?.name,
        _serverIcon: server?.iconUrl,
      });
      toast.info(`${cmd.byName || "Bir yetkili"} sizi "${snap.data().name}" kanalına taşıdı.`);
    } catch (e) {
      console.error("Kanala taşıma uygulanamadı:", e);
    }
  }, []);

  const handleVoiceDisconnected = useCallback((cmd) => {
    const room = currentRoomRef.current;
    if (!room || room._serverId !== cmd.serverId) return;
    playSound("left");
    toast.error(`${cmd.byName || "Bir yetkili"} tarafından sesli kanaldan atıldınız.`, { duration: 8000 });
    setCurrentRoom(null);
  }, [playSound]);

  useVoiceCommands({ userId: user?.uid, onMove: handleVoiceMoved, onDisconnect: handleVoiceDisconnected });

  // --- GRACEFUL EXIT LOGIC ---
  useEffect(() => {
    if (window.netrex && window.netrex.onAppWillQuit) {
      window.netrex.onAppWillQuit(async () => {
        console.log("🧹 Starting graceful shutdown...");
        try {
          const uid = userRef.current?.uid;
          if (uid) {
            await updateDoc(doc(db, "users", uid), {
              presence: "offline",
              lastSeen: serverTimestamp(),
              gameActivity: null,
              currentRoom: null,
            });
          }
          if (currentRoomRef.current) setCurrentRoom(null);
          if (currentTextChannelRef.current) {
            setCurrentTextChannel(null);
            useChatStore.getState().clearCurrentChannel();
          }
          if (currentServerRef.current) useServerStore.getState().clearCurrentServer();
          console.log("✅ Graceful shutdown completed");
        } catch (e) {
          console.error("❌ Cleanup error:", e);
        }
        if (window.netrex?.notifyCleanupComplete) {
          window.netrex.notifyCleanupComplete();
        }
      });
    }

    if (window.netrex && window.netrex.onRequestExit) {
      window.netrex.onRequestExit(async () => {
        if (window.netrex && window.netrex.forceQuitApp) {
          window.netrex.forceQuitApp();
        }
      });
    }

    if (window.netrex && window.netrex.onUpdateRestarting) {
      window.netrex.onUpdateRestarting(() => {
        setShowInstallUpdateSplash(true);
      });
      window.netrex.onUpdateRestartFailed((error) => {
        setShowInstallUpdateSplash(false);
        useUpdateStore.getState().reset();
        if (error) toast.info(error);
      });
    }
  }, []); // ✅ Boş array - IPC callback'ler sadece 1 kez kaydediliyor

  const [infoModal, setInfoModal] = useState({
    isOpen: false,
    title: "",
    message: "",
  });

  const [showCreateServerModal, setShowCreateServerModal] = useState(false);
  const [showJoinServerModal, setShowJoinServerModal] = useState(false);
  const [showAddServerSelectionModal, setShowAddServerSelectionModal] =
    useState(false);

  useEffect(() => {
    initializeAuth();
    useUpdateStore.getState().initialize();
  }, [initializeAuth]);

  // ✅ Friends & DM listeners - başlat/durdur
  useEffect(() => {
    if (user?.uid) {
      startFriendListener(user.uid);
      startRequestListener(user.uid);
      startConversationListener(user.uid);
    }
    return () => {
      stopFriendListeners();
      stopDMListeners();
    };
  }, [user?.uid]);

  // ✅ Otomatik Okundu İşaretleme
  useEffect(() => {
    if (activeConversation?.id && unreadDMCounts[activeConversation.id] > 0) {
      markDMAsRead(activeConversation.id, user?.uid);
    }
  }, [activeConversation?.id, unreadDMCounts, markDMAsRead, user?.uid]);

  useEffect(() => {
    if (!isLoading && showSplash) {
      // Tauri: ana pencere hazır olana kadar GİZLİ (splash yok) → uygulama içi splash'ın bekleme süresine
      // gerek yok, yükleme biter bitmez geçilir.
      const delay = window.netrex?.isTauri ? 0 : 1500;
      const timer = setTimeout(() => setShowSplash(false), delay);
      return () => clearTimeout(timer);
    }
  }, [isLoading, showSplash]);

  // Tauri: ana pencere (gizli) hazır olunca pencereyi göster. Splash yok: uygulama, açılırken
  // beklemeden doğrudan hazır hâlde (gri/boş ekran olmadan) ekrana gelir.
  useEffect(() => {
    if (isLoading || showSplash) return;
    if (!window.netrex?.isTauri || !window.netrex.notifySplashComplete) return;
    // 120 ms: son durum çizilsin (timer kullanılır; gizli pencerede rAF çalışmaz)
    const t = setTimeout(() => window.netrex.notifySplashComplete().catch(() => {}), 120);
    return () => clearTimeout(t);
  }, [isLoading, showSplash]);

  // Server değiştiğinde text channel temizle, voice room'u KORU
  useEffect(() => {
    setCurrentTextChannel(null);
    setShowChatPanel(false);
    setViewMode("voice");
    useChatStore.getState().clearCurrentChannel();
    // Server seçildiğinde friendsMode kapat
    if (currentServer) {
      setFriendsMode(false);
      clearActiveConversation();
    }
  }, [currentServer?.id]);

  // 🛡️ 1. Web & Mobil Kazara Sekme Kapatma / Çıkış Koruması (beforeunload)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.netrex?.isElectron) return; // Masaüstü Electron uygulamasında tarayıcı uyarısı verilmez

    const handleBeforeUnload = (e) => {
      // Kullanıcı oturum açmışsa veya aktif bir görüşmedeyse uyar
      if (user || currentRoom) {
        e.preventDefault();
        e.returnValue = "Netrex'ten ayrılmak istediğinize emin misiniz?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [user, currentRoom]);

  // 📱 2. Mobil Geri Tuşu / Geri Kaydırma (Swipe Back) Koruması (popstate)
  useEffect(() => {
    if (typeof window === "undefined" || window.netrex?.isElectron) return;

    // Sayfa geçmişine bir güvenlik katmanı ekle
    window.history.pushState({ app: "netrex" }, "", window.location.href);

    const handlePopState = () => {
      // Açık modal veya mobil üye çekmecesi varsa önce onu kapat
      if (useServerStore.getState().mobileMemberDrawerOpen) {
        useServerStore.getState().setMobileMemberDrawerOpen(false);
        window.history.pushState({ app: "netrex" }, "", window.location.href);
        return;
      }

      // Açık modal varsa önce onu kapat
      if (
        showCreateServerModal ||
        showJoinServerModal ||
        showAddServerSelectionModal
      ) {
        setShowCreateServerModal(false);
        setShowJoinServerModal(false);
        setShowAddServerSelectionModal(false);
        window.history.pushState({ app: "netrex" }, "", window.location.href);
        return;
      }

      // Aktif DM sohbeti açıksa önce mesaj listesine dön
      if (activeConversation) {
        clearActiveConversation();
        setShowFriendsPanel(true);
        window.history.pushState({ app: "netrex" }, "", window.location.href);
        return;
      }

      // Aktif metin kanalı açıksa kanaldan çık
      if (currentTextChannel) {
        setCurrentTextChannel(null);
        setShowChatPanel(false);
        window.history.pushState({ app: "netrex" }, "", window.location.href);
        return;
      }

      // Sunucu seçiliyse ana sayfaya dön
      if (currentServer) {
        useServerStore.getState().selectServer(null);
        window.history.pushState({ app: "netrex" }, "", window.location.href);
        return;
      }

      // Ana sayfadayken geri çekilirse yanlışlıkla çıkmayı önle
      toast.info("Uygulamadan çıkmak için tarayıcı sekmesini kapatabilirsiniz.");
      window.history.pushState({ app: "netrex" }, "", window.location.href);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [
    showCreateServerModal,
    showJoinServerModal,
    showAddServerSelectionModal,
    activeConversation,
    currentTextChannel,
    currentServer,
    clearActiveConversation,
  ]);

  // ✅ Tümüyle Ana Sayfaya Git (Logo Tıklandığında)
  const handleGoHome = useCallback(() => {
    setFriendsMode(false);
    setShowFriendsPanel(true);
    setCurrentTextChannel(null);
    setShowChatPanel(false);
    clearActiveConversation();
    useServerStore.getState().selectServer(null);
    useChatStore.getState().clearCurrentChannel();
  }, [clearActiveConversation]);

  // ✅ FriendsMode açma/yönetme (ServerRail'den)
  const handleToggleFriendsMode = useCallback(() => {
    if (friendsMode) {
      if (!showFriendsPanel) {
        setShowFriendsPanel(true);
        clearActiveConversation();
      } else {
        // Eğer sunucu ses odasındayken Mesajlardan çıkarsa, onu boşluğa değil sunucusuna geri götür!
        if (currentRoom && !currentRoom.isDM && currentRoom._serverId) {
          useServerStore.getState().selectServer(currentRoom._serverId);
          setFriendsMode(false);
          setShowFriendsPanel(true);
          clearActiveConversation();
          setViewMode("voice");
          useChatStore.getState().setShowChatPanel(true);
          return;
        } else {
          handleGoHome();
          return;
        }
      }
    } else {
      // DM moduna geç, sunucu seçimini kaldır
      setFriendsMode(true);
      setShowFriendsPanel(true);
      useServerStore.getState().selectServer(null);
      clearActiveConversation();
    }
    setViewMode("chat");
    useChatStore.getState().setShowChatPanel(true);
  }, [friendsMode, showFriendsPanel, clearActiveConversation, handleGoHome, currentRoom]);

  // ✅ DM açma handler'ı (arkadaş listesinden mesaj butonuna tıklanınca)
  const handleOpenDM = useCallback(async (friendData) => {
    if (!user?.uid || !friendData?.uid) return;
    setShowFriendsPanel(false);
    await openOrCreateConversation(user.uid, friendData.uid);
    setViewMode("chat");
    useChatStore.getState().setShowChatPanel(true);
  }, [user?.uid, openOrCreateConversation]);

  // ✅ DM sidebar'dan konuşma seçme
  const handleSelectConversation = useCallback((conversation) => {
    // Aynı sohbet açıksa tekrar yükleme yapma
    const currentActive = useDMStore.getState().activeConversation;
    if (currentActive?.id === conversation.id && friendsMode && !showFriendsPanel) {
      setViewMode("chat");
      useChatStore.getState().setShowChatPanel(true);
      return;
    }

    setFriendsMode(true);
    useServerStore.getState().selectServer(null);
    setShowFriendsPanel(false);
    selectConversation(conversation);
    setViewMode("chat");
    useChatStore.getState().setShowChatPanel(true);
  }, [selectConversation, friendsMode, showFriendsPanel]);

  // ✅ DM Arama Başlatma
  const handleStartDMCall = useCallback((callRoomConfig) => {
    setCurrentRoom(callRoomConfig);
    setCurrentTextChannel(null);
    useChatStore.getState().clearCurrentChannel();
    setViewMode("voice");
  }, []);

  // ✅ Friends paneline dön
  const handleOpenFriends = useCallback(() => {
    setShowFriendsPanel(true);
    clearActiveConversation();
  }, [clearActiveConversation]);

  // ✅ Kanal Katılma İşleyicisi (Hem Masaüstü hem Mobil için ortak)
  const handleJoinChannel = useCallback((channel) => {
    console.log("🎤 onJoinChannel called:", channel.name);

    if (channel.type === "voice") {
      if (currentRoom && currentRoom.id !== channel.id) {
        const currentRoomServer = servers.find(
          (s) => s.id === currentRoom._serverId,
        );
        setVoiceChannelSwitch({
          isOpen: true,
          currentChannel: {
            name: currentRoom.name,
            serverName:
              currentRoomServer?.name || "Bilinmeyen Sunucu",
            serverIcon: currentRoomServer?.iconUrl || null,
          },
          targetChannel: {
            name: channel.name,
            serverName: currentServer?.name || "Bilinmeyen Sunucu",
            serverIcon: currentServer?.iconUrl || null,
          },
          onConfirm: () => {
            const roomWithSession = {
              ...channel,
              _sessionStart: Date.now(),
              _serverId: currentServer?.id,
              _serverName: currentServer?.name,
              _serverIcon: currentServer?.iconUrl,
            };
            setCurrentRoom(roomWithSession);
            setCurrentTextChannel(null);
            useChatStore.getState().clearCurrentChannel();
            setViewMode("voice");
            setVoiceChannelSwitch({
              isOpen: false,
              currentChannel: null,
              targetChannel: null,
            });
          },
        });
        return;
      }

      const roomWithSession = {
        ...channel,
        _sessionStart: Date.now(),
        _serverId: currentServer?.id,
        _serverName: currentServer?.name,
        _serverIcon: currentServer?.iconUrl,
      };
      setCurrentRoom(roomWithSession);
      setCurrentTextChannel(null);
      useChatStore.getState().clearCurrentChannel();
      setViewMode("voice");
    } else {
      if (currentTextChannel === channel.id) {
        if (showChatPanel) {
          setShowChatPanel(false);
          setCurrentTextChannel(null);
          useChatStore.getState().clearCurrentChannel();
          setViewMode("voice");
        } else {
          setShowChatPanel(true);
          setViewMode("chat");
        }
      } else {
        setCurrentTextChannel(channel.id);
        setShowChatPanel(true);
        setViewMode("chat");
        useChatStore
          .getState()
          .loadChannelMessages(channel.id, currentServer?.id);
      }
    }
  }, [currentRoom, servers, currentServer, currentTextChannel, showChatPanel]);

  // Sesli bağlantı kartı: oda ekranının DIŞINDAYKEN (Mesajlar, başka sunucu) bağlı olduğunu gösterir.
  // Aynı sunucudayken oda ekranı zaten görünür. DM aramaları kendi ekranında gösterilir, burada yok.
  // Ana Sayfa: sunucu seçili değil, Mesajlar modu kapalı. Sesli odadayken de GERÇEK Ana Sayfa gösterilir
  // (oda arkada bağlı kalır, ActiveRoom sökülmez); odadakiler küçük kutuda canlı görünür.
  const isHomeView = !currentServer && !friendsMode;
  const showMiniWidget = !!currentRoom && !currentRoom.isDM && isHomeView;

  const showVoiceBar =
    !!currentRoom && !currentRoom.isDM && (friendsMode || currentServer?.id !== currentRoom._serverId);

  const handleReturnToRoom = useCallback(() => {
    if (!currentRoom || currentRoom.isDM) return;
    setFriendsMode(false);
    setShowFriendsPanel(false);
    clearActiveConversation();
    if (currentRoom._serverId) useServerStore.getState().selectServer(currentRoom._serverId);
    setCurrentTextChannel(null);
    setViewMode("voice");
    useChatStore.getState().setShowChatPanel(false);
  }, [currentRoom, clearActiveConversation]);

  // ODANIN KENDİ çıkış işlevi (çıkış sesi + Firebase oda kaydı ve ses durumu temizliği + onLeave): kart/kutu bunu çağırır.
  // Yalnızca durumu sıfırlamak çıkış sesini atlıyor ve kullanıcıyı başkalarında "hayalet" bırakıyordu.
  const handleLeaveFromBar = useCallback(() => {
    const roomLeave = useRoomPresenceStore.getState().leaveRoom;
    if (roomLeave) {
      roomLeave();
      return;
    }
    // Yedek (oda henüz yayıncıyı kaydetmediyse): yalnızca sayfa durumu
    setCurrentRoom(null);
    setCurrentTextChannel(null);
    setViewMode("voice");
    setShowChatPanel(false);
    useChatStore.getState().clearCurrentChannel();
  }, [setShowChatPanel]);

  const serverSidebarContent = currentServer ? (
    isServerLoading && channels.length === 0 ? (
      <ServerSidebarSkeleton />
    ) : (
      <ServerSidebar
        key={currentServer.id}
        activeTextChannelId={currentTextChannel}
        onJoinChannel={handleJoinChannel}
      />
    )
  ) : null;

  if (showInstallUpdateSplash) return <InstallUpdateSplash />;
  if (isLoading || showSplash) return <SplashScreen />;

  if (!isAuth) {
    return (
      <LoginPage
        onGoogleLogin={async () => {
          if (window.netrex?.startOAuth) {
            try {
              await window.netrex.startOAuth();
            } catch (error) {
              console.error("Google login failed:", error);
              toast.error("Google ile giriş başarısız oldu");
            }
          } else {
            toast.error(
              "Bu özellik sadece masaüstü uygulamasında kullanılabilir",
            );
          }
        }}
        onAnonymousLogin={async (username) => {
          try {
            await loginAnonymously(username);
            toast.success("Giriş başarılı! Netrex'e hoş geldin.");
          } catch (error) {
            console.error("Anonymous login failed:", error);
            toast.error("Misafir girişi başarısız oldu");
          }
        }}
      />
    );
  }

  return (
    <AppShell
      serverRail={
        <ServerRail
          onOpenCreateModal={() => setShowAddServerSelectionModal(true)}
          isRoomActive={!!currentRoom}
          friendsMode={friendsMode}
          onToggleFriendsMode={handleToggleFriendsMode}
          onGoHome={handleGoHome}
          onSelectDM={handleSelectConversation}
        />
      }
      rightSidebar={
        currentServer ? (
          isServerLoading ? (
            <ServerMemberListSkeleton />
          ) : (
            <ServerMemberList onClose={() => {
              useLayoutStore.getState().setShowMemberList(false);
              useServerStore.getState().setMobileMemberDrawerOpen(false);
            }} />
          )
        ) : null
      }
      sidebarFooter={
        showVoiceBar ? (
          <VoiceConnectedBar room={currentRoom} onReturn={handleReturnToRoom} onLeave={handleLeaveFromBar} />
        ) : null
      }
      rightSidebarKey={currentServer?.id}
      hasRightSidebarContent={!!currentServer}
      // 📱 Mobile props
      friendsMode={friendsMode}
      onGoHome={handleGoHome}
      onToggleFriendsMode={handleToggleFriendsMode}
      onOpenCreateModal={() => setShowAddServerSelectionModal(true)}
      sidebar={
        friendsMode ? (
          /* ✅ Friends Mode: DM Sidebar */
          <DMSidebar
            onSelectConversation={handleSelectConversation}
            onOpenFriends={handleOpenFriends}
            activeConversationId={activeConversation?.id}
            showFriendsPanel={showFriendsPanel}
          />
        ) : serverSidebarContent
      }
    >
      <UpdateNotification />
      <ModalA11yManager />

      {/* ✅ SettingsModal yok - AppShell'deki global instance kullanılıyor */}

      <InfoModal
        isOpen={infoModal.isOpen}
        title={infoModal.title}
        message={infoModal.message}
        onClose={() => setInfoModal({ isOpen: false, title: "", message: "" })}
      />

      <VoiceChannelSwitchModal
        isOpen={voiceChannelSwitch.isOpen}
        currentChannel={voiceChannelSwitch.currentChannel}
        targetChannel={voiceChannelSwitch.targetChannel}
        onClose={() =>
          setVoiceChannelSwitch({
            isOpen: false,
            currentChannel: null,
            targetChannel: null,
          })
        }
        onConfirm={voiceChannelSwitch.onConfirm}
      />

      <IncomingCallModal
        isOpen={!!incomingCallConvo}
        caller={incomingCallConvo?.otherUser}
        onAccept={async () => {
          if (!incomingCallConvo) return;
          // Çift tıklama / bekleme sırasında ikinci kabul "arama sonlandırılmış" uyarısı üretiyordu
          if (acceptingCallRef.current) return;
          acceptingCallRef.current = true;
          let accepted = false;
          try {
            // Accept the call - this will change status to 'accepted'
            accepted = await acceptCall(incomingCallConvo.id);
          } finally {
            setTimeout(() => { acceptingCallRef.current = false; }, 1500);
          }
          if (!accepted) {
            // Arayan bu arada vazgeçtiyse boş odaya girme
            toast.info("Arama sonlandırılmış.", { id: "call-ended" });
            return;
          }
          selectConversation(incomingCallConvo); // ✅
          // Arkadaşlar paneli açıksa gri katman odanın üstünde kalıyordu
          setShowFriendsPanel(false);
          playSound("join");
          // And we join locally immediately
          setCurrentRoom({
             id: "dm_call_" + incomingCallConvo.id,
             name: `${incomingCallConvo.otherUser.displayName} - ${user.displayName}`,
             type: 'voice',
             isDM: true,
             dmConversationId: incomingCallConvo.id
          });
          setCurrentTextChannel(null);
          useChatStore.getState().clearCurrentChannel();
          setViewMode("voice");
        }}
        onDecline={async () => {
          if (!incomingCallConvo) return;
          await endCall(incomingCallConvo.id);
          playSound("someone-left");
        }}
      />

      {incomingCallConvo && (
        <LoopingAudio src="/sounds/call-incoming.mp3" />
      )}

      {outgoingCallConvo && (
        <LoopingAudio src="/sounds/call-send.mp3" />
      )}

      <OutgoingCallModal
        isOpen={!!outgoingCallConvo}
        targetUser={outgoingCallConvo?.otherUser}
        onCancel={async () => {
          if (!outgoingCallConvo) return;
          await endCall(outgoingCallConvo.id);
          playSound("someone-left");
        }}
      />

      <AddServerSelectionModal
        isOpen={showAddServerSelectionModal}
        onClose={() => setShowAddServerSelectionModal(false)}
        onCreateClick={() => {
          setShowAddServerSelectionModal(false);
          setShowCreateServerModal(true);
        }}
        onJoinClick={() => {
          setShowAddServerSelectionModal(false);
          setShowJoinServerModal(true);
        }}
      />

      <CreateServerModal
        isOpen={showCreateServerModal}
        onClose={() => setShowCreateServerModal(false)}
        onJoinClick={() => {
          setShowCreateServerModal(false);
          setShowJoinServerModal(true);
        }}
      />

      <JoinServerModal
        isOpen={showJoinServerModal}
        onClose={() => setShowJoinServerModal(false)}
        onCreateClick={() => {
          setShowJoinServerModal(false);
          setShowCreateServerModal(true);
        }}
      />

      <div className="flex-1 flex flex-col relative overflow-hidden h-full">
        {/* ActiveRoom her zaman mount, sadece visibility değişiyor */}
        <div
          ref={(el) => {
            if (!el) return;
            if (currentRoom && isHomeView) el.setAttribute("inert", "");
            else el.removeAttribute("inert");
          }}
          aria-hidden={currentRoom && isHomeView ? "true" : undefined}
          className={`absolute inset-0 ${currentRoom && !isHomeView ? "z-10 opacity-100" : "z-0 opacity-0 pointer-events-none"}`}
        >
          {currentRoom && (
            <ActiveRoom
              key={currentRoom.id}
              roomName={currentRoom.id}
              displayName={currentRoom.name}
              username={user?.displayName || user?.email || "Misafir"}
              onLeave={() => {
                if (currentRoom.isDM && currentRoom.dmConversationId) {
                  endCall(currentRoom.dmConversationId);
                }
                setCurrentRoom(null);
                setCurrentTextChannel(null);
                setViewMode("voice");
                setShowChatPanel(false);
                useChatStore.getState().clearCurrentChannel();
              }}
              currentTextChannel={currentTextChannel}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              userId={user?.uid}
            />
          )}
        </div>

        {showMiniWidget && (
          <VoiceMiniWidget room={currentRoom} onReturn={handleReturnToRoom} onLeave={handleLeaveFromBar} />
        )}

        {/* Welcome/Chat/Friends/DM screen */}
        <div
          // Gizliyken: Tab ile odaklanma ve ekran okuyucu bu katmana GİRMESİN (opacity-0 yalnızca görseli saklıyordu)
          ref={(el) => {
            if (!el) return;
            const hidden = !!currentRoom && !isHomeView && !(friendsMode && showFriendsPanel);
            if (hidden) el.setAttribute("inert", "");
            else el.removeAttribute("inert");
          }}
          aria-hidden={!!currentRoom && !isHomeView && !(friendsMode && showFriendsPanel) ? "true" : undefined}
          className={`absolute inset-0 ${!currentRoom || isHomeView || (friendsMode && showFriendsPanel) ? "z-[60] bg-[#313338] opacity-100 pointer-events-auto" : "z-0 opacity-0 pointer-events-none"}`}
        >
            {friendsMode ? (
              /* ✅ Friends Mode: Arkadaşlar / DM Conversation */
              <div key="friends-content" className="absolute inset-0">
                {(showFriendsPanel && !currentRoom?.isDM) ? (
                  <FriendsPanel onOpenDM={handleOpenDM} />
                ) : (
                  <DMConversation 
                    onBack={() => {
                        if (currentRoom?.isDM) {
                           setViewMode('voice');
                        } else {
                           handleOpenFriends();
                        }
                    }} 
                    onStartCall={async (conversationId) => {
                      if (!user?.uid) return;
                      await useDMStore.getState().startCall(conversationId, user.uid);
                    }}
                  />
                )}
              </div>
            ) : !showChatPanel ? (
              <div key="welcome-or-channels" className="absolute inset-0">
                {/* 📱 Mobilde sunucu seçiliyse doğrudan sunucu kanallarını göster */}
                {isMobile && currentServer ? (
                  <div className="h-full w-full bg-[#0a0a0c]">
                    {serverSidebarContent}
                  </div>
                ) : (
                  <WelcomeScreen
                    userName={user?.displayName || "Misafir"}
                    version={process.env.NEXT_PUBLIC_APP_VERSION || "3.0.0"}
                  />
                )}
              </div>
            ) : (
              <div key="chat" className="absolute inset-0">
                {currentTextChannel && (
                  <div className="h-full w-full">
                    <StandaloneChatView
                      channelId={currentTextChannel}
                      username={user?.displayName || user?.email || "Misafir"}
                      userId={user?.uid}
                      onBack={() => {
                        setShowChatPanel(false);
                        setCurrentTextChannel(null);
                        useChatStore.getState().clearCurrentChannel();
                      }}
                    />
                  </div>
                )}
              </div>
            )}
        </div>
      </div>
    </AppShell>
  );
}
