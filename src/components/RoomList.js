"use client";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { ref, onValue, off } from "firebase/database";
import { db, rtdb } from "@/src/lib/firebase";
import {
  Volume2,
  Hash,
  Shield,
  Loader2,
  HelpCircle,
} from "lucide-react";
import { useChatStore } from "@/src/store/chatStore";
import { useSettingsStore } from "@/src/store/settingsStore";
import { toast } from "sonner";
import { systemToast } from "@/src/utils/toast";
import {
  CHANNEL_NAME_MAX_LENGTH,
  CHANNEL_NAME_MIN_LENGTH,
  ROOM_NAME_MAX_LENGTH,
  ROOM_NAME_MIN_LENGTH,
} from "@/src/constants/appConfig";
import ConfirmDialog from "./ConfirmDialog";
import ShortcutHelpModal from "./ShortcutHelpModal";

const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID?.trim() || "";

const sanitizeChannelNameInput = (value) =>
  value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
    .slice(0, CHANNEL_NAME_MAX_LENGTH);

const sanitizeRoomNameInput = (value) =>
  value.replace(/[<>]/g, "").slice(0, ROOM_NAME_MAX_LENGTH);

export default function RoomList({
  onJoin,
  user,
  onOpenSettings,
  onJoinTextChannel,
  currentRoom,
  currentTextChannel,
}) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [roomPresence, setRoomPresence] = useState({}); // { roomName: { users: [...] } }

  const {
    textChannels,
    createTextChannel,
    deleteTextChannel,
    unreadCounts, // YENİ: Okunmamış mesaj sayıları
    startTextChannelListener,
    currentChannel,
    showChatPanel,
    toggleChatPanel,
    setShowChatPanel,
    loadChannelMessages,
  } = useChatStore();

  const profileColor = useSettingsStore(state => state.profileColor);
  const userStatus = useSettingsStore(state => state.userStatus);
  const setUserStatus = useSettingsStore(state => state.setUserStatus);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const [isCreatingTextChannel, setIsCreatingTextChannel] = useState(false);
  const [showTextChannelModal, setShowTextChannelModal] = useState(false);
  const [showVoiceRoomModal, setShowVoiceRoomModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newRoomName, setNewRoomName] = useState("");
  const [channelError, setChannelError] = useState("");
  const [roomError, setRoomError] = useState("");
  const [globalError, setGlobalError] = useState("");
  const [hoveredChannel, setHoveredChannel] = useState(null);
  const [showShortcutModal, setShowShortcutModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    description: "",
    confirmLabel: "",
    variant: "danger",
    action: null,
    successMessage: "",
    errorMessage: "",
    itemToDelete: null, // Silinecek öğenin adı
  });
  const [confirmLoading, setConfirmLoading] = useState(false);

  const openConfirmDialog = useCallback((config) => {
    setConfirmDialog({
      open: true,
      variant: "danger",
      confirmLabel: "Onayla",
      successMessage: "",
      errorMessage: "",
      action: null,
      ...config,
    });
  }, []);

  const closeConfirmDialog = useCallback(() => {
    setConfirmLoading(false);
    setConfirmDialog((prev) => ({ ...prev, open: false }));
  }, []);

  const handleConfirmDialog = useCallback(async () => {
    if (!confirmDialog.action) {
      closeConfirmDialog();
      return;
    }
    setConfirmLoading(true);
    try {
      await confirmDialog.action();
      if (confirmDialog.successMessage) {
        toast.success(confirmDialog.successMessage);
      }
      closeConfirmDialog();
    } catch (error) {
      console.error("Confirm action error:", error);
      toast.error(confirmDialog.errorMessage || "İşlem tamamlanamadı.");
      setConfirmLoading(false);
    }
  }, [confirmDialog, closeConfirmDialog]);

  const isAdmin = useMemo(
    () => Boolean(ADMIN_UID && user?.uid === ADMIN_UID),
    [user?.uid]
  );

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "rooms"), (snapshot) => {
      const roomData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      roomData.sort((a, b) => a.name.localeCompare(b.name));
      setRooms(roomData);
      setLoading(false);
    });

    const stopTextChannelListener = startTextChannelListener();

    return () => {
      unsubscribe();
      if (typeof stopTextChannelListener === "function") {
        stopTextChannelListener();
      }
    };
  }, [startTextChannelListener]);

  // Responsive user list limit
  const [maxVisibleUsers, setMaxVisibleUsers] = useState(7);

  useEffect(() => {
    let resizeTimeout = null;
    
    const handleResize = () => {
      // 🚀 THROTTLE: Resize event'lerini throttle et
      if (resizeTimeout) return;
      
      resizeTimeout = setTimeout(() => {
        resizeTimeout = null;
        const height = window.innerHeight;
        if (height < 700) {
          setMaxVisibleUsers(4);
        } else if (height < 900) {
          setMaxVisibleUsers(7);
        } else {
          setMaxVisibleUsers(12);
        }
      }, 150);
    };

    // Initial check
    handleResize();

    window.addEventListener("resize", handleResize, { passive: true });
    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeTimeout) clearTimeout(resizeTimeout);
    };
  }, []);

  // Room presence'leri dinle - state batching ile optimize edilmiş
  const desktopNotifications = useSettingsStore(state => state.desktopNotifications);
  const notifyOnJoin = useSettingsStore(state => state.notifyOnJoin);
  const prevPresenceRef = useRef({});
  // ✅ Stabil key: rooms referansı değişse bile sadece oda listesi değişince yeniden bağlan
  const roomNamesKey = useMemo(() => rooms.map(r => r.name).sort().join(','), [rooms]);

  useEffect(() => {
    if (rooms.length === 0) {
      setRoomPresence({});
      prevPresenceRef.current = {};
      return;
    }

    const roomNames = rooms.map((r) => r.name);
    // ✅ FIX: Tüm presence güncellemelerini tek bir setState'e topla
    // Eski: Her oda için ayrı onSnapshot → ayrı setRoomPresence → N re-render cascade
    // Yeni: Tüm update'ler birikirken pendingUpdate setTimeout(0) ile batching yapıyor
    const batchedPresence = { ...prevPresenceRef.current };
    let pendingFlush = null;

    const scheduleFlush = () => {
      if (pendingFlush) clearTimeout(pendingFlush);
      pendingFlush = setTimeout(() => {
        pendingFlush = null;
        const snapshot = { ...batchedPresence };
        prevPresenceRef.current = snapshot;
        setRoomPresence(snapshot);
      }, 0);
    };

    const unsubscribes = roomNames.map((roomName) => {
      const presenceRef = ref(rtdb, `room_presence/${roomName}`);
      const unsub = onValue(presenceRef, (snap) => {
        const data = snap.val();
        const currentUsers = data ? Object.values(data) : [];
        const prevUsers = batchedPresence[roomName]?.users || [];

        // Bildirim: yeni gelen kullanıcıları tespit et
        if (notifyOnJoin) {
          const newUsers = currentUsers.filter(
            (u) => !prevUsers.some((p) => p.userId === u.userId)
          );
          newUsers.forEach((newUser) => {
            if (newUser.userId !== user?.uid) {
              const username = newUser.username || "Bir kullanıcı";
              const isAppActive = typeof document !== "undefined" && !document.hidden && document.hasFocus();
              const isInSameRoom = currentRoom === roomName;
              if (isAppActive && !isInSameRoom) {
                systemToast({ title: `${username} online oldu`, message: `"${roomName}" odasına katıldı`, type: "join" });
              }
              if (!isAppActive && desktopNotifications) {
                if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
                  try {
                    const n = new Notification(`${username} online oldu`, {
                      body: `"${roomName}" odasına katıldı`,
                      icon: "/favicon.ico",
                      tag: `join-${roomName}-${newUser.userId}-${Date.now()}`,
                      silent: false,
                    });
                    n.onclick = () => { window.netrex?.focusWindow?.() || window.focus(); n.close(); };
                    setTimeout(() => n.close(), 5000);
                  } catch (e) { console.error("Bildirim hatası:", e); }
                }
              }
            }
          });
        }

        // ✅ Batch: state'i güncellemek yerine biriktir
        batchedPresence[roomName] = { users: currentUsers };
        scheduleFlush();
      }, (error) => {
          batchedPresence[roomName] = { users: [] };
          scheduleFlush();
      });
      return unsub; // onValue'nun döndürdüğü fonksiyon dinleyiciyi gerçekten kaldırır (off(..., unsub) kaldırmıyordu)
    });

    return () => {
      if (pendingFlush) clearTimeout(pendingFlush);
      unsubscribes.forEach((unsub) => unsub());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomNamesKey, currentRoom, desktopNotifications, notifyOnJoin, user?.uid]);

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "/") {
        event.preventDefault();
        setShowShortcutModal(true);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  // Kullanıcı menüsü dışına tıklandığında kapat
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showUserMenu && !e.target.closest('[data-user-menu]')) {
        setShowUserMenu(false);
      }
    };
    if (showUserMenu) {
      window.addEventListener("mousedown", handleClickOutside);
      return () => window.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showUserMenu]);

  // --- ODA OLUŞTURMA ---
  const createRoom = async () => {
    if (!isAdmin) {
      setGlobalError("Bu işlem için yetkiniz yok.");
      toast.error("Bu işlem için yetkiniz yok.");
      return;
    }
    setRoomError("");
    setShowVoiceRoomModal(true);
  };

  const handleCreateRoomSubmit = async (e) => {
    e.preventDefault();
    const sanitizedName = sanitizeRoomNameInput(newRoomName.trim());
    if (sanitizedName.length < ROOM_NAME_MIN_LENGTH) {
      setRoomError("Kanal adı en az 3 karakter olmalıdır.");
      return;
    }

    setIsCreating(true);
    setRoomError("");
    try {
      await addDoc(collection(db, "rooms"), {
        name: sanitizedName,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
      setNewRoomName("");
      setShowVoiceRoomModal(false);
      toast.success(`"${sanitizedName}" ses kanalı oluşturuldu.`);
    } catch (error) {
      console.error("Oda oluşturma hatası:", error);
      const message =
        error?.message || "Oda oluşturulamadı. Lütfen tekrar deneyin.";
      setRoomError(message);
      toast.error(message);
    }
    setIsCreating(false);
  };

  // --- KANAL OLUŞTURMA ---
  const handleCreateTextChannel = () => {
    setShowTextChannelModal(true);
  };

  const handleCreateTextChannelSubmit = async (e) => {
    e.preventDefault();
    const sanitizedName = sanitizeChannelNameInput(newChannelName);
    if (!sanitizedName || sanitizedName.length < CHANNEL_NAME_MIN_LENGTH) {
      setChannelError("Kanal adı en az 3 karakter olmalıdır.");
      return;
    }

    setIsCreatingTextChannel(true);
    setChannelError("");
    const result = await createTextChannel(sanitizedName, user?.uid);
    if (!result.success && result.error) {
      setChannelError(result.error);
      toast.error(result.error);
    } else {
      setNewChannelName("");
      setShowTextChannelModal(false);
      toast.success(`#${sanitizedName} kanalı oluşturuldu.`);
    }
    setIsCreatingTextChannel(false);
  };

  // --- KANAL SİLME ---
  const handleDeleteChannel = (e, channel) => {
    e.stopPropagation();
    openConfirmDialog({
      title: "Metin Kanalını Sil",
      description: `Bu kanalı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`,
      confirmLabel: "Kanalı Sil",
      variant: "danger",
      itemToDelete: `#${channel.name}`,
      successMessage: `#${channel.name} kanalı silindi.`,
      errorMessage: "Kanal silinemedi. Lütfen tekrar deneyin.",
      action: async () => {
        const result = await deleteTextChannel(channel.id);
        if (!result.success) {
          throw new Error(result.error || "Kanal silinemedi.");
    }
      },
    });
  };

  // --- ODA SİLME ---
  const handleDeleteRoom = (e, room) => {
    e.stopPropagation();
    openConfirmDialog({
      title: "Ses Kanalını Sil",
      description: `Bu ses kanalını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
      confirmLabel: "Kanalı Sil",
      variant: "danger",
      itemToDelete: room.name,
      successMessage: `"${room.name}" ses kanalı silindi.`,
      errorMessage: "Ses kanalı silinemedi.",
      action: async () => {
      try {
          // Eğer kullanıcı bu kanalda ise önce çıkar
          if (currentRoom === room.name) {
            onJoin(null);
          }
          await deleteDoc(doc(db, "rooms", room.id));
          console.log("✅ Ses kanalı Firebase'den silindi:", room.id);
      } catch (error) {
          console.error("❌ Ses kanalı silme hatası:", error);
          throw error; // ConfirmDialog'a hata fırlat ki kullanıcıya göstersin
      }
      },
    });
  };

  const showCreateButton = isAdmin;

  return (
    <div className="w-sidebar h-full flex flex-col flex-shrink-0 select-none relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a1b1e] via-[#16171a] to-[#111214] pointer-events-none" />
      
      {/* Subtle glow effects */}
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-purple-500/3 to-transparent pointer-events-none" />
      
      {/* Right border */}
      <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-white/10 via-white/5 to-white/10" />
      
      {/* 1. ÜST BAŞLIK - Premium */}
      <div className="relative z-10 px-3 py-4">
        {/* Header card */}
        <div className="flex items-center justify-between">
          {/* Logo ve başlık */}
          <div className="flex items-center gap-3 group">
            {/* Logo container with glow */}
            <div className="relative">
              <div className="absolute inset-0 bg-indigo-500/20 rounded-xl opacity-40 group-hover:opacity-60 transition-opacity duration-300 will-change-opacity" />
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg overflow-hidden">
                <img 
                  src="logo.png" 
                  alt="Netrex" 
                  className="w-10 h-10 object-contain" 
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'block'; }} 
                />
                <span className="text-white font-bold text-lg hidden">N</span>
              </div>
            </div>
            
            <div className="flex flex-col">
              <h1 className="font-bold text-white text-base tracking-tight leading-none">Netrex</h1>
              <span className="text-[10px] text-[#5c5e66] font-medium mt-0.5">Sesli Sohbet</span>
            </div>
          </div>
          
          {/* Sağ butonlar */}
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); setShowShortcutModal(true); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#5c5e66] hover:text-white hover:bg-white/10 transition-all duration-200"
              title="Klavye kısayolları (Ctrl + /)"
            >
              <HelpCircle size={16} />
            </button>
            {showCreateButton && (
              <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-green-500/10 border border-green-500/20">
                <Shield size={14} className="text-green-400" title="Yönetici" />
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Divider */}
      <div className="relative z-10 mx-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      
      {globalError && (
        <div className="relative z-10 mx-3 mt-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-medium flex items-center justify-between gap-4 animate-fadeIn">
          <span>{globalError}</span>
          <button
            onClick={() => setGlobalError("")}
            className="text-red-300 hover:text-white hover:scale-110 transition-all duration-200"
          >
            ×
          </button>
        </div>
      )}

      {/* 2. KANALLAR LİSTESİ - KALDIRILDI */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 space-y-4 pt-4 relative z-10">
         {/* İçerik temizlendi */}
      </div>

      {/* 4. MODALLAR (PORTAL İLE BODY'YE RENDER) */}
      {showTextChannelModal &&
        typeof window !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-md animate-fadeIn p-4">
            {/* Animated background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent pointer-events-none"></div>
            
            <div className="glass-strong w-full max-w-md rounded-3xl shadow-2xl border border-white/20 animate-scaleIn backdrop-blur-2xl bg-gradient-to-br from-[#1e1f22]/95 via-[#25272a]/95 to-[#2b2d31]/95 relative overflow-hidden">
              {/* Top glow effect */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent z-10"></div>
              
              {/* Background particles */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl animate-pulse-slow"></div>
                <div className="absolute bottom-1/4 right-1/4 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl animate-pulse-slow" style={{ animationDelay: "1s" }}></div>
      </div>

              <div className="relative z-10 p-8">
                {/* Header */}
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/30 shadow-soft">
                      <Hash size={20} className="text-indigo-300" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white relative">
                        <span className="relative z-10">Kanal Oluştur</span>
                      </h3>
                      <p className="text-xs text-[#949ba4] font-medium mt-0.5">
              Metin Kanalı
            </p>
                    </div>
                  </div>
                </div>

            <form onSubmit={handleCreateTextChannelSubmit}>
                  <div className="glass-strong rounded-2xl p-6 border border-white/10 shadow-soft-lg mb-6 relative group/card hover:shadow-xl transition-all duration-300">
                    {/* Hover glow */}
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 z-10 pointer-events-none rounded-2xl"></div>
                    
                    <div className="relative z-10">
                      <label className="text-[11px] font-bold text-[#949ba4] uppercase mb-3 flex items-center gap-1.5 block">
                        <Hash size={12} className="text-indigo-400" /> Kanal Adı
              </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#949ba4] text-lg font-medium">
                  #
                </span>
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) =>
                            setNewChannelName(sanitizeChannelNameInput(e.target.value))
                  }
                  placeholder="yeni-kanal"
                          className="w-full bg-[#1e1f22] text-white p-3.5 pl-10 rounded-xl border border-white/10 outline-none font-medium transition-all duration-300 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 focus:bg-[#25272a] placeholder:text-[#4e5058]"
                  autoFocus
                />
              </div>
                      {channelError && (
                        <div className="mt-3 bg-gradient-to-r from-red-500/15 to-red-600/15 text-red-300 p-3 rounded-xl flex items-center gap-2 text-sm border border-red-500/30 shadow-soft backdrop-blur-sm animate-fadeIn">
                          <div className="w-1 h-1 bg-red-400 rounded-full"></div>
                          <span className="font-medium">{channelError}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer buttons */}
                  <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowTextChannelModal(false);
                    setNewChannelName("");
                        setChannelError("");
                  }}
                      onMouseDown={(e) => e.preventDefault()}
                      className="px-6 py-3 text-sm font-semibold text-[#b5bac1] hover:text-white transition-all duration-300 rounded-xl hover:bg-white/5 focus:outline-none"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={!newChannelName.trim() || isCreatingTextChannel}
                      onMouseDown={(e) => e.preventDefault()}
                      className="px-8 py-3 gradient-primary hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] text-white rounded-xl font-semibold transition-all duration-300 hover:scale-105 relative overflow-hidden group/save disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 focus:outline-none"
                >
                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 group-hover/save:opacity-100 transition-opacity duration-300"></div>
                      <span className="relative z-10 flex items-center gap-2">
                        {isCreatingTextChannel && (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        )}
                        {isCreatingTextChannel ? "Oluşturuluyor..." : "Kanal Oluştur"}
                      </span>
                </button>
              </div>
            </form>
          </div>
        </div>
          </div>,
          document.body
      )}

      {showVoiceRoomModal &&
        typeof window !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center backdrop-blur-md animate-fadeIn p-4">
            {/* Animated background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent pointer-events-none"></div>
            
            <div className="glass-strong w-full max-w-md rounded-3xl shadow-2xl border border-white/20 animate-scaleIn backdrop-blur-2xl bg-gradient-to-br from-[#1e1f22]/95 via-[#25272a]/95 to-[#2b2d31]/95 relative overflow-hidden">
              {/* Top glow effect */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent z-10"></div>
              
              {/* Background particles */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl animate-pulse-slow"></div>
                <div className="absolute bottom-1/4 right-1/4 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl animate-pulse-slow" style={{ animationDelay: "1s" }}></div>
              </div>

              <div className="relative z-10 p-8">
                {/* Header */}
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/30 shadow-soft">
                      <Volume2 size={20} className="text-indigo-300" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white relative">
                        <span className="relative z-10">Kanal Oluştur</span>
                      </h3>
                      <p className="text-xs text-[#949ba4] font-medium mt-0.5">
              Ses Kanalı
            </p>
                    </div>
                  </div>
                </div>

            <form onSubmit={handleCreateRoomSubmit}>
                  <div className="glass-strong rounded-2xl p-6 border border-white/10 shadow-soft-lg mb-6 relative group/card hover:shadow-xl transition-all duration-300">
                    {/* Hover glow */}
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 z-10 pointer-events-none rounded-2xl"></div>
                    
                    <div className="relative z-10">
                      <label className="text-[11px] font-bold text-[#949ba4] uppercase mb-3 flex items-center gap-1.5 block">
                        <Volume2 size={12} className="text-indigo-400" /> Kanal Adı
              </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#949ba4]">
                          <Volume2 size={18} className="text-indigo-400/60" />
                </span>
                <input
                  type="text"
                  value={newRoomName}
                          onChange={(e) => setNewRoomName(sanitizeRoomNameInput(e.target.value))}
                  placeholder="Genel Sohbet"
                          className="w-full bg-[#1e1f22] text-white p-3.5 pl-12 rounded-xl border border-white/10 outline-none font-medium transition-all duration-300 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 focus:bg-[#25272a] placeholder:text-[#4e5058]"
                  autoFocus
                />
              </div>
                      {roomError && (
                        <div className="mt-3 bg-gradient-to-r from-red-500/15 to-red-600/15 text-red-300 p-3 rounded-xl flex items-center gap-2 text-sm border border-red-500/30 shadow-soft backdrop-blur-sm animate-fadeIn">
                          <div className="w-1 h-1 bg-red-400 rounded-full"></div>
                          <span className="font-medium">{roomError}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer buttons */}
                  <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowVoiceRoomModal(false);
                    setNewRoomName("");
                        setRoomError("");
                  }}
                      onMouseDown={(e) => e.preventDefault()}
                      className="px-6 py-3 text-sm font-semibold text-[#b5bac1] hover:text-white transition-all duration-300 rounded-xl hover:bg-white/5 focus:outline-none"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={!newRoomName.trim() || isCreating}
                      onMouseDown={(e) => e.preventDefault()}
                      className="px-8 py-3 gradient-primary hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] text-white rounded-xl font-semibold transition-all duration-300 hover:scale-105 relative overflow-hidden group/save disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 focus:outline-none"
                >
                      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 group-hover/save:opacity-100 transition-opacity duration-300"></div>
                      <span className="relative z-10 flex items-center gap-2">
                        {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isCreating ? "Oluşturuluyor..." : "Kanal Oluştur"}
                      </span>
                </button>
              </div>
            </form>
          </div>
        </div>
          </div>,
          document.body
        )}

      <ShortcutHelpModal
        isOpen={showShortcutModal}
        onClose={() => setShowShortcutModal(false)}
      />

      <ConfirmDialog
        isOpen={confirmDialog.open}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
        loading={confirmLoading}
        itemToDelete={confirmDialog.itemToDelete}
        onConfirm={handleConfirmDialog}
        onCancel={closeConfirmDialog}
      />
    </div>
  );
}
