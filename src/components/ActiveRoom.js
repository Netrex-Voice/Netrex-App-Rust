import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { motion, useDragControls, useMotionValue } from "framer-motion";
import { LiveKitRoom, useTracks, AudioTrack, useRoomContext } from "@livekit/components-react";
import { Track, DisconnectReason, ConnectionErrorReason } from "livekit-client";
import "@livekit/components-styles";
import {
  MessageSquare,
  Users,
  ChevronLeft,
  ChevronRight,
  Volume2,
} from "lucide-react";
import SettingsModal from "./SettingsModal";
import UserContextMenu from "./UserContextMenu";
import { toast } from "sonner";

import { useSettingsStore } from "@/src/store/settingsStore";
import { useMicStatusStore } from "@/src/store/micStatusStore";
import { useVoiceProcessor } from "@/src/hooks/useVoiceProcessor";
import { useAdaptiveBandwidth } from "@/src/hooks/useAdaptiveBandwidth";
import { useLatencyOptimizer } from "@/src/hooks/useLatencyOptimizer";
import { effectiveAutoGainControl } from "@/src/utils/micConstraints";
import { useSoundEffects } from "@/src/hooks/useSoundEffects";
import { useAuthStore } from "@/src/store/authStore";
import { useChatStore } from "@/src/store/chatStore";
import { useShallow } from "zustand/react/shallow";
import { useServerStore } from "@/src/store/serverStore";
import { useDMStore } from "@/src/store/dmStore";
import { getLiveKitToken, getLiveKitServerInfo } from "@/src/lib/platformBridge";
import { useApplyParticipantVolumes } from "@/src/hooks/useApplyParticipantVolumes";
import { useSpatialAudio } from "@/src/hooks/useSpatialAudio";
import { useMicGuard } from "@/src/hooks/useMicGuard";
import { useAudioDeviceSync } from "@/src/hooks/useAudioDeviceSync";
import { useCursorShareController } from "@/src/hooks/useCursorShareController";
import { useVoiceGroups } from "@/src/hooks/useVoiceGroups";
import GamesHandler from "@/src/modules/games/GamesHandler";
import { TalkHud } from "@/src/components/active-room/VoiceGroupsUI";
import { useSpatialAudioStore } from "@/src/store/spatialAudioStore";
import SpatialCanvas from "./active-room/SpatialCanvas";
import { db, rtdb } from "@/src/lib/firebase";
import { ref, set, remove, onDisconnect, get, onValue } from "firebase/database";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  onSnapshot,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";
import { styleInjection } from "./active-room/ActiveRoomStyles";

import BottomControls from "./active-room/BottomControls";
import StageManager from "./active-room/StageManager";
import ScreenShareManager from "./active-room/ScreenShareManager";
import GlobalChatListener from "./active-room/GlobalChatListener";
import SettingsUpdater from "./active-room/SettingsUpdater";
import ConnectionStatusIndicator from "./active-room/ConnectionStatusIndicator";
import RoomEventsHandler from "./active-room/RoomEventsHandler";
import ModerationHandler from "./active-room/ModerationHandler";
import WatchPartyManager from "./active-room/WatchPartyManager";
import CallInviteModal from "@/src/components/friends/CallInviteModal";
import OverlayBridge from "./active-room/OverlayBridge";

// --- STYLES ---
// Styles moved to active-room/ActiveRoomStyles.js
const MemoizedBackground = React.memo(({ disableEffects }) => {
  if (disableEffects) return null;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Animasyonları azalttık, static render (massive blur divs removed) */}
    </div>
  );
});

// RemoteMicrophonePlayer: Sadece mikrofon seslerini aktifleştirir, ekran paylaşım sesleri buraya karışmaz.
function RemoteMicrophonePlayer() {
  const tracks = useTracks([Track.Source.Microphone]);
  return (
    <>
      {tracks.map((track) => {
        if (track.participant.isLocal) return null;
        return <AudioTrack key={track.participant.identity} trackRef={track} />;
      })}
    </>
  );
}

// GlobalChatListener moved to active-room/GlobalChatListener.js

// Zayıf internette gönderilen veriyi kademeli azaltır (bkz. useAdaptiveBandwidth)
function AdaptiveBandwidthHandler() {
  useAdaptiveBandwidth();
  return null;
}

// Alıcı tarafı ses gecikmesini düşürür ve ölçer (bkz. useLatencyOptimizer)
function LatencyOptimizerHandler() {
  useLatencyOptimizer();
  return null;
}

// VoiceProcessorHandler
// ✅ FIX: Hook koşulsuz çağrılmalı - ayrı bileşene taşı
function VoiceProcessorInner() {
  useVoiceProcessor();
  return null;
}

function VoiceProcessorHandler() {
  const rawAudioMode = useSettingsStore((state) => state.rawAudioMode);

  // ✅ Volume applicator - Store'daki volume değerlerini track'lere uygula
  useApplyParticipantVolumes();

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log(
        "🎤 VoiceProcessorHandler mounted, rawAudioMode:",
        rawAudioMode,
      );
    }
  }, [rawAudioMode]);

  // ✅ rawAudioMode=true ise voice processor'ı devre dışı bırak (koşulsuz hook ihlali olmadan)
  if (rawAudioMode) return null;
  return <VoiceProcessorInner />;
}

// 🛡️ Mic Guard — "sesiniz karşıya gitmiyor" uyarısı (LiveKitRoom içinde çalışmalı)
function MicGuardHandler({ serverMuted, serverDeafened }) {
  useMicGuard({ serverMuted, serverDeafened });
  useAudioDeviceSync(); // giriş/çıkış cihazı seçimini odaya uygular
  return null;
}

// 🖱️ İşaretçi paylaşımı — gelen mesajlar, izinler ve overlay (odada TEK kez bağlanır)
function CursorShareHandler() {
  useCursorShareController();
  return null;
}

// 🎙️ Konuşma grupları — grup senkronu, mikrofon izinleri ve basılı tut-konuş (odada TEK kez bağlanır)
function VoiceGroupsHandler() {
  useVoiceGroups();
  return <TalkHud />;
}

// 🎧 Spatial Audio Handler — LiveKitRoom içinde çalışmalı
function SpatialAudioHandler({ channelId, userId, deafened }) {
  // deafened: uzamsal modda sağırlaştırma ana ses düğümünden uygulanır (eskiden hiç uygulanmıyordu)
  useSpatialAudio({ channelId, userId, deafened });
  return null;
}

// 🎧 Spatial Canvas Wrapper — Floating draggable panel
function SpatialCanvasWrapper({ channelId, localUserId }) {
  const spatialEnabled = useSpatialAudioStore(s => s.enabled);
  const showWindow = useSpatialAudioStore(s => s.showWindow);
  const setShowWindow = useSpatialAudioStore(s => s.setShowWindow);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const dragControls = useDragControls();

  const [winSize, setWinSize] = useState({ w: typeof window !== "undefined" ? window.innerWidth : 1920, h: typeof window !== "undefined" ? window.innerHeight : 1080 });
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    
    // Bounds clamping function
    const clampPos = (w, h) => {
      const contentW = isExpanded ? 670 : 350;
      const contentH = isExpanded ? 730 : 410;
      
      const minX = -w + contentW + 32; 
      const minY = -h + contentH + 160;
      
      const curX = dragX.get();
      const curY = dragY.get();

      if (curX < minX) import("framer-motion").then(({ animate }) => animate(dragX, minX, { type: 'spring', damping: 25, stiffness: 300 }));
      else if (curX > 16) import("framer-motion").then(({ animate }) => animate(dragX, 16, { type: 'spring', damping: 25, stiffness: 300 }));

      if (curY < minY) import("framer-motion").then(({ animate }) => animate(dragY, minY, { type: 'spring', damping: 25, stiffness: 300 }));
      else if (curY > 96) import("framer-motion").then(({ animate }) => animate(dragY, 96, { type: 'spring', damping: 25, stiffness: 300 }));
    };

    clampPos(window.innerWidth, window.innerHeight);

    const handleResize = () => {
      setWinSize({ w: window.innerWidth, h: window.innerHeight });
      clampPos(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isExpanded, dragX, dragY]);

  if (!spatialEnabled || !showWindow) return null;

  return (
    <motion.div
      style={{ x: dragX, y: dragY }}
      className="fixed right-4 bottom-24 z-[300] bg-[#111214]/95 border border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-2xl"
      drag
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      dragConstraints={{ 
        left: -winSize.w + (isExpanded ? 670 : 350) + 32, 
        right: 16, 
        top: -winSize.h + (isExpanded ? 730 : 410) + 160, 
        bottom: 96 
      }}
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
    >
      <SpatialCanvas
        channelId={channelId}
        localUserId={localUserId}
        isExpanded={isExpanded}
        onToggleExpand={() => setIsExpanded(!isExpanded)}
        dragControls={dragControls}
        onClose={() => setShowWindow(false)}
      />
    </motion.div>
  );
}

// Inline styles backup to ensure animations work even if import fails
// ✅ CPU OPT: boxShadow kaldırıldı - sadece opacity animasyonu
const criticalStyles = `
  @keyframes pulse-glow {
    0%, 100% { opacity: 0.1; }
    50% { opacity: 0.2; }
  }
`;

function DeafenManager({ isDeafened, serverDeafened }) {
  const room = useRoomContext?.();

  useEffect(() => {
    const shouldMute = isDeafened || serverDeafened;
    const applyMute = () => {
      // 1. Tüm HTML Audio elementlerini sustur
      document.querySelectorAll("audio").forEach((el) => {
        // Uzamsal ses motoru bu öğeyi KENDİ sustardı (sesi AudioContext'ten çalıyor); açılırsa aynı ses iki kez çalar
        if (!shouldMute && el.dataset.netrexSpatial === "1") return;
        el.muted = shouldMute;
        if (shouldMute) {
          el.volume = 0;
        }
      });

      // 2. Doğrudan LiveKit remote tracklerini de sustur
      if (room?.remoteParticipants) {
        room.remoteParticipants.forEach((participant) => {
          participant.audioTrackPublications?.forEach((pub) => {
            if (pub.track) {
              if (shouldMute) {
                pub.track.setVolume?.(0);
              }
              if (pub.track.attachedElements) {
                pub.track.attachedElements.forEach((el) => {
                  if (!shouldMute && el.dataset.netrexSpatial === "1") return;
                  el.muted = shouldMute;
                  if (shouldMute) el.volume = 0;
                });
              }
            }
          });
        });
      }
    };

    applyMute();

    // Audio elementi eklendiğinde/değiştiğinde tetikle
    const obs = new MutationObserver((mutations) => {
      let hasAudioChange = false;
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeName === "AUDIO" || (node.querySelector && node.querySelector("audio"))) {
            hasAudioChange = true;
            break;
          }
        }
        if (hasAudioChange) break;
      }
      if (hasAudioChange) applyMute();
    });

    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [isDeafened, serverDeafened, room]);

  return null;
}

// -- PREMIUM LOADING SPLASH COMPONENT --
const LoadingSplash = ({
  title,
  description,
  loadingText = "Bağlanıyor...",
  disableBackgroundEffects,
}) => {
  const LOGO_PATH =
    "M470 2469 c-126 -21 -259 -116 -318 -227 -63 -119 -62 -98 -62 -952 0 -451 4 -800 10 -835 20 -127 120 -269 232 -330 102 -56 87 -55 954 -55 703 0 807 2 855 16 149 44 264 158 315 314 17 51 19 114 22 825 2 540 0 794 -8 850 -29 204 -181 362 -380 394 -81 13 -1540 13 -1620 0z m816 -1035 l339 -396 3 71 c3 70 2 72 -38 120 l-40 48 2 274 3 274 132 3 c131 3 133 2 137 -20 3 -13 4 -257 3 -543 l-2 -520 -105 -3 -105 -2 -235 276 c-129 153 -281 331 -337 396 l-103 119 0 -75 c0 -73 1 -76 40 -121 l40 -47 -2 -271 -3 -272 -135 0 -135 0 -3 530 c-1 292 0 536 3 543 3 8 33 12 103 12 l98 0 340 -396z";
  const strokeColor = "#a855f7";

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#0a0a0c] relative overflow-hidden z-50">
      <MemoizedBackground disableEffects={disableBackgroundEffects} />

      <style>{`
        @keyframes cpuFriendlyOrbit1 { 0% { transform: translate(0, 0) scale(1); } 50% { transform: translate(50px, 30px) scale(1.2); } 100% { transform: translate(0, 0) scale(1); } }
        @keyframes cpuFriendlyOrbit2 { 0% { transform: translate(0, 0) scale(1.2); } 50% { transform: translate(-40px, 60px) scale(1); } 100% { transform: translate(0, 0) scale(1.2); } }
        @keyframes cpuFriendlySpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes cpuFriendlyLoading { 0% { transform: translateX(-150%); } 100% { transform: translateX(350%); } }
      `}</style>

      {!disableBackgroundEffects && (
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-[-20%] left-[-10%] w-[80%] h-[70%] rounded-full bg-indigo-600/15 blur-[120px]"
            style={{ animation: 'cpuFriendlyOrbit1 10s linear infinite', willChange: 'transform' }}
          />
          <div
            className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[60%] rounded-full bg-purple-600/15 blur-[120px]"
            style={{ animation: 'cpuFriendlyOrbit2 15s linear infinite', willChange: 'transform' }}
          />
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center gap-10 max-w-lg text-center px-4">
        {/* Animated Logo Frame */}
        <div className="relative w-28 h-28 mb-4">
          <div
            className="absolute inset-0 rounded-[35px]"
            style={{
              width: 140,
              height: 140,
              left: -14,
              top: -14,
              border: `1px solid transparent`,
              background: `linear-gradient(45deg, ${strokeColor}20, transparent, ${strokeColor}10) border-box`,
              WebkitMask: `linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)`,
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
              animation: 'cpuFriendlySpin 12s linear infinite',
              willChange: 'transform'
            }}
          />
          <div
            className="absolute inset-0 rounded-[30px] border border-white/5"
            style={{ width: 120, height: 120, left: -4, top: -4 }}
          />

          <svg
            viewBox="0 0 2560 2560"
            className="relative z-10 w-full h-full"
            style={{ filter: `drop-shadow(0 0 15px ${strokeColor}40)` }}
          >
            <g transform="translate(0, 2560) scale(1, -1)">
              <motion.path
                d={LOGO_PATH}
                fill="transparent"
                stroke={strokeColor}
                strokeWidth={40}
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0, opacity: 0.5 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                  repeatType: "reverse",
                }}
              />
              <path d={LOGO_PATH} fill="#a855f7" className="opacity-20" />
            </g>
          </svg>
        </div>

        {/* Text Section */}
        <div>
          <h2 className="text-2xl font-bold text-white tracking-[0.1em] mb-3">
            {title}
          </h2>
          {description && (
            <p className="text-[#949ba4] text-sm leading-relaxed mb-6">
              {description}
            </p>
          )}
        </div>

        {/* Indeterminate Loading Bar */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-48 h-[6px] bg-[#2a2b36] rounded-full overflow-hidden border border-white/20 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]">
            <div
              className="absolute top-0 left-0 h-full w-[40%] rounded-full z-10 bg-gradient-to-r from-transparent via-[#c084fc] to-transparent shadow-[0_0_15px_rgba(192,132,252,0.6)]"
              style={{ animation: 'cpuFriendlyLoading 1.8s ease-in-out infinite', willChange: 'transform' }}
            />
          </div>
          <span className="text-white/40 text-[10px] font-bold uppercase tracking-[0.3em] text-center">
            {loadingText}
          </span>
        </div>
      </div>
    </div>
  );
};

// --- ANA BİLEŞEN ---
export default function ActiveRoom({
  roomName,
  displayName,
  username,
  onLeave,
  currentTextChannel,
  userId,
  isDMCall, // new prop check
}) {
  // --- GLOBAL INPUT LISTENER (CPU OPTIMIZATION) ---
  useEffect(() => {
    let timeoutId;
    if (window.netrex) {
      // 🚀 Bağlantı başlangıcında Main Process'i yormamak için biraz beklet
      // Bu, WebRTC handshake'inin (bağlantı kurma) takılmadan tamamlanmasını sağlar
      console.log(
        "🎤 Global input dinleyicisi için bekleniyor (Handshake koruması)...",
      );
      timeoutId = setTimeout(() => {
        console.log(
          "🎤 Odaya girildi: Global input dinleyicisi başlatılıyor...",
        );
        window.netrex.startInputListener();
      }, 1500);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (window.netrex) {
        console.log(
          "👋 Odadan çıkıldı: Global input dinleyicisi durduruluyor...",
        );
        window.netrex.stopInputListener();
      }
    };
  }, []);

  const { user } = useAuthStore();
  const [token, setToken] = useState("");
  const [showSettingsLocal, setShowSettingsLocal] = useState(false);
  const [showCallInviteModal, setShowCallInviteModal] = useState(false);

  const serverId = useServerStore((state) => state.currentServer?.id);
  const currentServerName = useServerStore((state) => state.currentServer?.name);
  const activeConversation = useDMStore((state) => state.activeConversation);

  // Voice State and Settings Modal - Global Store'dan al
  const isMuted = useSettingsStore((state) => state.isMuted);
  const isDeafened = useSettingsStore((state) => state.isDeafened);
  const toggleMute = useSettingsStore((state) => state.toggleMute);
  const toggleDeaf = useSettingsStore((state) => state.toggleDeaf);

  // ✅ Sadece local state - global SettingsModal AppShell'de render ediliyor
  // store'daki showSettingsModal'ı OKUMA - çift modal açılmasına sebep olur
  const showSettings = showSettingsLocal;
  const setShowSettings = (value) => {
    setShowSettingsLocal(value);
  };

  const [isCameraOn, setIsCameraOn] = useState(false);
  const [hideIncomingVideo, setHideIncomingVideo] = useState(false);
  const [serverMuted, setServerMuted] = useState(false);
  const [serverDeafened, setServerDeafened] = useState(false);
  // New States for enhanced moderation feedback
  const [mutedBy, setMutedBy] = useState(null);
  const [deafenedBy, setDeafenedBy] = useState(null);
  const [mutedAt, setMutedAt] = useState(null);
  const [deafenedAt, setDeafenedAt] = useState(null);

  const [showVoicePanel, setShowVoicePanel] = useState(true);
  const {
    showChatPanel,
    setShowChatPanel,
    currentChannel,
    clearCurrentChannel,
    chatPosition,
    setChatPosition,
    chatWidth,
    setChatWidth,
  } = useChatStore(
    // Seçicisiz abonelik her sohbet mesajında/yazıyor bilgisinde tüm odayı yeniden render ediyordu
    useShallow((s) => ({
      showChatPanel: s.showChatPanel,
      setShowChatPanel: s.setShowChatPanel,
      currentChannel: s.currentChannel,
      clearCurrentChannel: s.clearCurrentChannel,
      chatPosition: s.chatPosition,
      setChatPosition: s.setChatPosition,
      chatWidth: s.chatWidth,
      setChatWidth: s.setChatWidth,
    })),
  );
  const [contextMenu, setContextMenu] = useState(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [pinnedStreamIds, setPinnedStreamIds] = useState([]); // ✅ Faz 2: Çoklu yayın desteği
  const [connectionError, setConnectionError] = useState(null);
  const [hasConnectedOnce, setHasConnectedOnce] = useState(false); // Bağlantı başarılı oldu mu?
  const [isRotatingSession, setIsRotatingSession] = useState(false); // Sunucu rotasyonu yapılıyor mu?
  const connectionTimeoutRef = useRef(null); // Bağlantı timeout'u
  const hasConnectedOnceRef = useRef(false); // Ref ile takip (timeout için)

  // 🚀 v5.2: LiveKit Server Pool
  const [serverUrl, setServerUrl] = useState(
    process.env.NEXT_PUBLIC_LIVEKIT_URL || "",
  );
  const [serverIndex, setServerIndex] = useState(0);
  const [serverPoolMode, setServerPoolMode] = useState(false);
  const [serverCount, setServerCount] = useState(1);
  const rotationCountRef = useRef(0); // Sonsuz döngüyü önlemek için sayaç
  const MAX_ROTATIONS = 3; // Maksimum rotation sayısı
  const poolDocRef = useRef(null); // Firebase pool document reference
  const serverIndexRef = useRef(serverIndex);
  const serverCountRef = useRef(serverCount);
  const serverPoolModeRef = useRef(serverPoolMode);
  const isLocalRotationRef = useRef(false); // 🔥 FIX: Kendi rotation'ımızı onSnapshot'ın tekrar tetiklemesini önle

  // Ref'leri state ile senkronize tut
  useEffect(() => {
    serverIndexRef.current = serverIndex;
  }, [serverIndex]);
  useEffect(() => {
    serverCountRef.current = serverCount;
  }, [serverCount]);
  useEffect(() => {
    serverPoolModeRef.current = serverPoolMode;
  }, [serverPoolMode]);

  // RESET STATE ON MOUNT/UPDATE
  // Odadan çıkıp tekrar girildiğinde veya key değiştiğinde state'in temiz olduğundan emin ol
  useEffect(() => {
    setConnectionError(null);
    setHasConnectedOnce(false);
    setIsRotatingSession(false);
    hasConnectedOnceRef.current = false;
    // Token'ı burda sıfırlama, alttaki useEffect token alacak
  }, [roomName]); // Oda ismi değiştiğinde (zaten key değişiyor ama yine de)

  // 🚀 v5.2: Firebase'den aktif sunucu indeksini dinle (tüm kullanıcılar senkronize olsun)
  useEffect(() => {
    if (!serverPoolMode) return;

    poolDocRef.current = doc(db, "system", "livekitPool");
    let isInitialSnapshot = true; // 🔥 FIX: İlk snapshot'ı atla (token fetch zaten hallediyor)

    // Real-time listener
    const unsubscribe = onSnapshot(
      poolDocRef.current,
      async (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          const firebaseIndex = data.activeServerIndex || 0;

          // 🔥 FIX: İlk snapshot'ta sadece ref'i senkronize et, rotation tetikleme
          // Token fetch zaten Firebase'den doğru index'i okuyor ve sunucuyu ayarlıyor
          if (isInitialSnapshot) {
            isInitialSnapshot = false;
            serverIndexRef.current = firebaseIndex;
            console.log(`📡 onSnapshot: İlk yükleme, ref senkronize: ${firebaseIndex}`);
            return;
          }

          // 🔥 FIX: Kendi rotation'ımızın sonucuysa, sadece ref'i güncelle ve atla
          if (isLocalRotationRef.current) {
            console.log(`📡 onSnapshot: Kendi rotation'ımız algılandı (index: ${firebaseIndex}), çift tetikleme önlendi.`);
            serverIndexRef.current = firebaseIndex;
            return;
          }

          // Eğer Firebase'deki index farklıysa (BAŞKA biri tarafından değiştirildi), senkronize ol
          if (firebaseIndex !== serverIndexRef.current) {
            console.log(`📡 onSnapshot: Başka client sunucu değiştirdi: ${serverIndexRef.current} → ${firebaseIndex}`);
            // Ref'i HEMEN güncelle ki tekrar tetiklenmesin
            serverIndexRef.current = firebaseIndex;
            try {
              const serverInfo =
                await getLiveKitServerInfo(firebaseIndex);
              if (serverInfo && serverInfo.url) {
                const sanitizedIndex = serverInfo.serverIndex;
                setServerIndex(sanitizedIndex);
                serverIndexRef.current = sanitizedIndex;
                setServerUrl(serverInfo.url);

                setIsRotatingSession(true);
                setToken("");
                setHasConnectedOnce(false);
                hasConnectedOnceRef.current = false;

                if (connectionTimeoutRef.current) {
                  clearTimeout(connectionTimeoutRef.current);
                  connectionTimeoutRef.current = null;
                }

                setTimeout(() => {
                  setIsRotatingSession(false);
                }, 5000);

                console.log(
                  `🔄 Sunucu değişikliği senkronize edildi: ${sanitizedIndex}`,
                );

                toast.error("Bağlantı limitine ulaşıldı!", {
                  description: `Sunucu kotası dolduğu için yeni bir odaya aktarılıyorsunuz (Server: ${sanitizedIndex + 1}).`,
                  duration: 6000,
                  position: "top-center",
                });
              }
            } catch (e) {
              console.error("Firebase sunucu değişikliği uygulanamadı:", e);
            }
          }
        }
      },
      (error) => {
        console.error("Firebase pool listener hatası:", error);
      },
    );

    return () => unsubscribe();
  }, [serverPoolMode]); // serverIndex dependency'den kaldırıldı - ref kullanıyoruz

  // Firebase'de pool document'ı oluştur/güncelle (ilk bağlantıda)
  useEffect(() => {
    if (!serverPoolMode || serverCount <= 1) return;

    const initializePoolDoc = async () => {
      try {
        const poolRef = doc(db, "system", "livekitPool");
        const poolDoc = await getDoc(poolRef);

        if (!poolDoc.exists()) {
          // İlk kez oluştur
          await setDoc(poolRef, {
            activeServerIndex: 0,
            serverCount: serverCount,
            lastRotation: serverTimestamp(),
            createdAt: serverTimestamp(),
          });
          console.log("✅ Firebase LiveKit pool oluşturuldu");
        }
      } catch (e) {
        console.error("Firebase pool init hatası:", e);
      }
    };

    initializePoolDoc();
  }, [serverPoolMode, serverCount]);

  // Yükleme ekranı metni: bağlantı kuruldu, mikrofon/ses işlemcisi hazırlanıyor mu
  const micPublished = useMicStatusStore((s) => s.published);
  const noiseSuppressionSetting = useSettingsStore((state) => state.noiseSuppression);
  const noiseSuppressionMode = useSettingsStore((state) => state.noiseSuppressionMode);
  // RNNoise / standart mod açıkken tarayıcının kendi gürültü bastırması kapalı olmalı: ikisi üst üste
  // binince ses "suyun altında" gibi olur ve CPU boşa gider (SettingsUpdater ile aynı kural).
  const noiseSuppression =
    noiseSuppressionSetting && (noiseSuppressionMode === "none" || !noiseSuppressionMode);
  const echoCancellation = useSettingsStore((state) => state.echoCancellation);
  const autoGainControlSetting = useSettingsStore((state) => state.autoGainControl);
  const autoGainControl = effectiveAutoGainControl(autoGainControlSetting, noiseSuppressionMode);
  const disableAnimations = useSettingsStore(
    (state) => state.disableAnimations,
  );
  const disableBackgroundEffects = useSettingsStore(
    (state) => state.disableBackgroundEffects,
  );
  const videoCodec = useSettingsStore((state) => state.videoCodec);
  const videoResolution = useSettingsStore((state) => state.videoResolution);
  const videoFrameRate = useSettingsStore((state) => state.videoFrameRate);
  const enableCamera = useSettingsStore((state) => state.enableCamera);
  const videoId = useSettingsStore((state) => state.videoId);

  // Inject Global Animation Disable Config
  useEffect(() => {
    if (disableAnimations) {
      const styleId = "disable-animations-global";
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.innerHTML = `
          *, *::before, *::after {
            transition-duration: 0s !important;
            transition-delay: 0s !important;
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            scroll-behavior: auto !important;
          }
        `;
        document.head.appendChild(style);
      }
      return () => {
        const el = document.getElementById(styleId);
        if (el) el.remove();
      };
    }
  }, [disableAnimations]);
  const { playSound } = useSoundEffects();
  const channels = useServerStore((s) => s.channels);

  // NOT: useLocalParticipant hook'u sadece LiveKitRoom içinde çalışır.
  // Mikrofon senkronizasyonu MicrophoneSyncHandler bileşeninde yapılır (LiveKitRoom içinde).

  const roomDisplayName = useMemo(() => {
    if (displayName) return displayName;
    const channel = channels?.find((c) => c.id === roomName);
    return channel?.name || roomName;
  }, [displayName, channels, roomName]);

  // currentTextChannel veya activeConversation null olduğunda paneli kapat
  useEffect(() => {
    if (!currentTextChannel && !activeConversation && showChatPanel) {
      setShowChatPanel(false);
    }
  }, [currentTextChannel, activeConversation, showChatPanel, setShowChatPanel]);

  // currentTextChannel ile currentChannel senkronizasyonu
  useEffect(() => {
    if (currentTextChannel && currentChannel?.id !== currentTextChannel) {
      // currentTextChannel set edilmiş ama currentChannel farklıysa, currentChannel'ı güncelle
      // Bu durumda loadChannelMessages zaten çağrılmış olmalı, sadece kontrol ediyoruz
    } else if (!currentTextChannel && currentChannel) {
      // currentTextChannel null ama currentChannel set edilmişse, temizle
      clearCurrentChannel();
    }
  }, [currentTextChannel, currentChannel, clearCurrentChannel]);

  // Not: Metin kanalına tıklama artık RoomList'te handle ediliyor (toggle mantığı ile)
  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener("mousedown", closeMenu);
    return () => window.removeEventListener("mousedown", closeMenu);
  }, []);

  // settingsStore'dan mute/deafen durumlarını sıfırlamak için set fonksiyonunu al
  const settingsStore = useSettingsStore;

  useEffect(() => {
    // Room değiştiğinde state'leri sıfırla (eski room'dan temiz çıkış için)
    setToken(""); // Token'ı sıfırla ki eski room'dan disconnect olsun
    setConnectionError(null);
    setIsReconnecting(false);
    setHasConnectedOnce(false);
    hasConnectedOnceRef.current = false;
    setPinnedStreamIds([]); // Aktif yayınları sıfırla
    setIsCameraOn(false); // Kamera durumunu sıfırla

    // ÖNEMLİ: Odaya her bağlanıldığında mute/deafen durumlarını sıfırla
    // Bu, önceki oturumdan kalan görsel durumun gerçek durumla senkronize olmasını sağlar
    settingsStore.setState({ isMuted: false, isDeafened: false });

    // Timeout'u temizle
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
  }, [roomName, username, userId]);

  // Token fetch useEffect - SADECE ilk bağlantıda veya rotasyon bittiğinde çalışmalı
  useEffect(() => {
    // ✅ FIX: Eğer zaten bağlandıysa veya bekleme ekranındaysa (rotasyon) işlemi durdur
    if (hasConnectedOnce || isRotatingSession) {
      return;
    }

    (async () => {
      try {
        {
          // 🚀 v5.2: Server pool - önce sunucu bilgisini al
          let currentServerIndex = serverIndex;
          let currentServerUrl = serverUrl;

          try {
            // V5.5 HIZLANDIRMA: Electron IPC ve Firebase Network çağrılarını Paralelleştir
            const serverInfoPromise =
              getLiveKitServerInfo(currentServerIndex);

            // Firebase sorgusunu önden başlat ki bağlantı süresinden tasarruf edelim (%30-50 hız artışı)
            const poolRef = doc(db, "system", "livekitPool");
            const poolDocPromise = getDoc(poolRef).catch((e) => {
              console.warn("Firebase pool ön yükleme hatası:", e);
              return null;
            });

            // Sonuçları bekle
            const serverInfo = await serverInfoPromise;

            if (serverInfo && serverInfo.poolMode) {
              setServerPoolMode(true);
              serverPoolModeRef.current = true; // ✅ Ref'i anında güncelle

              setServerCount(serverInfo.serverCount || 1);
              serverCountRef.current = serverInfo.serverCount || 1; // ✅ Ref'i anında güncelle

              // Pool modu aktif - Önden başlattığımız Firebase sonucunu al
              try {
                const poolDoc = await poolDocPromise;

                if (poolDoc && poolDoc.exists()) {
                  const data = poolDoc.data();
                  let firebaseIndex =
                    typeof data.activeServerIndex === "number"
                      ? data.activeServerIndex
                      : 0;

                  // 🔥 KRİTİK: Eğer Firebase index'i bozuksa (-1 vb.) otomatik düzelt
                  if (
                    firebaseIndex < 0 ||
                    firebaseIndex >= (serverInfo.serverCount || 1)
                  ) {
                    console.warn(
                      `📡 Firebase index geçersiz (${firebaseIndex}), repair başlatılıyor...`,
                    );
                    await setDoc(
                      poolRef,
                      {
                        activeServerIndex: 0,
                        lastRotation: serverTimestamp(),
                        repairAction: "invalid_index_boot_fix",
                      },
                      { merge: true },
                    );
                    firebaseIndex = 0;
                  }

                  console.log(`📡 Firebase aktif sunucu: ${firebaseIndex}`);

                  const activeServerInfo =
                    await getLiveKitServerInfo(firebaseIndex);
                  if (activeServerInfo && activeServerInfo.url) {
                    currentServerUrl = activeServerInfo.url;
                    currentServerIndex = activeServerInfo.serverIndex;
                  }
                } else {
                  console.log("📡 Firebase pool dökümanı bulunamadı.");
                }
              } catch (firebaseError) {
                console.warn(
                  "Firebase pool okunamadı, varsayılan sunucu kullanılıyor:",
                  firebaseError,
                );
              }
            } else if (serverInfo) {
              // Tek sunucu modu - serverInfo'dan URL al
              currentServerUrl = serverInfo.url || currentServerUrl;
              currentServerIndex = serverInfo.serverIndex || 0;
              setServerPoolMode(false);
              serverPoolModeRef.current = false;
            }

            setServerUrl(currentServerUrl);
            setServerIndex(currentServerIndex);
            serverIndexRef.current = currentServerIndex; // ✅ Ref'i anında güncelle

            rotationCountRef.current = 0; // Başarılı bağlantıda sayacı sıfırla
            console.log(
              `🔌 LiveKit server: ${currentServerUrl} (index: ${currentServerIndex}, pool: ${serverInfo?.poolMode}, count: ${serverInfo?.serverCount})`,
            );
          } catch (serverInfoError) {
            console.warn(
              "⚠️ Server info alınamadı, default kullanılıyor:",
              serverInfoError,
            );
          }

          // Use userId directly as identity to prevent ghost participants
          // generateLiveKitIdentity adds device suffix which causes duplicates on refresh
          const identity = userId;

          // Get token with stable identity, display name, and server index
          const t = await getLiveKitToken(
            roomName,
            identity,
            username,
            currentServerIndex,
          );
          setToken(t);

          // 20 saniye içinde bağlantı kurulamazsa hata göster
          connectionTimeoutRef.current = setTimeout(() => {
            // Eğer hala bağlanmadıysa hata göster
            if (!hasConnectedOnceRef.current) {
              setConnectionError(
                `Odaya bağlanılamadı (Timeout). URL: ${currentServerUrl}`,
              );
            }
          }, 20000); // 20 saniye
        }
      } catch (e) {
        console.error("Token alma hatası:", e);
        // Token alınamazsa hemen hata göster (bu farklı bir durum)
        setConnectionError("Token alınamadı. Lütfen tekrar deneyin.");
      }
    })();

    return () => {
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
    };
  }, [roomName, username, userId, hasConnectedOnce, isRotatingSession]); // ✅ Removed serverIndex/serverUrl - they're set INSIDE this effect
  // 🛡️ GLOBAL PRESENCE DEDUPLICATION
  // ──────────────────────────────────────────────────
  // user_voice_state/{userId} = { roomName, timestamp }
  // Kullanıcının hangi odada olduğunu global olarak takip eder.
  // Yeni odaya bağlanmadan önce eski odadan otomatik temizler.
  // ──────────────────────────────────────────────────

  const presenceQueueRef = useRef(Promise.resolve());
  const queuePresenceUpdate = useCallback((updateFn) => {
    presenceQueueRef.current = presenceQueueRef.current
      .then(() => updateFn())
      .catch((err) => console.error("Presence queue error:", err));
    return presenceQueueRef.current;
  }, []);

  /**
   * Kullanıcıyı eski odasından temizle (varsa).
   * user_voice_state/{userId} dökümanını kontrol eder.
   */
  const presenceShouldExistRef = useRef(false); // true iken kaydımız silinirse bekçi geri yazar
  const cleanupOldRoomPresence = useCallback(async () => {
    if (!userId) return;
    try {
      const stateRef = ref(rtdb, `user_voice_state/${userId}`);
      const stateSnap = await get(stateRef);
      
      if (stateSnap.exists()) {
        const oldRoomName = stateSnap.val().roomName;
        
        if (oldRoomName) {
          console.log(`🧹 Eski oda presence temizleniyor (RTDB): ${oldRoomName}`);
          const presenceRef = ref(rtdb, `room_presence/${oldRoomName}/${userId}`);
          await remove(presenceRef);
        }
      }
    } catch (error) {
      console.warn("Eski oda presence temizleme hatası:", error);
    }
  }, [userId]);

  /**
   * user_voice_state/{userId} dökümanını güncelle
   */
  const setVoiceState = useCallback(async (newRoomName) => {
    if (!userId) return;
    try {
      const stateRef = ref(rtdb, `user_voice_state/${userId}`);
      if (newRoomName) {
        await set(stateRef, {
          roomName: newRoomName,
          timestamp: Date.now()
        });
        // 🚀 HAYALET KULLANICI ÖNLEYİCİ: Bağlantı koparsa RTDB'den sil
        onDisconnect(stateRef).remove();
      } else {
        await remove(stateRef);
      }
    } catch (error) {
      console.warn("Voice state güncelleme hatası:", error);
    }
  }, [userId]);

  /**
   * Belirtilen odadan kullanıcıyı çıkar
   */
  const removeFromRoomPresence = useCallback(async (targetRoomName) => {
    if (!userId || !targetRoomName) return;
    try {
      const presenceRef = ref(rtdb, `room_presence/${targetRoomName}/${userId}`);
      await remove(presenceRef);
    } catch (error) {
      console.error("Room presence çıkarma hatası:", error);
    }
  }, [userId]);

  // Component unmount veya room değiştiğinde cleanup
  useEffect(() => {
    return () => {
      presenceShouldExistRef.current = false;
      // Component unmount olduğunda Firebase'den temizle
      if (userId && roomName) {
        removeFromRoomPresence(roomName);
        setVoiceState(null);
      }
    };
  }, [roomName, username, userId, removeFromRoomPresence, setVoiceState]);

  const handleManualLeave = useCallback(async () => {
    playSound("left");

    // Firebase'den kullanıcıyı çıkar (room presence + voice state)
    presenceShouldExistRef.current = false;
    if (userId && roomName) {
      await removeFromRoomPresence(roomName);
      await setVoiceState(null);
    }

    onLeave();
  }, [userId, roomName, onLeave, playSound, removeFromRoomPresence, setVoiceState]);

  // Bağlantı başarılı olduğunda
  const handleConnected = useCallback(async () => {
    hasConnectedOnceRef.current = true;
    setHasConnectedOnce(true);
    setIsReconnecting(false);
    setConnectionError(null);
    // Timeout'u temizle
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    console.log("LiveKit bağlantısı başarılı");

    // 🛡️ ÖNCELİKLE: Eski odadan temizle (duplicate prevention)
    await cleanupOldRoomPresence();

    // Firebase'e kullanıcıyı ekle (room presence)
    if (userId && roomName) {
      try {
        const presenceRef = ref(rtdb, `room_presence/${roomName}/${userId}`);
        const userData = {
          userId,
          username,
          photoURL: user?.photoURL || null,
          isMuted: useSettingsStore.getState().isMuted,
          isDeafened: useSettingsStore.getState().isDeafened,
        };
        
        presenceShouldExistRef.current = true;
        await set(presenceRef, userData);
        // 🚀 HAYALET KULLANICI ÖNLEYİCİ: Bağlantı koparsa RTDB'den odadaki kaydı sil
        onDisconnect(presenceRef).remove();

        // 🛡️ Voice state'i güncelle — artık bu odadayım
        await setVoiceState(roomName);
      } catch (error) {
        console.error("Room presence ekleme hatası:", error);
      }
    }
  }, [userId, roomName, username, user?.photoURL, cleanupOldRoomPresence, queuePresenceUpdate, setVoiceState]);

  // 🛡️ Presence kendini onarsın: RTDB soketi anlık koparsa (ağ dalgalanması, uyku) sunucu onDisconnect ile
  // kaydımızı siler; LiveKit bağlı kaldığı için kimse geri yazmazdı ve kullanıcı sol listeden kaybolurdu.
  // `.info/connected` tekrar true olunca kayıt (ve onDisconnect) yeniden kurulur.
  useEffect(() => {
    if (!hasConnectedOnce || !userId || !roomName) return;
    const connectedRef = ref(rtdb, ".info/connected");
    let first = true;
    const unsub = onValue(connectedRef, async (snap) => {
      if (snap.val() !== true) return;
      if (first) {
        first = false; // ilk değer: normal katılım akışı zaten yazıyor
        return;
      }
      try {
        const presenceRef = ref(rtdb, `room_presence/${roomName}/${userId}`);
        const existing = await get(presenceRef);
        if (!existing.exists()) {
          const s = useSettingsStore.getState();
          await set(presenceRef, {
            userId,
            username,
            photoURL: user?.photoURL || null,
            isMuted: s.isMuted,
            isDeafened: s.isDeafened,
          });
        }
        onDisconnect(presenceRef).remove();
        await setVoiceState(roomName);
      } catch (e) {
        console.warn("Room presence yeniden yazılamadı:", e);
      }
    });
    return () => unsub();
  }, [hasConnectedOnce, userId, roomName, username, user?.photoURL, setVoiceState]);

  // 🛡️ Presence bekçisi: LiveKit'te odadayken kendi kaydımız dışarıdan silinirse geri yaz.
  // Kısa kopmada eski RTDB bağlantısının geç tetiklenen onDisconnect().remove()'u yeni yazdığımız kaydı silebiliyor
  // (ya da handleDisconnect'in remove'u handleConnected'ın set'inden sonra işleniyor) → kullanıcı listeden kaybolur.
  // Bilerek silme durumlarında (ayrılma, kopma) presenceShouldExistRef false olduğundan geri yazılmaz.
  useEffect(() => {
    if (!hasConnectedOnce || !userId || !roomName) return;
    const presenceRef = ref(rtdb, `room_presence/${roomName}/${userId}`);
    let timer = null;
    const unsub = onValue(presenceRef, (snap) => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (snap.exists() || !presenceShouldExistRef.current) return;
      timer = setTimeout(async () => {
        timer = null;
        if (!presenceShouldExistRef.current) return;
        try {
          const s = useSettingsStore.getState();
          await set(presenceRef, {
            userId,
            username,
            photoURL: user?.photoURL || null,
            isMuted: s.isMuted,
            isDeafened: s.isDeafened,
          });
          onDisconnect(presenceRef).remove();
          await setVoiceState(roomName);
        } catch (e) {
          console.warn("Room presence bekçisi geri yazamadı:", e);
        }
      }, 500);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [hasConnectedOnce, userId, roomName, username, user?.photoURL, setVoiceState]);

  // Sync isMuted and isDeafened in real-time with debouncing
  useEffect(() => {
    if (!hasConnectedOnce || isReconnecting || !userId || !roomName) return;

    const delayDebounceFn = setTimeout(async () => {
       try {
         const presenceRef = ref(rtdb, `room_presence/${roomName}/${userId}`);
         const snapshot = await get(presenceRef);
         if (snapshot.exists()) {
            const currentData = snapshot.val();
            if (currentData.isMuted !== isMuted || currentData.isDeafened !== isDeafened) {
                await set(presenceRef, { ...currentData, isMuted, isDeafened });
            }
         }
       } catch(e) {
         console.error("Room presence mute state sync error:", e);
       }
    }, 250); // 250ms debounce

    return () => clearTimeout(delayDebounceFn);
  }, [isMuted, isDeafened, hasConnectedOnce, isReconnecting, userId, roomName]);

  // Bağlantı hatası (sadece kritik hatalar için)
  // 🚀 v5.2: Server pool - hata durumunda sonraki sunucuya geç
  // Hoisted above handleDisconnect to allow dependency reference
  const handleError = useCallback(async (error) => {
    console.error("LiveKit bağlantı hatası:", error);

    const errorMessage = error?.message || "";
    // LiveKit bir bağlantıyı reddedince hata nesnesi `reason` (NotAllowed...) ve HTTP `status` taşır; mesaj ise
    // sunucunun ham cevabıdır ve "quota" gibi bir kelime içermeyebilir. Metne bağımlı kalmayalım.
    const errStatus = typeof error?.status === "number" ? error.status : null;
    const errReason = typeof error?.reason === "number" ? error.reason : null;
    console.warn("🔎 LiveKit hata ayrıntısı:", {
      name: error?.name,
      message: errorMessage,
      status: errStatus,
      reason: errReason,
      reasonName: error?.reasonName,
      hasConnectedOnce: hasConnectedOnceRef.current,
      serverIndex: serverIndexRef.current,
    });
    // Sunucu ulaşılabilir ama bizi reddetti (4xx/5xx): kota dolu, plan limiti, geçersiz anahtar vb.
    // Başka sunucu denemek mantıklı. Salt ağ kopukluğunda (status yok) bu tetiklenmez.
    const isServerRefusal =
      errStatus !== null &&
      (errStatus === 402 || errStatus === 403 || errStatus === 429 || errStatus >= 500 ||
        (errReason === ConnectionErrorReason.NotAllowed && errStatus >= 400));

    // Quota/limit hataları - server pool ile çözülebilir
    const quotaErrors = [
      "quota",
      "rate limit",
      "limit exceeded",
      "limit reached",
      "resource exhausted",
      "too many requests",
      "connection limit",
      "participant limit",
      "minutes exceeded",
      "free tier",
      "429",
      "503",
      "server_shutdown",
    ];

    const isQuotaError =
      isServerRefusal ||
      quotaErrors.some((q) => errorMessage.toLowerCase().includes(q.toLowerCase()));

    // Server pool modunda ve quota hatası aldıysak
    // NOT: isQuotaError false olsa bile, bağlantı hatası da rotation tetikleyebilir
    const isConnectionFailure =
      !isQuotaError &&
      [
        "connection failed",
        "could not connect",
        "websocket error",
        "timeout",
        "network error",
        "disconnect:",
        // LiveKit istemcisinin gerçek bağlantı hata metinleri ("could not connect" bunlardan hiçbirini yakalamıyordu)
        "could not establish signal connection",
        "could not establish pc connection",
        "room connection has timed out",
        "websocket got closed during",
        "server was not reachable",
        "did not receive join response",
      ].some((c) => errorMessage.toLowerCase().includes(c.toLowerCase()));

    // 🚀 v5.6: Ref bazlı kontrol (Stale closure koruması)
    const currentPoolMode = serverPoolModeRef.current;
    const currentLocalIndex = serverIndexRef.current;
    const currentLocalCount = serverCountRef.current;

    if (currentPoolMode && (isQuotaError || isConnectionFailure)) {
      // Sonsuz döngü koruması
      if (rotationCountRef.current >= MAX_ROTATIONS) {
        console.error(
          `❌ Maksimum rotation sayısına ulaşıldı (${MAX_ROTATIONS}). Tüm sunucular dolu olabilir.`,
        );
        setConnectionError(
          `Tüm LiveKit sunucuları dolu. Lütfen daha sonra tekrar deneyin.`,
        );
        return;
      }

      rotationCountRef.current++;
      console.warn(
        `⚠️ LiveKit hatası algılandı, rotasyon denemesi ${rotationCountRef.current}/${MAX_ROTATIONS}`,
      );

      try {
        // 🔥 FIX: Kendi rotation'ımızı işaretle - onSnapshot'ın tekrar tetiklenmesini önle
        isLocalRotationRef.current = true;

        const poolRef = doc(db, "system", "livekitPool");
        const poolDoc = await getDoc(poolRef);

        let targetIndex =
          (currentLocalIndex + 1) % Math.max(2, currentLocalCount);
        let firebaseActiveIndex = currentLocalIndex;
        let firebaseServerCount = currentLocalCount;

        if (poolDoc.exists()) {
          const data = poolDoc.data();
          firebaseActiveIndex =
            typeof data.activeServerIndex === "number"
              ? data.activeServerIndex
              : currentLocalIndex;
          firebaseServerCount = data.serverCount || currentLocalCount;

          // 🔥 KRİTİK CHECK: Eğer Firebase'deki index bozuksa (örn: -1) veya çok eskiyse, FORCE-REFRESH yapalım
          const isInvalidInFirebase =
            firebaseActiveIndex < 0 ||
            firebaseActiveIndex >= firebaseServerCount;

          if (
            !isInvalidInFirebase &&
            firebaseActiveIndex !== currentLocalIndex
          ) {
            console.log(
              `📡 Firebase zaten başkası tarafından güncellenmiş: ${currentLocalIndex} → ${firebaseActiveIndex}. Oraya yönleniliyor.`,
            );
            targetIndex = firebaseActiveIndex;
          } else {
            // Eğer Firebase hâlâ bizim hatayı aldığımız bozuk sunucudaysa VEYA index bozuksa, bir sonrakine GEÇ ve YAZ
            targetIndex =
              (Math.max(0, firebaseActiveIndex) + 1) %
              Math.max(2, firebaseServerCount);
            console.log(
              `📡 Sunucu döndürme BAŞLIYOR... Write to Firebase: ${targetIndex} (Previous: ${firebaseActiveIndex})`,
            );

            // 🔥 FIX: Ref'i YAZMA'DAN ÖNCE güncelle ki onSnapshot çift tetiklemesin
            serverIndexRef.current = targetIndex;

            await setDoc(
              poolRef,
              {
                activeServerIndex: targetIndex,
                lastRotation: serverTimestamp(),
                lastError: errorMessage,
                lastErrorTime: serverTimestamp(),
                serverCount: firebaseServerCount,
              },
              { merge: true },
            );

            console.log(
              "✅ Firebase 'activeServerIndex' başarıyla güncellendi:",
              targetIndex,
            );
          }
        } else {
          console.warn(
            "⚠️ Firebase pool dökümanı bulunamadı, lokal rotasyon yapılıyor.",
          );
        }

        const serverInfo =
          await getLiveKitServerInfo(targetIndex);

        if (serverInfo && serverInfo.url) {
          console.log(
            `🚀 Yeni sunucuya bağlanılıyor: ${serverInfo.url} (Index: ${targetIndex})`,
          );
          setServerIndex(targetIndex);
          serverIndexRef.current = targetIndex; // 🔥 FIX: Ref'i anında güncelle
          setServerUrl(serverInfo.url);
          setConnectionError(null);

          setToken("");
          setHasConnectedOnce(false);
          hasConnectedOnceRef.current = false;
          setIsRotatingSession(true);

          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }

          setTimeout(() => {
            setIsRotatingSession(false);
            isLocalRotationRef.current = false; // 🔥 FIX: Rotation bitti, onSnapshot tekrar dinleyebilir
          }, 5000);
          // --------------------------------------------

          // Kullanıcıya bilgi verici Modal / Toast göster
          toast.warning("Sunucu Değiştiriliyor", {
            description:
              "Mevcut sunucunun kapasitesi dolduğu için sizi yeni bir sunucuya aktarıyoruz. Lütfen bekleyin...",
            duration: 8000,
            position: "top-center",
          });

          console.log(
            `🔄 LiveKit server rotated: ${serverIndexRef.current} → ${serverInfo.serverIndex}`,
          );
          return; // Hata gösterme, yeniden dene
        }
      } catch (rotationError) {
        console.error("Server rotation hatası:", rotationError);
      }
    }

    // Sadece başarılı bağlantıdan sonra hata olursa göster
    if (hasConnectedOnceRef.current) {
      setConnectionError(
        `${errorMessage || "Bağlantı hatası oluştu."} (URL: ${serverUrl})`,
      );
    }
    // İlk bağlantı hatasında sadece timeout'ta hata göster
  }, [serverUrl]);

  // Bağlantı koptuğunda (sadece başarılı bağlantıdan sonra)
  const handleDisconnect = useCallback(async (reason) => {
    console.log(
      `LiveKit bağlantısı koptu: ${reason} (${DisconnectReason[Number(reason)] ?? "?"}), sunucu index: ${serverIndexRef.current}`,
    );

    // 🚀 v5.2: Disconnect reason'ı kontrol et - quota/limit hatası olabilir
    // LiveKit quota aşıldığında doğrudan disconnect eder, "error" event'i fırlatmaz

    // Enum kontrolü (daha güvenli)
    const reasonNum = Number(reason);

    // KESİNLİKLE ROTATION YAPILMAMASI GEREKEN DURUMLAR
    // 1: CLIENT_INITIATED (Kullanıcı kendi çıktı)
    // 2: DUPLICATE_IDENTITY (Başka yerden girdi)
    // 10: ROOM_CLOSED (Oda kapandı - normal kapanış)
    if (
      reasonNum === DisconnectReason.CLIENT_INITIATED ||
      reasonNum === DisconnectReason.DUPLICATE_IDENTITY ||
      reasonNum === DisconnectReason.ROOM_CLOSED
    ) {
      console.log(`ℹ️ Normal disconnect (${reason}), rotation yapılmayacak.`);
      return;
    }

    // ROTATION YAPILMASI GEREKEN KRİTİK DURUMLAR
    // 3: SERVER_SHUTDOWN (Sunucu kapandıysa/restart atıldıysa kesin değişim gerekir)
    // NOT: JOIN_FAILURE (7) tek başına yeterli değil, internet kopukluğu da olabilir.
    // O yüzden sadece SERVER_SHUTDOWN'u enum olarak kabul ediyoruz.
    const isCriticalDisconnect = reasonNum === DisconnectReason.SERVER_SHUTDOWN;

    // String kontrolü (EN ÖNEMLİ KISIM)
    // Kullanıcının belirttiği kesin "kota/limit" hataları buraya eklenmeli
    const reasonStr = String(reason || "").toLowerCase();
    const quotaDisconnectReasons = [
      "quota",
      "rate limit",
      "limit exceeded",
      "limit reached",
      "resource exhausted",
      "too many requests",
      "429",
      "connection limit",
      "participant limit",
      "minutes limit",
      "minutes exceeded",
      "free tier",
      "server_shutdown",
    ];

    // Sadece tam eşleşme varsa (veya server shutdown ise)
    const isQuotaTextMatch = quotaDisconnectReasons.some((q) =>
      reasonStr.includes(q),
    );

    if ((isCriticalDisconnect || isQuotaTextMatch) && serverPoolModeRef.current) {
      console.warn(
        `⚠️ Critical Disconnect (${reason}) indicates STRICT quota error, triggering pool rotation...`,
      );

      let errorDesc = `Disconnect: ${reason}`;
      if (reasonNum === DisconnectReason.SERVER_SHUTDOWN)
        errorDesc += " (server_shutdown)";
      if (isQuotaTextMatch) errorDesc += " (quota_limit_detected)";

      // handleError quota kontrolünü ve rotation'ı yapacak
      await handleError(new Error(errorDesc));
      return;
    }

    // Sadece başarılı bağlantıdan sonra koparsa "Bağlantı Koptu" göster
    if (hasConnectedOnceRef.current) {
      setIsReconnecting(true);
    }

    // Firebase'den kullanıcıyı çıkar (cleanup + voice state)
    if (userId && roomName) {
      presenceShouldExistRef.current = false; // bilerek siliyoruz: bekçi geri yazmasın
      await removeFromRoomPresence(roomName);
      await setVoiceState(null);
    }
  }, [userId, roomName, handleError, removeFromRoomPresence, setVoiceState]);
  // ✅ Join sesi sadece 1 kez çalsın (token rotation'da tekrar çalmasın)
  const joinSoundPlayedRef = useRef(false);
  useEffect(() => {
    if (token && !joinSoundPlayedRef.current) {
      joinSoundPlayedRef.current = true;
      playSound("join");
    }
  }, [token]);
  // Oda değişince sıfırla
  useEffect(() => {
    joinSoundPlayedRef.current = false;
  }, [roomName]);
  const handleUserContextMenu = (e, participant) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      participant,
      isLocal: participant.isLocal,
      roomName: roomName,
    });
  };

  // 🔴 ÖNCELİKLİ HATA KONTROLÜ
  // Eğer connectionError varsa, Token olmasa bile hatayı göster!
  if (connectionError && !hasConnectedOnce) {
    return (
      <div className="absolute inset-0 z-50 bg-[#0a0a0c]/95 flex flex-col items-center justify-center backdrop-blur-md p-4 animate-nds-fade-in">


        {/* Error Card */}
        <div className="relative z-10 w-full max-w-md">
          {/* Card glow */}
          <div className="absolute -inset-1 bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-3xl blur-xl opacity-60" />

          {/* Card */}
          <div className="relative bg-gradient-to-br from-[#1a1b1e]/95 to-[#111214]/95 backdrop-blur-xl rounded-2xl border border-red-500/20 p-6 sm:p-8 text-center">
            {/* Icon */}
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/10 flex items-center justify-center border border-red-500/20">
              <svg
                className="w-8 h-8 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h2 className="text-xl font-bold mb-2 text-white">
              Bağlantı Hatası
            </h2>
            <p className="text-[#949ba4] mb-6 text-sm">{connectionError}</p>

            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={() => {
                  setConnectionError(null);
                  setHasConnectedOnce(false);
                  hasConnectedOnceRef.current = false;
                  setToken(""); // Token'ı sıfırla ki yeniden fetch etsin

                  {
                    const identity = userId;
                    // Token alma işlemini yeniden başlat
                    getLiveKitToken(
                        roomName,
                        identity,
                        username,
                        serverIndex,
                      )
                      .then((t) => {
                        setToken(t);
                        if (connectionTimeoutRef.current) {
                          clearTimeout(connectionTimeoutRef.current);
                        }
                        connectionTimeoutRef.current = setTimeout(() => {
                          if (!hasConnectedOnceRef.current) {
                            setConnectionError(
                              "Odaya bağlanılamadı. Lütfen tekrar deneyin.",
                            );
                          }
                        }, 20000);
                      })
                      .catch((e) => {
                        console.error("Token hatası:", e);
                        setConnectionError(
                          "Token alınamadı. Lütfen tekrar deneyin.",
                        );
                      });
                  }
                }}
                className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl font-medium text-white text-sm hover:shadow-[0_0_30px_rgba(99,102,241,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                Tekrar Dene
              </button>
              <button
                onClick={handleManualLeave}
                className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-xl font-medium text-[#949ba4] text-sm hover:bg-white/10 hover:text-white transition-all duration-200"
              >
                Çık
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 🔄 Rotasyon / Sunucu Değiştirme Bekleme Ekranı
  if (isRotatingSession) {
    return (
      <LoadingSplash
        title="Oda Sunucusu Değiştiriliyor"
        description={
          <>
            Mevcut sunucunun tam doluluğa ulaşması sebebiyle kapasite aşıldı.
            <br />
            Hemen arkada sizi çok daha rahat bir odaya aktarıyoruz, lütfen
            ayrılmayınız...
          </>
        }
        loadingText="Aktarılıyor..."
        disableBackgroundEffects={disableBackgroundEffects}
      />
    );
  }

  // Token yoksa Loading göster
  if (!token) {
    return (
      <LoadingSplash
        title="Güvenli Hat Kuruluyor"
        loadingText="Oluşturuluyor..."
        disableBackgroundEffects={disableBackgroundEffects}
      />
    );
  }

  return (
    <LiveKitRoom
      // KEY: ONLY roomName changes should remount - serverIndex changes are handled by serverUrl prop
      key={roomName}
      // DÜZELTME: video={false} yapıyoruz ki otomatik yönetim manuel fonksiyonumuzla çakışmasın.
      video={false}
      // DÜZELTME: audio={false} yapıyoruz ki her gelen ses (ekran paylaşımı vs) anında otomatik çalmaya başlamasın.
      audio={false}
      token={token}
      // 🚀 v5.2: Server pool - dinamik URL
      serverUrl={serverUrl}
      data-lk-theme="default"
      className="flex-1 flex flex-col bg-gradient-to-b from-[#1a1b1f] to-[#0e0f12]"
      // Quota-Efficient Connection Options
      connectOptions={{
        autoSubscribe: true,
        // Adaptive streaming for lower bandwidth usage
        dynacast: true,
        // Faster participant timeout (seconds) - helps clear ghost participants quicker
        // Note: This affects server-side participant timeout
        peerConnectionTimeout: 10000, // 10 seconds to establish WebRTC connection
      }}
      // Room options for robust reconnection handling
      options={{
        audioCaptureDefaults: {
          echoCancellation,
          noiseSuppression,
          autoGainControl,
        },
        // Enable automatic reconnection
        reconnect: true,
        // Disconnect cleanly when window closes
        disconnectOnPageLeave: true,
        // Stop tracks when disconnecting (prevents lingering audio)
        stopLocalTrackOnUnpublish: true,
        // Adaptive stream for bandwidth efficiency
        adaptiveStream: true,
      }}
      // Handle disconnect event immediately
      onDisconnected={(reason) => {
        console.log("🔌 LiveKitRoom disconnected:", reason);
      }}
      // 🚀 v5.2: LiveKitRoom built-in onError - bağlantı hataları için
      // Bu, LiveKit SDK'nın kendi error handling mekanizması
      onError={(error) => {
        console.error("🔌 LiveKitRoom onError:", error);
        handleError(error);
      }}
    >
      <MemoizedBackground disableEffects={disableBackgroundEffects} />
      <RemoteMicrophonePlayer />
      <GlobalChatListener
        showChatPanel={showChatPanel}
        setShowChatPanel={setShowChatPanel}
      />
      <VoiceProcessorHandler />
      <AdaptiveBandwidthHandler />
      <LatencyOptimizerHandler />
      <SpatialAudioHandler channelId={roomName} userId={userId} deafened={isDeafened || serverDeafened} />
      <MicGuardHandler serverMuted={serverMuted} serverDeafened={serverDeafened} />
      <CursorShareHandler />
      <VoiceGroupsHandler />
      <OverlayBridge
        channelName={roomDisplayName}
        serverName={currentServerName}
        isDMCall={isDMCall}
        onLeave={handleManualLeave}
        onMuteToggle={toggleMute}
      />
      <SettingsUpdater
        isMuted={isMuted}
        serverMuted={serverMuted}
        isDeafened={isDeafened}
        serverDeafened={serverDeafened}
      />
      <RoomEventsHandler
        onConnected={handleConnected}
        onDisconnected={handleDisconnect}
        onError={handleError}
        roomName={roomName}
        roomDisplayName={roomDisplayName}
        userId={userId}
        username={username}
      />

      <ModerationHandler
        serverId={serverId}
        setServerMuted={setServerMuted}
        setServerDeafened={setServerDeafened}
        setMutedBy={setMutedBy}
        setDeafenedBy={setDeafenedBy}
        setMutedAt={setMutedAt}
        setDeafenedAt={setDeafenedAt}
        serverMuted={serverMuted}
        serverDeafened={serverDeafened}
        isDeafened={isDeafened}
        isMuted={isMuted}
        playSound={playSound}
        onKicked={onLeave}
      />

      {/* LiveKit bağlantısı kurulana kadar loading overlay */}
      {!hasConnectedOnce && !connectionError && (
        <div className="absolute inset-0 z-50 bg-[#0a0a0c]/95">
          <LoadingSplash
            title="Bağlantı Kuruluyor"
            loadingText={micPublished ? "Mikrofon hazırlanıyor..." : "Lütfen bekleyin..."}
            disableBackgroundEffects={disableBackgroundEffects}
          />
        </div>
      )}

      {/* İlk bağlantı hatası (Artık yukarıda handle ediliyor, burası LiveKitRoom error'ları için) */}
      {connectionError && !hasConnectedOnce && (
        <div className="absolute inset-0 z-50 bg-transparent" />
      )}

      {/* Bağlantı koptu (başarılı bağlantıdan sonra) */}
      {isReconnecting && hasConnectedOnce && (
        <div className="absolute inset-0 z-50 bg-[#0a0a0c]/95 flex flex-col items-center justify-center backdrop-blur-md p-4">


          {/* Content */}
          <div className="relative z-10 flex flex-col items-center">
            {/* Pulsing icon */}
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-amber-500/20 rounded-full blur-2xl animate-pulse" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/10 flex items-center justify-center border border-amber-500/20 animate-pulse">
                <svg
                  className="w-8 h-8 text-amber-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </div>
            </div>

            <h2 className="text-xl font-bold text-white mb-2">
              Bağlantı Koptu
            </h2>
            <p className="text-[#949ba4] mb-6 text-sm">
              Yeniden bağlanmaya çalışılıyor...
            </p>

            <button
              onClick={handleManualLeave}
              className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 rounded-xl font-medium text-white text-sm hover:shadow-[0_0_30px_rgba(239,68,68,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
            >
              Vazgeç ve Çık
            </button>
          </div>
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{ __html: styleInjection + criticalStyles }}
      />

      <DeafenManager isDeafened={isDeafened} serverDeafened={serverDeafened} />
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* ÜST BAR - Premium Glassmorphism Tasarım */}
      <div className="h-14 sm:h-16 relative flex items-center px-4 sm:px-6 justify-between shrink-0 z-20 select-none overflow-hidden">
        {/* Premium gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1b1f]/95 via-[#141518]/95 to-[#0e0f12]/95 backdrop-blur-xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent" />

        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/4 w-[200px] h-[80px] bg-indigo-500/[0.06] blur-[60px]" />
          <div className="absolute top-0 right-1/4 w-[200px] h-[80px] bg-purple-500/[0.04] blur-[60px]" />
        </div>

        {/* Top glow line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />

        {/* Bottom border */}
        <div className="absolute bottom-0 left-0 right-0 h-px">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent animate-pulse-slow" />
        </div>

        {/* Sol taraf - Kanal bilgisi */}
        <div className="flex items-center gap-3 sm:gap-4 overflow-hidden relative z-10 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 group">
            {/* Kanal icon container - Premium */}
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-transparent flex items-center justify-center border border-indigo-500/20 shadow-lg backdrop-blur-sm group-hover:border-indigo-500/40 transition-all duration-300 group-hover:shadow-[0_0_20px_rgba(99,102,241,0.25)]">
                <Volume2
                  size={18}
                  className="text-indigo-400 group-hover:text-indigo-300 transition-colors duration-300"
                />
              </div>
              {/* Online pulse indicator */}
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-gradient-to-br from-[#1a1b1f] to-[#0e0f12] rounded-full flex items-center justify-center shadow-lg">
                <div className="w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
              </div>
            </div>

            {/* Kanal adı */}
            <div className="flex flex-col min-w-0">
              <span className="text-white font-bold text-sm sm:text-base tracking-tight truncate group-hover:text-indigo-100 transition-colors duration-300">
                {roomDisplayName}
              </span>
              <span className="text-[10px] sm:text-xs text-white/50 font-medium tracking-wide">
                Ses Kanalı
              </span>
            </div>
          </div>

          {/* Ayırıcı */}
          <div className="w-px h-8 sm:h-10 bg-gradient-to-b from-transparent via-white/10 to-transparent mx-1 hidden md:block" />

          {/* Bağlantı durumu */}
          <div className="hidden md:block">
            <ConnectionStatusIndicator />
          </div>
        </div>

        {/* Sağ taraf - Kontrol butonları */}
        <div className="flex items-center gap-1 relative z-10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] rounded-2xl p-1 backdrop-blur-sm border border-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
          {/* Kullanıcılar butonu */}
          <button
            onClick={() => setShowVoicePanel(!showVoicePanel)}
            title="Kişiler"
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200 ${
              showVoicePanel
                ? "bg-gradient-to-br from-indigo-500/20 to-purple-500/10 text-white border border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.2)]"
                : "text-white/60 hover:text-white hover:bg-white/[0.05]"
            }`}
          >
            <Users size={16} />
          </button>
        </div>
      </div>

      <ScreenShareManager
        setPinnedStreamIds={setPinnedStreamIds}
        renderStageManager={(stopScreenShare) => (
          <StageManager
            showVoicePanel={showVoicePanel}
            showChatPanel={showChatPanel}
            currentTextChannel={currentTextChannel}
            chatPosition={chatPosition}
            chatWidth={chatWidth}
            setChatWidth={setChatWidth}
            username={username}
            userId={userId}
            onUserContextMenu={handleUserContextMenu}
            pinnedStreamIds={pinnedStreamIds}
            setPinnedStreamIds={setPinnedStreamIds}
            hideIncomingVideo={hideIncomingVideo}
            stopScreenShare={stopScreenShare}
          />
        )}
        renderBottomControls={(stopScreenShare) => (
          hasConnectedOnce && (
            <BottomControls
              voicePanelHidden={!showVoicePanel}
              username={username}
              serverId={serverId}
              channelId={roomName}
              onLeave={handleManualLeave}
              onOpenSettings={() => setShowSettings(true)}
              isDeafened={isDeafened}
              onDeafenToggle={toggleDeaf}
              isMuted={isMuted}
              onMuteToggle={toggleMute}
              serverMuted={serverMuted}
              serverDeafened={serverDeafened}
              playSound={playSound}
              setPinnedStreamIds={setPinnedStreamIds}
              pinnedStreamIds={pinnedStreamIds}
              isCameraOn={isCameraOn}
              setIsCameraOn={setIsCameraOn}
              stopScreenShare={stopScreenShare}
              mutedBy={mutedBy}
              deafenedBy={deafenedBy}
              mutedAt={mutedAt}
              deafenedAt={deafenedAt}
              isDMCall={isDMCall}
              onInviteClick={() => setShowCallInviteModal(true)}
            />
          )
        )}
      />
      
      {/* Odaya Davet Modal Placeholder (Gerçek implementasyon yapılacak) */}
      {showCallInviteModal && isDMCall && (
        <CallInviteModal 
          roomId={roomName}
          onClose={() => setShowCallInviteModal(false)}
        />
      )}

      {contextMenu && (
        <UserContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          participant={contextMenu.participant}
          isLocal={contextMenu.isLocal}
          roomName={contextMenu.roomName}
          onClose={() => setContextMenu(null)}
        />
      )}

      {serverId && (
        <WatchPartyManager serverId={serverId} channelId={roomName} />
      )}

      {/* 🎧 Spatial Audio Canvas — Floating panel */}
      <SpatialCanvasWrapper channelId={roomName} localUserId={userId} />

      {/* 🎲 Masa modülü: ayarlardan kapalıysa hiçbir şey yüklenmez / çalışmaz */}
      <GamesHandler />
    </LiveKitRoom>
  );
}
