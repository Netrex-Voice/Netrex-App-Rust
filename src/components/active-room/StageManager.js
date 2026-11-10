import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import {
  useTracks,
  useLocalParticipant,
  useParticipants,
  VideoTrack,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import {
  Monitor,
  Eye,
  EyeOff,
  StopCircle,
  Layers,
  Minimize,
  Maximize,
  VolumeX,
  Volume1,
  Volume2,
  AlertTriangle,
  Users,
  MicOff,
  Video,
  GripHorizontal,
  LayoutGrid,
  Focus,
  X,
  ArrowUpToLine,
  Signal,
  Trash2,
  MousePointer2,
  Pencil,
  Eraser,
  MessageSquareText,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useWatchPartyStore } from "@/src/store/watchPartyStore";
import CursorOverlay from "./CursorOverlay";
import { useCursorBroadcast } from "@/src/hooks/useCursorBroadcast";
import { CURSOR_TOPICS } from "@/src/hooks/useCursorShareController";
import { getVideoContentRect } from "@/src/utils/pointerGeometry";
import { addClick, addStrokePoints, clearStrokesOf } from "@/src/utils/pointerFx";
import { toast } from "@/src/utils/toast";
import TickerMessageButton from "./TickerMessageButton";
import { getTickerWait, sendTickerMessage } from "@/src/utils/tickerSend";
import { QuickMessageGrid } from "./QuickMessagePicker";
import { useCursorShareStore } from "@/src/store/cursorShareStore";
import ParticipantList from "./ParticipantList";
import ChatView from "../ChatView";
import DMConversation from "../friends/DMConversation";
import { useDMStore } from "@/src/store/dmStore";

const MemoizedStageBackground = React.memo(
  ({ disableBackgroundEffects, activeSpeakerColor }) => {
    // Extract primary hex if it's a gradient
    const getBaseColor = (color) => {
      if (!color) return null;
      if (!color.includes("gradient")) return color;
      const match = color.match(/#[0-9a-fA-F]{6}/);
      return match ? match[0] : null;
    };

    const baseColor = getBaseColor(activeSpeakerColor);

    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {!disableBackgroundEffects && (
            <div
              className="absolute inset-0 opacity-[0.015] will-change-opacity"
              style={{
                backgroundImage: `
                linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
              `,
                backgroundSize: "60px 60px",
                maskImage:
                  "radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%)",
                WebkitMaskImage:
                  "radial-gradient(ellipse 80% 80% at 50% 50%, black 20%, transparent 100%)",
              }}
            />
        )}
      </div>
    );
  },
);

function SortableTrackItem({
  id,
  children,
  spotlightMode = false,
  disableDrag = false,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id, disabled: disableDrag });

  const style = {
    transform:
      spotlightMode && !isDragging
        ? undefined
        : CSS.Transform.toString(transform),
    transition: isDragging ? "none" : spotlightMode ? "none" : transition,
    zIndex: isDragging && !spotlightMode ? 50 : "auto",
  };

  // Grid mode: item moves at original size with a glow
  // Spotlight mode: item becomes dim placeholder (DragOverlay shows preview)
  const dragClass = isDragging
    ? spotlightMode
      ? "border-[#5865f2]/30 opacity-30 scale-[0.98]"
      : "border-[#5865f2] shadow-[0_0_20px_rgba(88,101,242,0.35)] scale-[1.02]"
    : isOver
      ? "border-[#5865f2] border-2 shadow-[0_0_25px_rgba(88,101,242,0.3)]"
      : "border-white/5 hover:border-white/10";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative w-full h-full rounded-xl overflow-hidden shadow-2xl bg-[#111214] border group/sortable ${dragClass} transition-all duration-200`}
    >
      {!disableDrag && (
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[180px] sm:w-[240px] h-[14px] bg-[#5865f2]/80 backdrop-blur-sm rounded-b-[8px] cursor-grab active:cursor-grabbing opacity-0 group-hover/sortable:opacity-100 transition-opacity duration-200 z-[60] shadow-lg flex items-center justify-center pointer-events-auto"
          style={{ touchAction: "none" }}
          {...attributes}
          {...listeners}
        >
          <div className="w-10 h-[3px] bg-white/30 rounded-full" />
        </div>
      )}
      {children}
      {/* Drop zone indicator - only for spotlight mode */}
      {isOver && !isDragging && spotlightMode && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#5865f2]/10 backdrop-blur-[1px] border-2 border-dashed border-[#5865f2]/60 rounded-xl pointer-events-none animate-pulse">
          <div className="flex items-center gap-2 bg-[#5865f2]/90 px-4 py-2 rounded-xl shadow-lg">
            <Layers size={16} className="text-white" />
            <span className="text-white text-xs font-bold">Buraya Taşı</span>
          </div>
        </div>
      )}
      {/* Dragging placeholder indicator - only for spotlight mode */}
      {isDragging && spotlightMode && (
        <div className="absolute inset-0 z-50 flex items-center justify-center border-2 border-dashed border-[#5865f2]/40 rounded-xl pointer-events-none">
          <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
            <GripHorizontal size={14} className="text-[#5865f2]/70" />
            <span className="text-[#5865f2]/70 text-[10px] font-semibold">
              Sürükleniyor...
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Drag overlay preview - rendered in a portal above everything
function DragPreview({ track, size = "normal" }) {
  if (!track) return null;
  const participant = track.participant;
  const isScreen = track.source === Track.Source.ScreenShare;

  const sizes = {
    compact: { width: 220, height: 140 },
    normal: { width: 400, height: 250 },
  };
  const { width, height } = sizes[size] || sizes.normal;

  return (
    <div
      className="rounded-xl overflow-hidden shadow-[0_0_40px_rgba(88,101,242,0.5)] border-2 border-[#5865f2] bg-[#111214] relative cursor-grabbing"
      style={{ width, height }}
    >
      <VideoTrack trackRef={track} className="w-full h-full object-cover" />
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
        <div className="flex items-center gap-1.5">
          {isScreen ? (
            <Monitor size={12} className="text-[#5865f2]" />
          ) : (
            <Video size={12} className="text-emerald-400" />
          )}
          <span className="text-[11px] font-semibold text-white truncate">
            {participant?.isLocal
              ? isScreen
                ? "Senin Yayının"
                : "Kameran"
              : participant?.name || participant?.identity || "Kullanıcı"}
          </span>
        </div>
      </div>
    </div>
  );
}

// --- STREAM CONTEXT MENU ---
function StreamContextMenu({
  x,
  y,
  onClose,
  onRemove,
  onSpotlight,
  onMoveFirst,
  onFullscreen,
  onQuickMessage, // verilirse "Hızlı mesaj" bölümü gösterilir (uzak yayınlarda)
  streamName,
}) {
  const menuRef = useRef(null);
  const [coords, setCoords] = useState({ top: y, left: x });
  const [isPositioned, setIsPositioned] = useState(false);

  // ✅ Akıllı pozisyonlama - gerçek boyutu ölç
  useEffect(() => {
    setIsPositioned(false);
    const raf = requestAnimationFrame(() => {
      const menu = menuRef.current;
      if (!menu) return;
      const rect = menu.getBoundingClientRect();
      const mW = rect.width || 180;
      const mH = rect.height || 200;
      const PADDING = 8;

      let newLeft = x;
      let newTop = y;

      if (newLeft + mW > window.innerWidth - PADDING) newLeft = x - mW;
      if (newLeft < PADDING) newLeft = PADDING;
      if (newTop + mH > window.innerHeight - PADDING)
        newTop = window.innerHeight - mH - PADDING;
      if (newTop < PADDING) newTop = PADDING;

      setCoords({ top: newTop, left: newLeft });
      setIsPositioned(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [x, y]);

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  const items = [
    {
      icon: Focus,
      label: "Spotlight Yap",
      onClick: onSpotlight,
      color: "text-[#5865f2]",
    },
    {
      icon: ArrowUpToLine,
      label: "Başa Taşı",
      onClick: onMoveFirst,
      color: "text-white",
    },
    {
      icon: Maximize,
      label: "Tam Ekran",
      onClick: onFullscreen,
      color: "text-white",
    },
    { icon: Trash2, label: "Kaldır", onClick: onRemove, color: "text-red-400" },
  ];

  return createPortal(
    <div
      ref={menuRef}
      // Katman: üye listesi, kenar çubukları ve diğer panellerin üstünde. overflow-hidden yalnızca mesaj bölümü
      // yokken (köşeler için); mesaj karelerinin balonları kırpılmasın diye varken kapalı.
      className={`fixed z-[10060] ${onQuickMessage ? "w-72" : "min-w-[180px] overflow-hidden"} bg-[#111214]/95 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-2xl`}
      style={{
        left: coords.left,
        top: coords.top,
        opacity: isPositioned ? 1 : 0,
        transform: isPositioned ? "scale(1)" : "scale(0.95)",
        transition: "opacity 150ms ease-out, transform 150ms ease-out",
        transformOrigin: "top left",
      }}
    >
      <div className="px-3 py-2 border-b border-white/[0.06]">
        <span className="text-[10px] uppercase tracking-widest text-[#72767d] font-semibold">
          {streamName}
        </span>
      </div>
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => {
            item.onClick();
            onClose();
          }}
          className={`w-full px-3 py-2 text-xs font-medium flex items-center gap-2.5 hover:bg-white/[0.06] transition-colors ${item.color}`}
        >
          <item.icon size={14} />
          {item.label}
        </button>
      ))}

      {/* 💬 Hızlı mesaj: mikrofonunu açamayan izleyici tek tıkla yayıncıya kayan yazı gönderir */}
      {onQuickMessage && (() => {
        const wait = getTickerWait();
        const waitSec = Math.ceil(wait.ms / 1000);
        const cooling = waitSec > 0;
        return (
          <>
            <div className="h-px bg-white/[0.06] my-1" />
            <div className="px-3 pt-1.5 pb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#72767d] font-semibold">
              <MessageSquareText size={11} />
              Hızlı mesaj
            </div>
            <div className="px-2 pb-2.5">
              <QuickMessageGrid
                disabled={cooling}
                onSend={(text) => {
                  onQuickMessage(text);
                  onClose();
                }}
              />
            </div>
            {cooling && (
              <div className="px-3 pt-1 pb-2 text-[10px] text-amber-300/90">
                {wait.limit ? "Dakika sınırına ulaştın. " : ""}
                {waitSec} sn sonra gönderebilirsin
              </div>
            )}
          </>
        );
      })()}
    </div>,
    document.fullscreenElement || document.body,
  );
}

// ✅ FIX: Tekil bir global interval ile tüm QualityBadge'leri güncelle
// N adet stream için N adet setInterval açmak CPU yükü yaratıyordu.
const qualityBadgeUpdaters = new Set();
let globalQualityBadgeInterval = null;

function registerQualityUpdater(fn) {
  qualityBadgeUpdaters.add(fn);
  if (!globalQualityBadgeInterval && qualityBadgeUpdaters.size > 0) {
    globalQualityBadgeInterval = setInterval(() => {
      for (const updateFn of qualityBadgeUpdaters) {
        updateFn();
      }
    }, 5000);
  }
  return () => {
    qualityBadgeUpdaters.delete(fn);
    if (qualityBadgeUpdaters.size === 0 && globalQualityBadgeInterval) {
      clearInterval(globalQualityBadgeInterval);
      globalQualityBadgeInterval = null;
    }
  };
}

// --- QUALITY BADGE ---
function QualityBadge({ trackRef }) {
  const [quality, setQuality] = useState(null);

  useEffect(() => {
    const track = trackRef?.publication?.track;
    if (!track) return;

    const update = () => {
      const settings = track.mediaStreamTrack?.getSettings?.();
      if (settings?.width && settings?.height) {
        const h = Math.min(settings.width, settings.height);
        const w = Math.max(settings.width, settings.height);
        if (h >= 1080)
          setQuality({
            label: "FHD",
            color: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
          });
        else if (h >= 720)
          setQuality({
            label: "HD",
            color: "text-blue-400 bg-blue-500/15 border-blue-500/30",
          });
        else if (h >= 480)
          setQuality({
            label: "SD",
            color: "text-yellow-400 bg-yellow-500/15 border-yellow-500/30",
          });
        else
          setQuality({
            label: `${h}p`,
            color: "text-red-400 bg-red-500/15 border-red-500/30",
          });
      }
    };

    update();
    return registerQualityUpdater(update);
  }, [trackRef]);

  if (!quality) return null;

  return (
    <div
      className={`absolute top-2 right-2 z-40 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${quality.color}`}
    >
      {quality.label}
    </div>
  );
}

// ✅ WatcherCountBadge - useParticipants izole edildi
// Ekran paylaşımlarında izleyici sayısını gösterir. Tüm ScreenShareStage'i re-render olmaktan kurtarır.
const WatcherCountBadge = React.memo(({ participantIdentity, compact }) => {
  const participants = useParticipants();
  
  const viewerCount = useMemo(() => {
    if (!participantIdentity) return 0;
    return participants.filter((p) => {
      if (p.identity === participantIdentity) return false;
      try {
        const meta = p.metadata ? JSON.parse(p.metadata) : {};
        // Sabitlenen yayın kimlikleri "identity:screen" biçimindedir ve birden fazla olabilir
        // (watchingStreamIds); eski sürümler düz identity yazar. Kamera izlemek ekran izleyicisi sayılmaz.
        const ids = Array.isArray(meta.watchingStreamIds) && meta.watchingStreamIds.length
          ? meta.watchingStreamIds
          : [meta.watchingStreamId];
        return ids.some(
          (id) => id === participantIdentity || id === `${participantIdentity}:screen`,
        );
      } catch (e) {
        return false;
      }
    }).length;
  }, [participants, participantIdentity]);

  if (compact) {
    return (
      <div className="flex items-center gap-1 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-md border border-white/[0.08]">
        <Users size={9} className="text-indigo-400" />
        <span className="text-[9px] font-bold text-white/80">{viewerCount}</span>
      </div>
    );
  }

  return <span className="text-xs font-bold text-white">{viewerCount}</span>;
});

// ✅ ActiveSpeakerColor - useParticipants izole edildi
// Her konuşmada sadece bu küçük component re-render olur,
// StageManager (DndContext + tüm track grid) etkilenmez.
function ActiveSpeakerColor({ onColorChange }) {
  const participants = useParticipants();
  const localIsSpeaking = useSettingsStore((s) => s.localIsSpeaking);
  const localProfileColor = useSettingsStore((s) => s.profileColor);

  useEffect(() => {
    if (localIsSpeaking) {
      onColorChange(localProfileColor || "#6366f1");
      return;
    }
    const speaker = participants.find((p) => p.isSpeaking && !p.isLocal);
    if (!speaker) {
      onColorChange(null);
      return;
    }
    try {
      const meta = speaker.metadata ? JSON.parse(speaker.metadata) : {};
      onColorChange(meta.profileColor || "#6366f1");
    } catch {
      onColorChange("#6366f1");
    }
  }, [participants, localIsSpeaking, localProfileColor, onColorChange]);

  return null;
}

// 🔁 Ekran paylaşımı veya kamera kapanıp (ekran değişimi, kısa ara, yeniden başlatma) aynı kişiden
// tekrar açılırsa, onu izleyenler otomatik olarak eski düzenle devam eder. Bu süre içinde geri gelmesi yeterli.
const RESUME_GRACE_MS = 10 * 60_000; // 10 dakika

// 🖥️ Tam ekran, tek bir yayın öğesinde DEĞİL, sahne kökünde (StageManager) tutulur.
// Neden: yayın kapanınca öğe DOM'dan silinir ve tarayıcı tam ekranı kendiliğinden bozar; geri gelince de tam ekranı
// kullanıcı hareketi olmadan yeniden açmak tarayıcıda (Chrome/Firefox/Safari) engellenir. Kök silinmediği için tam ekran
// kesintisiz sürer; yayın geri gelince aynı öğe (aynı kimlik) otomatik olarak tüm ekranı kaplar. Electron'da da aynı yol.
const stageFs = {
  id: null, // tam ekrandaki yayının kimliği ("kimlik:screen" | "kimlik:camera")
  root: null, // StageManager kök öğesi (tam ekran hedefi)
  subs: new Set(),
  set(id) {
    if (this.id === id) return;
    this.id = id;
    this.subs.forEach((f) => f());
  },
  request(id) {
    const r = this.root;
    if (!r) return false;
    this.set(id);
    if (!document.fullscreenElement) r.requestFullscreen?.().catch(() => this.set(null));
    return true;
  },
  exit() {
    this.set(null);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  },
};
const useStageFsId = () =>
  useSyncExternalStore(
    (cb) => {
      stageFs.subs.add(cb);
      return () => stageFs.subs.delete(cb);
    },
    () => stageFs.id,
    () => null,
  );

function StageManager({
  showVoicePanel,
  showChatPanel,
  currentTextChannel,
  chatPosition,
  chatWidth,
  setChatWidth,
  username,
  userId,
  onUserContextMenu,
  pinnedStreamIds,
  setPinnedStreamIds,
  hideIncomingVideo,
  stopScreenShare,
}) {
  const activeConversation = useDMStore((state) => state.activeConversation);
  const shouldShowChat = showChatPanel && (currentTextChannel || activeConversation);
  const controlBarHidden = useSettingsStore((s) => s.controlBarHidden);

  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef(null);
  const userStoppedWatchingRef = useRef(false); // Kullanıcı manuel olarak izlemeyi durdurdu mu?
  const prevScreenTracksRef = useRef([]); // Önceki screen share track'lerini takip etmek için
  // 🔁 Kapanan uzak yayınların geri dönüş hafızası: pinnedId -> { identity, index, layoutMode, lostAt }
  const resumeRef = useRef(new Map());
  const layoutModeRef = useRef("grid");
  const pinnedRef = useRef([]);

  const wpActive = useWatchPartyStore((s) => s.isActive);
  const wpShowPlayer = useWatchPartyStore((s) => s.localPreferences.showPlayer);
  const watchPartyPanelOffset = wpActive && wpShowPlayer ? 368 : 0; // Panel ~340px + right-6 + gap

  // Resize handler - delay olmadan anında güncelle
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      // Performans için event işleme sırasında geciktirici (throttle vs.) kullanmıyoruz.
      // Doğrudan state'i güncelliyoruz ki imleci geriden takip etmesin.
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const minWidth = 300; // Minimum chat genişliği
      const maxWidth = containerRect.width * 0.7; // Maksimum %70

      let newWidth;
      if (chatPosition === "right") {
        // Sağdan soldan çek
        newWidth = containerRect.right - e.clientX;
      } else {
        // Soldan sağdan çek
        newWidth = e.clientX - containerRect.left;
      }

      // Sınırları kontrol et
      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      setChatWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, chatPosition, setChatWidth]);

  const handleResizeStart = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };
  const screenTracks = useTracks([Track.Source.ScreenShare]);
  const cameraTracks = useTracks([Track.Source.Camera]);

  const activeTracks = useMemo(() => {
    if (!pinnedStreamIds || pinnedStreamIds.length === 0) return [];

    return pinnedStreamIds
      .flatMap((idWithSource) => {
        const tracks = [];
        if (idWithSource.includes(":")) {
          const [identity, source] = idWithSource.split(":");
          if (source === "screen") {
            const screen = screenTracks.find(
              (t) => t.participant.identity === identity,
            );
            if (screen)
              tracks.push({
                track: screen,
                pinnedId: idWithSource,
                id: `${identity}:${source}`,
              });
          } else if (source === "camera") {
            const camera = cameraTracks.find(
              (t) => t.participant.identity === identity,
            );
            if (camera)
              tracks.push({
                track: camera,
                pinnedId: idWithSource,
                id: `${identity}:${source}`,
              });
          }
        } else {
          // Fallback for bare identity (eski format) - HER İKİ track'i de ekle
          const screen = screenTracks.find(
            (t) => t.participant.identity === idWithSource,
          );
          const camera = cameraTracks.find(
            (t) => t.participant.identity === idWithSource,
          );

          if (screen)
            tracks.push({
              track: screen,
              pinnedId: idWithSource,
              id: `${screen.participant.identity}:screen`,
            });
          if (camera)
            tracks.push({
              track: camera,
              pinnedId: idWithSource,
              id: `${camera.participant.identity}:camera`,
            });
        }
        return tracks;
      })
      .filter(Boolean);
  }, [pinnedStreamIds, screenTracks, cameraTracks]);
  const { localParticipant } = useLocalParticipant();
  const amISharing = localParticipant.isScreenShareEnabled;
  const desktopNotifications = useSettingsStore(
    (state) => state.desktopNotifications,
  );
  const notifyOnJoin = useSettingsStore((state) => state.notifyOnJoin);
  // ✅ FIX: getState() yerine reaktif selector
  const disableBackgroundEffects = useSettingsStore((s) => s.disableBackgroundEffects);

  // 🌈 v5.4 Adaptive Background Logic
  // ✅ CRITICAL FIX: useParticipants() burada olmamalı!
  // Her konuşma başlayıp bitince tüm StageManager (DndContext, track'ler, chat) re-render oluyordu.
  // Çözüm: ActiveSpeakerColor adlı küçük bir component'e taşındı.
  const [activeSpeakerColor, setActiveSpeakerColor] = useState(null);

  // Yayın açıldığında bildirim göster
  useEffect(() => {
    if (screenTracks.length > prevScreenTracksRef.current.length) {
      // Yeni bir yayın başladı
      const newTracks = screenTracks.filter(
        (t) =>
          !prevScreenTracksRef.current.find(
            (pt) => pt.participant.sid === t.participant.sid,
          ),
      );

      newTracks.forEach((track) => {
        if (
          !track.participant.isLocal &&
          desktopNotifications &&
          notifyOnJoin
        ) {
          const participantName =
            track.participant.name || track.participant.identity || "Birisi";
          if (Notification.permission === "granted") {
            const notification = new Notification("Yayın Başladı", {
              body: `${participantName} ekran paylaşımı başlattı`,
              icon: "/favicon.ico",
              tag: `screen-share-${track.participant.sid}`,
            });

            notification.onclick = () => {
              if (window.netrex?.focusWindow) {
                window.netrex.focusWindow();
              } else {
                window.focus();
              }
              notification.close();
            };
          }
        }
      });
    }
    prevScreenTracksRef.current = screenTracks;
  }, [screenTracks, desktopNotifications, notifyOnJoin]);

  // ✅ Birleşik stream yönetimi - kamera ve yayın tek yerden yönetiliyor
  // Race condition fix: Local track'ler için track listesi yerine localParticipant.isEnabled kontrolü
  useEffect(() => {
    // Kullanıcı manuel olarak durdurduysa, tekrar otomatik seçme
    if (
      userStoppedWatchingRef.current &&
      (!pinnedStreamIds || pinnedStreamIds.length === 0)
    ) {
      return;
    }

    // 🔁 Kapanan yayın aynı kişiden geri geldiyse: eski sırasıyla listeye ekle,
    // grid/spotlight düzenini geri getir ve (öyleyse) tam ekrana dön.
    const resume = resumeRef.current;
    if (resume.size > 0) {
      const nowTs = Date.now();
      const current = pinnedStreamIds || [];
      const restorable = [];
      resume.forEach((entry, id) => {
        if (nowTs - entry.lostAt > RESUME_GRACE_MS || current.includes(id)) {
          resume.delete(id); // süresi doldu ya da kullanıcı kendisi yeniden açtı
        } else if (
          (entry.source === "camera" ? cameraTracks : screenTracks).some(
            (t) => t.participant.identity === entry.identity,
          )
        ) {
          restorable.push([id, entry]);
        }
      });
      if (restorable.length > 0) {
        restorable.sort((a, b) => a[1].index - b[1].index);
        const wantsSpotlight = restorable.some(([, e]) => e.layoutMode === "spotlight");
        restorable.forEach(([id]) => resume.delete(id));
        setPinnedStreamIds((prev) => {
          const next = [...(prev || [])];
          restorable.forEach(([id, e]) => {
            if (!next.includes(id)) next.splice(Math.min(e.index, next.length), 0, id);
          });
          return next;
        });
        if (wantsSpotlight) setLayoutMode("spotlight");
        return;
      }
    }

    // Track kaybolduysa filterla
    if (pinnedStreamIds && pinnedStreamIds.length > 0) {
      const localIdentity = localParticipant?.identity;

      const stillActiveIds = pinnedStreamIds.filter((idWithSource) => {
        const [identity, source] = idWithSource.includes(":")
          ? idWithSource.split(":")
          : [idWithSource, "any"];
        const isLocalUser = identity === localIdentity;

        if (isLocalUser) {
          // ✅ Local kullanıcı için: Track listesi yerine ENABLED durumuna bak
          // Track henüz publish olmamış olsa bile enabled ise silme (race condition fix)
          if (source === "screen")
            return (
              localParticipant?.isScreenShareEnabled ||
              screenTracks.some((t) => t.participant.identity === identity)
            );
          if (source === "camera")
            return (
              localParticipant?.isCameraEnabled ||
              cameraTracks.some((t) => t.participant.identity === identity)
            );
          return (
            localParticipant?.isScreenShareEnabled ||
            localParticipant?.isCameraEnabled ||
            screenTracks.some((t) => t.participant.identity === identity) ||
            cameraTracks.some((t) => t.participant.identity === identity)
          );
        }

        // Remote kullanıcılar için: Track listesine bak (her zamanki gibi)
        if (source === "screen")
          return screenTracks.some((t) => t.participant.identity === identity);
        if (source === "camera")
          return cameraTracks.some((t) => t.participant.identity === identity);
        return (
          screenTracks.some((t) => t.participant.identity === identity) ||
          cameraTracks.some((t) => t.participant.identity === identity)
        );
      });

      // 🔁 Kaybolan ekran/kamera yayınlarını geri dönüş için hatırla (yayıncı ekran değiştiriyor olabilir).
      // KENDİ yayınımız da dahil: telefonda ön/arka kamera değiştirmek kamerayı bir an kaldırıp yeniden yayınlar,
      // bu sırada büyütülmüş (pinli) görünüm kayboluyor ve geri gelmiyordu. Kullanıcı yayını elle (X / sağ tık)
      // kapatırsa pin zaten kullanıcı tarafından kaldırılır, buradan geçmez, yani geri getirilmez.
      const lostAt = Date.now();
      pinnedStreamIds.forEach((id, index) => {
        if (stillActiveIds.includes(id)) return;
        const [identity, source] = id.includes(":") ? id.split(":") : [id, "any"];
        // Ekran paylaşımı VE kamera: kapanıp geri gelirse otomatik devam edilir
        if (source !== "screen" && source !== "camera") return;
        if (resumeRef.current.has(id)) return;
        resumeRef.current.set(id, {
          identity,
          source,
          index,
          lostAt,
          layoutMode: layoutModeRef.current,
        });
      });

      // Dedup
      const dedupedIds = [...new Set(stillActiveIds)];
      if (
        dedupedIds.length !== pinnedStreamIds.length ||
        dedupedIds.some((id, i) => id !== pinnedStreamIds[i])
      ) {
        if (dedupedIds.length === 0) userStoppedWatchingRef.current = false;
        setPinnedStreamIds(dedupedIds);
        return;
      }
    }

    // YENİ: Otomatik ekleme mantığı kaldırıldı (BottomControls zaten startScreenShare'de ekliyor)
    // Bu sayede kullanıcı kendi yayınını "X" ile veya sağ tık ile kapattığında geri gelmeyecek.
  }, [
    screenTracks,
    cameraTracks,
    pinnedStreamIds,
    setPinnedStreamIds,
    localParticipant,
  ]);

  const isLocalSharing =
    activeTracks.length > 0 && activeTracks[0].track.participant.isLocal;
  const [localPreviewHidden, setLocalPreviewHidden] = useState(false);
  const [layoutMode, setLayoutMode] = useState("grid"); // 'grid' | 'spotlight'
  layoutModeRef.current = layoutMode;
  // Tam ekran kökünü kaydet; Esc ile çıkılınca durumu temizle; yayın bilerek bırakıldıysa tam ekrandan çık.
  pinnedRef.current = pinnedStreamIds || [];
  useEffect(() => {
    stageFs.root = containerRef.current;
    const onChange = () => {
      if (!document.fullscreenElement) stageFs.set(null);
    };
    document.addEventListener("fullscreenchange", onChange);
    // Tam ekrandaki yayın artık izlenmiyorsa (kullanıcı kapattı) ve geri dönüş beklenmiyorsa tam ekrandan çık
    const guard = setInterval(() => {
      const id = stageFs.id;
      if (!id) return;
      const waiting = resumeRef.current.has(id) && Date.now() - resumeRef.current.get(id).lostAt < RESUME_GRACE_MS;
      if (!pinnedRef.current.includes(id) && !waiting) stageFs.exit();
    }, 2500);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      clearInterval(guard);
      if (stageFs.root === containerRef.current) stageFs.root = null;
      stageFs.exit();
    };
  }, []);
  const fsActiveId = useStageFsId();
  const [contextMenu, setContextMenu] = useState(null); // { x, y, trackId, pinnedId }
  const [activeDragId, setActiveDragId] = useState(null);
  const activeDragRef = useRef(null); // Store drag start info for modifier
  useEffect(() => {
    if (activeTracks.length === 0) setLocalPreviewHidden(false);
  }, [activeTracks]);
  useEffect(() => {
    if (activeTracks.length <= 1 && layoutMode === "spotlight")
      setLayoutMode("grid");
  }, [activeTracks.length, layoutMode]);

  // Track kaybolursa stale drag state'i temizle
  useEffect(() => {
    if (activeDragId && !activeTracks.find((t) => t.id === activeDragId)) {
      setActiveDragId(null);
      activeDragRef.current = null;
    }
  }, [activeTracks, activeDragId]);

  // Context menu stale data - track kaybolursa kapat
  useEffect(() => {
    if (
      contextMenu &&
      !activeTracks.find((t) => t.id === contextMenu.trackId)
    ) {
      setContextMenu(null);
    }
  }, [activeTracks, contextMenu]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px hareket etmeden drag başlamasın (click ile drag karışmasın)
      },
    }),
  );

  const handleDragStart = (event) => {
    setActiveDragId(event.active.id);
    // Store the original node rect for the modifier
    const node =
      event.active.rect.current.translated || event.active.rect.current.initial;
    if (node && event.activatorEvent) {
      activeDragRef.current = {
        offsetX: event.activatorEvent.clientX - node.left,
        offsetY: event.activatorEvent.clientY - node.top,
        origWidth: node.width,
        origHeight: node.height,
      };
    }
  };

  const handleDragEnd = (event) => {
    setActiveDragId(null);
    activeDragRef.current = null;
    const { active, over } = event;
    if (!over) return;

    if (active.id !== over.id) {
      setPinnedStreamIds((items) => {
        const activeItem = activeTracks.find((t) => t.id === active.id);
        const overItem = activeTracks.find((t) => t.id === over.id);
        if (!activeItem || !overItem) return items;

        const oldIndex = items.indexOf(activeItem.pinnedId);
        let newIndex = items.indexOf(overItem.pinnedId);

        if (oldIndex !== -1 && newIndex !== -1) {
          return arrayMove(items, oldIndex, newIndex);
        }
        return items;
      });
    }
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 flex overflow-hidden min-h-0 relative bg-gradient-to-br from-[#1a1b1f] via-[#141518] to-[#0e0f12]"
    >
      {fsActiveId && !(pinnedStreamIds || []).includes(fsActiveId) && (
        <div className="absolute inset-0 z-[55] flex flex-col items-center justify-center gap-3 bg-black/85 text-white">
          <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-indigo-400 animate-spin" />
          <div className="text-sm font-semibold">Yayın bekleniyor…</div>
          <div className="text-xs text-[#949ba4]">Yayın geri gelince otomatik olarak tam ekrana döner.</div>
          <button
            type="button"
            onClick={() => stageFs.exit()}
            className="mt-1 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition"
          >
            Tam ekrandan çık
          </button>
        </div>
      )}
      <ActiveSpeakerColor onColorChange={setActiveSpeakerColor} />
      <MemoizedStageBackground
        disableBackgroundEffects={disableBackgroundEffects}
        activeSpeakerColor={activeSpeakerColor}
      />
      {showVoicePanel && (
        <div
          className={`flex-1 ${activeTracks.length > 0 ? "overflow-hidden" : "overflow-y-auto custom-scrollbar"} min-w-0 flex flex-col transition-all duration-300 ease-in-out ${
            showChatPanel && currentTextChannel
              ? chatPosition === "left"
                ? "order-2"
                : "order-1"
              : ""
          }`}
          style={{
            width:
              showChatPanel && currentTextChannel
                ? `calc(100% - ${chatWidth}px - 4px - ${watchPartyPanelOffset}px)`
                : `calc(100% - ${watchPartyPanelOffset}px)`,
            flexShrink: 1,
          }}
        >
          {(screenTracks.length > 0 || cameraTracks.length > 0) &&
            activeTracks.length > 0 && (
              <div className="bg-gradient-to-r from-[#1a1b1f] via-[#1e1f23] to-[#1a1b1f] px-3 py-1.5 flex items-center gap-2 overflow-x-auto border-b border-white/[0.06] shrink-0 custom-scrollbar">
                {/* Yayınlar Bölümü */}
                {screenTracks.length > 0 && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-[#72767d] font-semibold mr-0.5 select-none">
                      <Monitor size={20} className="opacity-60" />
                    </div>
                    {screenTracks.map((t) => {
                      const targetId = `${t.participant.identity}:screen`;
                      const isPinned =
                        pinnedStreamIds?.includes(targetId) ||
                        pinnedStreamIds?.includes(t.participant.identity);
                      const name = t.participant.isLocal
                        ? "Sen"
                        : t.participant.name || t.participant.identity;
                      const initial = name.charAt(0).toUpperCase();
                      return (
                        <button
                          key={`screen-${t.participant.sid}`}
                          title={`${name} - ${isPinned ? "İzlemeyi bırak" : "Yayını izle"}`}
                          onClick={() => {
                            setPinnedStreamIds((prev) => {
                              const newArr = (prev || []).filter(
                                (id) =>
                                  id !== t.participant.identity &&
                                  id !== targetId,
                              );
                              if (!isPinned) newArr.push(targetId);
                              return newArr;
                            });
                            setLocalPreviewHidden(false);
                          }}
                          className={`group/btn relative w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold transition-all duration-200 shrink-0 ${
                            isPinned
                              ? "bg-[#5865f2]/30 text-white ring-2 ring-[#5865f2] shadow-[0_0_10px_rgba(88,101,242,0.3)]"
                              : "bg-white/[0.08] text-[#949ba4] ring-1 ring-white/[0.08] hover:ring-white/[0.2] hover:bg-white/[0.12] hover:text-white"
                          }`}
                        >
                          {initial}
                          {/* Canlı göstergesi */}
                          <div
                            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center ${isPinned ? "bg-[#5865f2]" : "bg-[#2d2f34]"}`}
                          >
                            <Monitor
                              size={9}
                              className={
                                isPinned ? "text-white" : "text-[#949ba4]"
                              }
                            />
                          </div>
                          {/* Canlı pulse */}
                          {!isPinned && (
                            <div className="absolute -top-0.5 -left-0.5 w-2 h-2 bg-red-500 rounded-full animate-pulse ring-1 ring-[#1e1f23]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Ayırıcı */}
                {screenTracks.length > 0 && cameraTracks.length > 0 && (
                  <div className="w-px h-5 bg-white/[0.08] shrink-0" />
                )}

                {/* Kameralar Bölümü */}
                {cameraTracks.length > 0 && (
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#72767d] font-semibold mr-0.5 select-none">
                      <Video size={25} className="opacity-70" />
                    </div>
                    {cameraTracks.map((t) => {
                      const targetId = `${t.participant.identity}:camera`;
                      const isPinned =
                        pinnedStreamIds?.includes(targetId) ||
                        pinnedStreamIds?.includes(t.participant.identity);
                      const name = t.participant.isLocal
                        ? "Sen"
                        : t.participant.name || t.participant.identity;
                      const initial = name.charAt(0).toUpperCase();
                      return (
                        <button
                          key={`camera-${t.participant.sid}`}
                          title={`${name} - ${isPinned ? "İzlemeyi bırak" : "Kamerayı izle"}`}
                          onClick={() => {
                            setPinnedStreamIds((prev) => {
                              const newArr = (prev || []).filter(
                                (id) =>
                                  id !== targetId &&
                                  id !== t.participant.identity,
                              );
                              if (!isPinned) newArr.push(targetId);
                              return newArr;
                            });
                            setLocalPreviewHidden(false);
                          }}
                          className={`group/btn relative w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold transition-all duration-200 shrink-0 ${
                            isPinned
                              ? "bg-emerald-500/20 text-white ring-2 ring-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                              : "bg-white/[0.08] text-[#949ba4] ring-1 ring-white/[0.08] hover:ring-white/[0.2] hover:bg-white/[0.12] hover:text-white"
                          }`}
                        >
                          {initial}
                          {/* Kamera göstergesi */}
                          <div
                            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center ${isPinned ? "bg-emerald-500" : "bg-[#2d2f34]"}`}
                          >
                            <Video
                              size={9}
                              className={
                                isPinned ? "text-white" : "text-[#949ba4]"
                              }
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Tümünü Kaldır */}
                {pinnedStreamIds?.length > 1 && (
                  <button
                    onClick={() => setPinnedStreamIds([])}
                    title="Tüm izlemeleri kapat"
                    className="ml-auto shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-red-400/60 hover:text-red-400 bg-red-500/[0.06] hover:bg-red-500/[0.15] ring-1 ring-red-500/[0.1] hover:ring-red-500/[0.3] transition-all duration-200"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}
          {/* Layout Mode Toggle */}
          {activeTracks.length > 1 && (
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.04] bg-[#111214]/50 shrink-0">
              <div className="flex items-center bg-white/[0.04] rounded-lg p-0.5 border border-white/[0.06]">
                <button
                  onClick={() => setLayoutMode("grid")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-200 ${
                    layoutMode === "grid"
                      ? "bg-[#5865f2] text-white shadow-lg shadow-[#5865f2]/25"
                      : "text-[#949ba4] hover:text-white hover:bg-white/[0.06]"
                  }`}
                  title="Grid Görünümü"
                >
                  <LayoutGrid size={13} />
                  <span>Grid</span>
                </button>
                <button
                  onClick={() => setLayoutMode("spotlight")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-200 ${
                    layoutMode === "spotlight"
                      ? "bg-[#5865f2] text-white shadow-lg shadow-[#5865f2]/25"
                      : "text-[#949ba4] hover:text-white hover:bg-white/[0.06]"
                  }`}
                  title="Spotlight Görünümü"
                >
                  <Focus size={13} />
                  <span>Spotlight</span>
                </button>
              </div>
              <span className="text-[9px] text-[#4e5058] select-none hidden sm:inline">
                {activeTracks.length} yayın aktif
              </span>
            </div>
          )}
          {activeTracks.length > 0 ? (
            <div className="flex-1 min-h-0 relative bg-black/40 overflow-hidden">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                {layoutMode === "spotlight" && activeTracks.length > 1 ? (
                  /* ===== SPOTLIGHT MODE ===== */
                  <div
                    className="absolute inset-0 p-2"
                    style={{
                      display: "grid",
                      gridTemplateRows: "1fr auto",
                      gap: "8px",
                    }}
                  >
                    <SortableContext
                      items={activeTracks.map((t) => t.id)}
                      strategy={rectSortingStrategy}
                    >
                      {/* Main spotlight stream (first in the array) */}
                      {(() => {
                        const { track, id, pinnedId } = activeTracks[0];
                        const isLocal = track.participant.isLocal;
                        return (
                          <div className="relative min-h-0">
                            <SortableTrackItem
                              key={id}
                              id={id}
                              spotlightMode
                              disableDrag
                            >
                              <QualityBadge trackRef={track} />
                              {isLocal &&
                              localPreviewHidden &&
                              track.source !== Track.Source.Camera ? (
                                <LocalHiddenPlaceholder
                                  onShow={() => setLocalPreviewHidden(false)}
                                  onStopSharing={async () => {
                                    if (stopScreenShare)
                                      await stopScreenShare();
                                  }}
                                />
                              ) : (
                                <ScreenShareStage
                                  trackRef={track}
                                  onStopWatching={() => {
                                    userStoppedWatchingRef.current = true;
                                    setPinnedStreamIds((prev) =>
                                      prev.filter(
                                        (streamId) =>
                                          streamId !==
                                            `${track.participant.identity}:${track.source === Track.Source.Camera ? "camera" : "screen"}` &&
                                          streamId !==
                                            track.participant.identity,
                                      ),
                                    );
                                  }}
                                  onContextMenu={(e) => {
                                    e.preventDefault();
                                    setContextMenu({
                                      x: e.clientX,
                                      y: e.clientY,
                                      trackId: id,
                                      pinnedId,
                                      track,
                                    });
                                  }}
                                  onUserContextMenu={onUserContextMenu}
                                  isLocalSharing={isLocal}
                                  amISharing={amISharing}
                                  onHideLocal={() =>
                                    setLocalPreviewHidden(true)
                                  }
                                  setPinnedStreamIds={setPinnedStreamIds}
                                  pinnedStreamIds={pinnedStreamIds}
                                />
                              )}
                            </SortableTrackItem>
                          </div>
                        );
                      })()}

                      {/* Thumbnail strip */}
                      <div
                        className="flex gap-2 overflow-x-auto custom-scrollbar pb-1"
                        style={{ height: "140px", minHeight: "140px" }}
                      >
                        {activeTracks
                          .slice(1)
                          .map(({ track, id, pinnedId }) => {
                            const isLocal = track.participant.isLocal;
                            return (
                              <div
                                key={id}
                                className="relative shrink-0 h-full rounded-xl"
                                style={{ width: "220px", minWidth: "220px" }}
                              >
                                <SortableTrackItem id={id} spotlightMode>
                                  <QualityBadge trackRef={track} />
                                  {isLocal &&
                                  localPreviewHidden &&
                                  track.source !== Track.Source.Camera ? (
                                    <LocalHiddenPlaceholder
                                      onShow={() =>
                                        setLocalPreviewHidden(false)
                                      }
                                      onStopSharing={async () => {
                                        if (stopScreenShare)
                                          await stopScreenShare();
                                      }}
                                    />
                                  ) : (
                                    <ScreenShareStage
                                      trackRef={track}
                                      compact={true}
                                      onStopWatching={() => {
                                        userStoppedWatchingRef.current = true;
                                        setPinnedStreamIds((prev) =>
                                          prev.filter(
                                            (streamId) =>
                                              streamId !==
                                                `${track.participant.identity}:${track.source === Track.Source.Camera ? "camera" : "screen"}` &&
                                              streamId !==
                                                track.participant.identity,
                                          ),
                                        );
                                      }}
                                      onContextMenu={(e) => {
                                        e.preventDefault();
                                        setContextMenu({
                                          x: e.clientX,
                                          y: e.clientY,
                                          trackId: id,
                                          pinnedId,
                                          track,
                                        });
                                      }}
                                      onDoubleClick={() => {
                                        setPinnedStreamIds((prev) => {
                                          const idx = prev.indexOf(pinnedId);
                                          if (idx > 0)
                                            return [
                                              pinnedId,
                                              ...prev.filter(
                                                (p) => p !== pinnedId,
                                              ),
                                            ];
                                          return prev;
                                        });
                                      }}
                                      onUserContextMenu={onUserContextMenu}
                                      isLocalSharing={isLocal}
                                      amISharing={amISharing}
                                      onHideLocal={() =>
                                        setLocalPreviewHidden(true)
                                      }
                                      setPinnedStreamIds={setPinnedStreamIds}
                                      pinnedStreamIds={pinnedStreamIds}
                                    />
                                  )}
                                </SortableTrackItem>
                              </div>
                            );
                          })}
                      </div>
                    </SortableContext>
                  </div>
                ) : (
                  /* ===== GRID MODE ===== */
                  <div
                    className={`absolute inset-0 p-2 grid gap-2 ${
                      activeTracks.length === 1
                        ? "grid-cols-1 grid-rows-1"
                        : activeTracks.length === 2
                          ? "grid-cols-1 md:grid-cols-2 grid-rows-2 md:grid-rows-1"
                          : activeTracks.length <= 4
                            ? "grid-cols-2 grid-rows-2"
                            : activeTracks.length <= 6
                              ? "grid-cols-2 lg:grid-cols-3 grid-rows-3 lg:grid-rows-2"
                              : "grid-cols-3 lg:grid-cols-4 grid-rows-auto"
                    } ${activeTracks.length > 4 ? "overflow-y-auto custom-scrollbar" : "overflow-hidden"}`}
                  >
                    <SortableContext
                      items={activeTracks.map((t) => t.id)}
                      strategy={rectSortingStrategy}
                    >
                      {activeTracks.map(({ track, id, pinnedId }) => {
                        const isLocal = track.participant.isLocal;
                        return (
                          <SortableTrackItem
                            key={id}
                            id={id}
                            disableDrag={activeTracks.length <= 1}
                          >
                            <QualityBadge trackRef={track} />
                            {isLocal &&
                            localPreviewHidden &&
                            track.source !== Track.Source.Camera ? (
                              <LocalHiddenPlaceholder
                                onShow={() => setLocalPreviewHidden(false)}
                                onStopSharing={async () => {
                                  if (stopScreenShare) {
                                    await stopScreenShare();
                                  }
                                }}
                              />
                            ) : (
                              <ScreenShareStage
                                trackRef={track}
                                onStopWatching={() => {
                                  userStoppedWatchingRef.current = true;
                                  setPinnedStreamIds((prev) =>
                                    prev.filter(
                                      (streamId) =>
                                        streamId !==
                                          `${track.participant.identity}:${track.source === Track.Source.Camera ? "camera" : "screen"}` &&
                                        streamId !== track.participant.identity,
                                    ),
                                  );
                                }}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  setContextMenu({
                                    x: e.clientX,
                                    y: e.clientY,
                                    trackId: id,
                                    pinnedId,
                                    track,
                                  });
                                }}
                                onUserContextMenu={onUserContextMenu}
                                isLocalSharing={isLocal}
                                amISharing={amISharing}
                                onHideLocal={() => setLocalPreviewHidden(true)}
                                setPinnedStreamIds={setPinnedStreamIds}
                                pinnedStreamIds={pinnedStreamIds}
                              />
                            )}
                          </SortableTrackItem>
                        );
                      })}
                    </SortableContext>
                  </div>
                )}

                <DragOverlay dropAnimation={null}>
                  {activeDragId && layoutMode === "spotlight"
                    ? (() => {
                        const draggedItem = activeTracks.find(
                          (t) => t.id === activeDragId,
                        );
                        if (!draggedItem) return null;
                        return (
                          <DragPreview
                            track={draggedItem.track}
                            size="compact"
                          />
                        );
                      })()
                    : null}
                </DragOverlay>
              </DndContext>

              {/* Context Menu */}
              {contextMenu && (
                <StreamContextMenu
                  x={contextMenu.x}
                  y={contextMenu.y}
                  streamName={
                    contextMenu.track?.participant?.isLocal
                      ? contextMenu.trackId.includes(":camera")
                        ? "Kameran"
                        : "Senin Yayının"
                      : `${contextMenu.track?.participant?.name || contextMenu.track?.participant?.identity || "Stream"}`
                  }
                  onClose={() => setContextMenu(null)}
                  onQuickMessage={
                    contextMenu.track &&
                    !contextMenu.track.participant?.isLocal &&
                    contextMenu.track.source === Track.Source.ScreenShare
                      ? (text) =>
                          sendTickerMessage(
                            localParticipant,
                            contextMenu.track.participant.identity,
                            text,
                          )
                      : undefined
                  }
                  onRemove={() => {
                    userStoppedWatchingRef.current = true;
                    setPinnedStreamIds((prev) =>
                      prev.filter((id) => id !== contextMenu.pinnedId),
                    );
                  }}
                  onSpotlight={() => {
                    setLayoutMode("spotlight");
                    setPinnedStreamIds((prev) => {
                      const idx = prev.indexOf(contextMenu.pinnedId);
                      if (idx > 0)
                        return [
                          contextMenu.pinnedId,
                          ...prev.filter((p) => p !== contextMenu.pinnedId),
                        ];
                      return prev;
                    });
                  }}
                  onMoveFirst={() => {
                    setPinnedStreamIds((prev) => {
                      const idx = prev.indexOf(contextMenu.pinnedId);
                      if (idx > 0)
                        return [
                          contextMenu.pinnedId,
                          ...prev.filter((p) => p !== contextMenu.pinnedId),
                        ];
                      return prev;
                    });
                  }}
                  onFullscreen={() => {
                    // Tek yayın moduna geç + tam ekran yap (kullanıcı hareketi içinde, hemen)
                    const pid = contextMenu.pinnedId;
                    setPinnedStreamIds([pid]);
                    stageFs.request(pid.includes(":") ? pid : `${pid}:screen`);
                  }}
                />
              )}
            </div>
          ) : (
            <div
              className="w-full h-full flex flex-col items-center justify-center p-4 relative transition-all duration-300 ease-in-out"
              style={{ opacity: 1, transform: "scale(1)" }}
            >
              <ParticipantList
                onUserContextMenu={onUserContextMenu}
                compact={false}
                hideIncomingVideo={hideIncomingVideo}
                setPinnedStreamIds={setPinnedStreamIds}
                pinnedStreamIds={pinnedStreamIds}
              />
            </div>
          )}
        </div>
      )}
      {/* Chat Panel - Always rendered, animated with transform */}
      <div
        className={`overflow-hidden border-[#26272d] bg-[#313338] flex flex-col min-w-0 shadow-xl z-10 transition-all duration-300 ease-in-out ${
          chatPosition === "left" ? "order-1 border-r" : "order-2 border-l"
        } ${
          shouldShowChat
            ? "opacity-100"
            : "opacity-0 pointer-events-none"
        }`}
        style={{
          // Kişiler paneli gizliyse sohbet tüm alanı kaplar; kontrol çubuğu altta kalsın diye altta boşluk bırakılır
          width: shouldShowChat ? (showVoicePanel ? `${chatWidth}px` : "100%") : "0px",
          paddingBottom: shouldShowChat && !showVoicePanel && !controlBarHidden ? "104px" : 0,
          flexShrink: 0,
          transform:
            shouldShowChat
              ? "translateX(0)"
              : chatPosition === "left"
                ? "translateX(-20px)"
                : "translateX(20px)",
        }}
      >
        {(currentTextChannel || activeConversation) && (
          <>
            {/* Resizable Divider */}
            {showVoicePanel && showChatPanel && (
              <div
                onMouseDown={handleResizeStart}
                className={`absolute ${chatPosition === "left" ? "right-0" : "left-0"} top-0 bottom-0 w-1 bg-[#26272d] hover:bg-[#5865f2] cursor-col-resize transition-colors z-20 ${
                  isResizing ? "bg-[#5865f2]" : ""
                }`}
                style={{ userSelect: "none" }}
              >
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-0.5 h-12 bg-[#5865f2] rounded-full opacity-0 hover:opacity-100 transition-opacity"></div>
                </div>
              </div>
            )}
            {currentTextChannel ? (
              <ChatView
                channelId={currentTextChannel}
                username={username}
                userId={userId}
              />
            ) : (
              <DMConversation 
                 onBack={() => {}} 
                 onStartCall={async (conversationId) => {
                     const store = useDMStore.getState();
                     if (activeConversation) {
                         await store.startCall(conversationId || activeConversation.id, userId);
                     }
                 }}
              />
            )}
          </>
        )}
      </div>
      {!showVoicePanel && (!showChatPanel || (!currentTextChannel && !activeConversation)) && (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-[#313338]">
          <Users size={32} className="opacity-50 mb-4" />
          <p>Görünüm gizli.</p>
        </div>
      )}
    </div>
  );
}

function LocalHiddenPlaceholder({ onShow, onStopSharing }) {
  return (
    <div className="flex flex-col h-full w-full bg-[#313338] items-center justify-center p-8 text-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/10 via-[#313338] to-[#313338]"></div>
      <div className="z-10 flex flex-col items-center animate-in fade-in zoom-in duration-300">
        <div className="w-28 h-28 glass-strong rounded-full flex items-center justify-center mb-6 shadow-xl border border-white/10 backdrop-blur-xl relative">
          <EyeOff size={44} className="text-[#949ba4]" />
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/5 to-transparent"></div>
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">
          Önizleme Gizlendi
        </h2>
        <p className="text-gray-400 text-sm max-w-sm mb-10 leading-relaxed">
          Yayının devam ediyor. Performansı artırmak ve ayna etkisini önlemek
          için önizlemeyi kapattın.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onShow}
            className="glass-strong hover:glass border border-white/10 hover:border-white/20 text-white px-6 py-3 rounded-xl font-semibold shadow-soft-lg transition-all duration-200 flex items-center gap-2.5 hover:scale-105 hover:shadow-glow backdrop-blur-xl group"
          >
            <Eye
              size={18}
              className="group-hover:scale-110 transition-transform"
            />
            <span>Önizlemeyi Aç</span>
          </button>
          <button
            onClick={onStopSharing}
            className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-6 py-3 rounded-xl font-semibold shadow-soft-lg transition-all duration-200 flex items-center gap-2.5 hover:scale-105 hover:shadow-glow-red border border-red-500/30 group"
          >
            <StopCircle
              size={18}
              className="group-hover:scale-110 transition-transform"
            />
            <span>Yayını Durdur</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// 🤝 POINTER CAPTURE COMPONENT
// İzleyicinin fare hareketlerini, tıklamalarını ve çizimlerini yayıncıya gönderir.
//  - İşaretle modu: imleç gösterilir, tıklayınca herkesin ekranında dalga çıkar ("tam şurası")
//  - Çiz modu: basılı tutup çizilir; çizgiler birkaç saniye sonra kendiliğinden silinir
// Koordinatlar videonun GERÇEK görüntü alanına göre normalize edilir (siyah boşluklar hariç).
function PointerCapture({ targetParticipant, containerRef }) {
  const { localParticipant } = useLocalParticipant();
  const [mode, setMode] = useState("point"); // 'point' | 'draw'
  const modeRef = useRef("point");
  const lastSentRef = useRef(0);

  useEffect(() => { modeRef.current = mode; }, [mode]);

  const targetId = targetParticipant?.identity;

  const getMeta = useCallback(() => {
    try {
      const md = localParticipant?.metadata ? JSON.parse(localParticipant.metadata) : {};
      return {
        displayName: md.displayName || localParticipant?.name || localParticipant?.identity,
        color: md.profileColor || "#6366f1",
      };
    } catch (e) {
      return { displayName: localParticipant?.identity, color: "#6366f1" };
    }
  }, [localParticipant]);

  const publish = useCallback((topic, payload, reliable = true) => {
    try {
      localParticipant?.publishData(
        new TextEncoder().encode(JSON.stringify({ type: topic, participantId: localParticipant.identity, targetId, ...payload })),
        { topic, reliable },
      );
    } catch (e) {}
  }, [localParticipant, targetId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !localParticipant || !targetId) return;

    const myId = localParticipant.identity;
    let stroke = null; // { id, pending: [], lastFlush }

    // Fare → videonun görüntülendiği alana göre 0..1 (alan dışındaysa null)
    const toNormalized = (e, clampToVideo = false) => {
      const cRect = container.getBoundingClientRect();
      const cr = getVideoContentRect(container);
      if (!cr.width || !cr.height) return null;
      let x = (e.clientX - cRect.left - cr.left) / cr.width;
      let y = (e.clientY - cRect.top - cr.top) / cr.height;
      if (clampToVideo) {
        x = Math.max(0, Math.min(1, x));
        y = Math.max(0, Math.min(1, y));
      } else if (x < 0 || x > 1 || y < 0 || y > 1) {
        return null;
      }
      return { x, y };
    };

    const isToolbar = (e) => !!e.target?.closest?.("[data-pointer-toolbar]");

    const flushStroke = (force = false) => {
      if (!stroke || stroke.pending.length === 0) return;
      const now = Date.now();
      if (!force && now - stroke.lastFlush < 40) return;
      stroke.lastFlush = now;
      const points = stroke.pending.splice(0, stroke.pending.length);
      const { color } = getMeta();
      publish(CURSOR_TOPICS.DRAW, { strokeId: stroke.id, color, points });
    };

    const handlePointerMove = (e) => {
      if (isToolbar(e)) return;

      // Çizim sırasında noktaları topla (kutu dışına taşsa da videoya sıkıştır)
      if (stroke && (e.buttons & 1)) {
        const p = toNormalized(e, true);
        if (p) {
          stroke.pending.push([p.x, p.y]);
          const { color } = getMeta();
          addStrokePoints({ strokeId: stroke.id, pid: myId, targetId, color, points: [[p.x, p.y]] });
          flushStroke();
        }
      }

      // İmleç konumu (30fps)
      const now = Date.now();
      if (now - lastSentRef.current < 33) return;
      const p = toNormalized(e);
      if (!p) return;
      lastSentRef.current = now;
      const { displayName, color } = getMeta();
      publish(CURSOR_TOPICS.POSITION, {
        x: p.x, y: p.y,
        screenWidth: container.clientWidth, screenHeight: container.clientHeight,
        displayName, color,
      }, false);
    };

    const handlePointerDown = (e) => {
      if (isToolbar(e)) return;
      // Shift + sağ tık: işaret değil, yayının menüsü (hızlı mesaj) için ayrıldı
      if (e.button === 2 && e.shiftKey) return;
      // Çizim yalnızca sol tuşla; işaretlemede sol / orta / sağ tık ayrı renkte dalga üretir
      const isDraw = modeRef.current === "draw" && e.button === 0;
      if (!isDraw && e.button > 2) return;
      const p = toNormalized(e, isDraw);
      if (!p) return;
      const { color } = getMeta();
      if (e.button === 1) e.preventDefault(); // orta tık otomatik kaydırmayı başlatmasın

      if (isDraw) {
        stroke = { id: `${myId}-${Date.now()}`, pending: [[p.x, p.y]], lastFlush: 0 };
        addStrokePoints({ strokeId: stroke.id, pid: myId, targetId, color, points: [[p.x, p.y]] });
        try { e.target.setPointerCapture?.(e.pointerId); } catch (err) {}
        flushStroke(true);
      } else {
        // Tıklama geri bildirimi: hem kendi ekranında hem herkeste dalga
        addClick({ targetId, x: p.x, y: p.y, color, button: e.button });
        publish(CURSOR_TOPICS.CLICK, { x: p.x, y: p.y, color, button: e.button });
      }
    };

    const endStroke = () => {
      if (!stroke) return;
      flushStroke(true);
      stroke = null;
    };

    const handlePointerLeave = (e) => {
      if (e.pointerType && e.pointerType !== "mouse") return;
      if (stroke) return; // çizerken kutu dışına çıkmak imleci gizlemesin
      publish(CURSOR_TOPICS.HIDE, {});
    };

    const handleKey = (e) => {
      if (e.key === "Escape") setMode("point");
    };

    container.addEventListener("pointermove", handlePointerMove, { passive: true });
    container.addEventListener("pointerdown", handlePointerDown);
    container.addEventListener("pointerup", endStroke);
    container.addEventListener("pointercancel", endStroke);
    container.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("keydown", handleKey);

    return () => {
      endStroke();
      container.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("pointerup", endStroke);
      container.removeEventListener("pointercancel", endStroke);
      container.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("keydown", handleKey);
    };
  }, [localParticipant, containerRef, targetId, publish, getMeta]);

  const clearMine = () => {
    if (!localParticipant) return;
    clearStrokesOf(localParticipant.identity, targetId);
    publish(CURSOR_TOPICS.DRAW_CLEAR, {});
  };

  const btn = (active) =>
    `flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all active:scale-95 ${
      active ? "bg-white text-emerald-700 shadow" : "text-white/90 hover:bg-white/15"
    }`;

  return (
    <div
      className="absolute inset-0 z-40 group/pointer-capture cursor-crosshair"
      style={{ touchAction: "none" }}
      // Sağ tık işaret olarak kullanılıyor: yayın kutusunun bağlam menüsü açılmasın
      onContextMenu={(e) => {
        if (e.shiftKey) return; // Shift + sağ tık: yayının menüsü açılsın (hızlı mesaj)
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* ✨ Kenar parıltısı: işaretçi / çizim modunda olduğunu belli eder */}
      <div className={`absolute inset-0 border-2 pointer-events-none transition-opacity duration-300 ${
        mode === "draw" ? "border-amber-400/60 opacity-100" : "border-emerald-500/30 opacity-0 group-hover/pointer-capture:opacity-100"
      }`} />

      {/* Araç çubuğu: İşaretle / Çiz / Temizle */}
      <div
        data-pointer-toolbar
        className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-emerald-600/90 backdrop-blur-md p-1 rounded-full shadow-lg animate-in slide-in-from-top-4"
      >
        <button type="button" className={btn(mode === "point")} onClick={() => setMode("point")} title="İşaretle: tıklayınca herkesin ekranında dalga çıkar">
          <MousePointer2 size={12} />
          <span>İşaretle</span>
        </button>
        <button type="button" className={btn(mode === "draw")} onClick={() => setMode("draw")} title="Çiz: basılı tutup çizin (Esc ile çıkın)">
          <Pencil size={12} />
          <span>Çiz</span>
        </button>
        <span
          className="flex items-center gap-1 px-1.5"
          title="Tıklama renkleri: sol = mavi, orta = yeşil, sağ = kırmızı. Shift + sağ tık: hızlı mesaj menüsü"
        >
          <span className="w-2 h-2 rounded-full bg-[#3b82f6]" />
          <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
          <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
        </span>
        <button type="button" className={btn(false)} onClick={clearMine} title="Çizimlerimi temizle">
          <Eraser size={12} />
        </button>
      </div>
    </div>
  );
}

// --- STAGE OVERLAY COMPONENTS ---
const StageOverlay = React.memo(
  ({
    showOverlay,
    showCursor,
    isLocalSharing,
    isAudioDisabled,
    volume,
    isFullscreen,
    participant,
    trackRef,
    onStopWatching,
    onHideLocal,
    toggleMuteStream,
    toggleFullscreen,
    setVolume,
    compact,
    onRequestPointing,
    onReleasePointing,
    hasPointingPermission,
    isPointingRequested,
    allowedPointers,
    onRevokePointing
  }) => {
    // COMPACT MODE: thumbnail'larda sadece küçük bir isim badge'i göster
    if (compact) {
      return (
        <>
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
          <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between z-50 pointer-events-none">
            <div className="flex items-center gap-1 bg-black/50 backdrop-blur-sm px-1.5 py-0.5 rounded-md border border-white/[0.08]">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-semibold text-white/80 truncate max-w-[100px]">
                {isLocalSharing
                  ? trackRef.source === Track.Source.Camera
                    ? "Kameran"
                    : "Yayının"
                  : participant?.name || participant?.identity || "Kullanıcı"}
              </span>
            </div>
            <WatcherCountBadge participantIdentity={participant?.identity} compact={true} />
          </div>
        </>
      );
    }

    return (
      <>
        {/* Overlay Gradients - Top and Bottom only (Center remains clear) */}
        <div
          className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-500 pointer-events-none will-change-opacity ${
            showOverlay ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          className={`absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-500 pointer-events-none will-change-opacity ${
            showOverlay ? "opacity-100" : "opacity-60"
          }`}
        />

        {/* Top Bar - Premium Design */}
        <div className="absolute top-0 left-0 right-0 flex justify-between items-start p-4 sm:p-6 z-50 pointer-events-none">
          <div
            className={`flex items-center gap-2 sm:gap-3 backdrop-blur-md bg-white/[0.08] px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl border border-white/[0.12] shadow-xl transition-all duration-500 pointer-events-auto hover:scale-105 will-change-transform ${
              showOverlay ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="relative flex-shrink-0">
              <div className="absolute inset-0 bg-red-500 rounded-xl blur-md opacity-75 animate-pulse" />
              <div className="relative bg-red-500 px-2.5 sm:px-3 py-1 rounded-xl text-[10px] sm:text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                Canlı
              </div>
            </div>
            <span className="text-white font-bold drop-shadow-lg text-sm sm:text-base tracking-tight">
              {isLocalSharing
                ? "Senin Yayının"
                : trackRef.source === Track.Source.ScreenShare
                  ? `${participant?.name || participant?.identity || "Kullanıcı"} yayını`
                  : `${participant?.name || participant?.identity || "Kullanıcı"} kamerası`}
            </span>
            
            {/* 🤝 Collaborative Pointing Request Button */}
            {!isLocalSharing && trackRef.source === Track.Source.ScreenShare && (
              <button
                onClick={hasPointingPermission || isPointingRequested ? onReleasePointing : onRequestPointing}
                className={`ml-2 px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all duration-200 border ${
                   hasPointingPermission
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
                    : isPointingRequested
                      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                      : "bg-white/5 text-[#b5bac1] border-white/5 hover:bg-white/10 hover:text-white group-hover:border-white/10"
                }`}
                title={hasPointingPermission ? "İşaretlemeyi kapatmak için tıkla" : isPointingRequested ? "İsteği geri çekmek için tıkla" : "Ekran sahibinden işaretçi izni iste"}
              >
                <div className="relative flex items-center">
                   {isPointingRequested && !hasPointingPermission && (
                      <div className="absolute inset-0 bg-amber-400 rounded-full blur-sm opacity-40 animate-pulse" />
                   )}
                   <MousePointer2 size={14} className={hasPointingPermission ? "text-emerald-400" : ""} />
                </div>
                <span>
                   {hasPointingPermission 
                     ? "İstediğini Gösterebilirsin" 
                     : isPointingRequested 
                       ? "Yanıt bekleniyor..." 
                       : "İşaretle"}
                </span>
              </button>
            )}

            {/* 💬 Yayıncıya kayan yazı gönder (mikrofon kapalıyken söyleyeceğini yaz) */}
            {!isLocalSharing && trackRef.source === Track.Source.ScreenShare && (
              <TickerMessageButton targetParticipant={participant} />
            )}

            {/* 🖥️ Overlay Aç butonu (Sharer side) */}
            {isLocalSharing && trackRef.source === Track.Source.ScreenShare && (
              <button
                onClick={() => {
                  if (window.netrex?.updatePointerOverlay) {
                    // Boş data ile tetikle — overlay oluşturulup gösterilecek (forceShow=true)
                    window.netrex.updatePointerOverlay([], true);
                  }
                }}
                className="ml-2 px-2 py-1 rounded-lg text-[10px] font-medium flex items-center gap-1 transition-all duration-200 border bg-indigo-500/10 text-indigo-300 border-indigo-500/20 hover:bg-indigo-500/20 hover:text-indigo-200"
                title="Masaüstü imleç overlay'ini aç"
              >
                <MousePointer2 size={12} />
                <span>Overlay</span>
              </button>
            )}

            {/* 🤝 Managed Pointers (Sharer side) — Ekranını paylaşırken kimlerin izni olduğunu gör */}
            {isLocalSharing && (
               <div className="flex items-center gap-1.5 ml-3">
                  {Object.entries(allowedPointers || {})
                    .filter(([_, data]) => data)
                    .map(([id, data]) => (
                       <div 
                        key={id}
                        className="group/pointer-item relative"
                       >
                          <div 
                            className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-[10px] text-emerald-400 font-bold shadow-lg backdrop-blur-md cursor-help overflow-hidden"
                            title={`${data.displayName || id} işaretleme yapabiliyor`}
                          >
                             {data.displayName ? data.displayName.charAt(0).toUpperCase() : id.slice(0, 2).toUpperCase()}
                          </div>
                          {/* Revoke Button on Hover */}
                          <button
                            onClick={() => onRevokePointing && onRevokePointing(id)}
                            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/pointer-item:opacity-100 transition-opacity shadow-lg hover:scale-110"
                            title="İzni Geri Al"
                          >
                             <X size={10} strokeWidth={4} />
                          </button>
                       </div>
                    ))
                  }
               </div>
            )}
          </div>
          <div className="flex gap-2 pointer-events-auto">
            {isLocalSharing && trackRef.source !== Track.Source.Camera && (
              <button
                onClick={onHideLocal}
                title="Önizlemeyi gizle"
                className={`backdrop-blur-md bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] text-white/70 hover:text-white p-2 sm:p-2.5 rounded-2xl transition-all duration-200 hover:scale-110 will-change-transform ${
                  showOverlay ? "opacity-100" : "opacity-0"
                }`}
              >
                <EyeOff size={18} />
              </button>
            )}
            <button
              onClick={onStopWatching}
              title="İzlemeyi kapat"
              className={`backdrop-blur-md bg-white/[0.06] hover:bg-red-500/20 border border-white/[0.12] text-white/70 hover:text-red-400 p-2 sm:p-2.5 rounded-2xl transition-all duration-200 hover:scale-110 will-change-transform ${
                showOverlay ? "opacity-100" : "opacity-0"
              }`}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Bottom Controls - responsive visibility */}
        <div 
          className={`absolute inset-0 z-50 flex flex-col justify-end p-4 sm:p-6 pointer-events-none transition-all duration-500 will-change-opacity ${
            showOverlay ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <div className="pointer-events-auto flex justify-between items-end gap-4">
            <div className="flex items-center gap-2 bg-[#2b2d31]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 shadow-soft">
              <Users size={14} className="text-indigo-400" />
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#949ba4] font-medium">
                  İzleyici
                </span>
                <WatcherCountBadge participantIdentity={participant?.identity} compact={false} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3">
                {isAudioDisabled && !isLocalSharing ? (
                  <div className="flex items-center gap-2 text-yellow-400 text-xs font-bold px-3 py-1.5 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                    <AlertTriangle size={18} />
                    <span>Ses Kapalı</span>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={toggleMuteStream}
                      className={`p-2 rounded-xl transition-all duration-200 hover:scale-110 border border-white/10 backdrop-blur-sm bg-black/30 relative flex items-center justify-center ${
                        volume === 0 ? "text-red-400" : "text-white"
                      }`}
                    >
                      {volume === 0 ? (
                        <VolumeX size={18} />
                      ) : volume < 50 ? (
                        <Volume1 size={18} />
                      ) : (
                        <Volume2 size={18} />
                      )}
                      {/* Audio activity indicator (minimalist) - visual feedback fix */}
                      {volume > 0 && !isAudioDisabled && (
                         <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5 items-end h-1">
                            <div className="w-0.5 h-full bg-indigo-400/80 rounded-full animate-bounce" style={{ animationDuration: '0.6s' }}></div>
                            <div className="w-0.5 h-[60%] bg-indigo-400/80 rounded-full animate-bounce" style={{ animationDuration: '0.4s' }}></div>
                            <div className="w-0.5 h-[80%] bg-indigo-400/80 rounded-full animate-bounce" style={{ animationDuration: '0.5s' }}></div>
                         </div>
                      )}
                    </button>
                    <div className="flex items-center bg-black/30 backdrop-blur-sm rounded-xl border border-white/10 px-2 group/volume relative">
                      <input
                        type="range"
                        min="0"
                        max="200"
                        value={volume}
                        onChange={(e) => setVolume(Number(e.target.value))}
                        className="w-24 sm:w-32 accent-[#5865f2] h-6 cursor-pointer"
                      />
                      {/* Volume tooltip on hover/interaction */}
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-[#5865f2] text-white text-[10px] font-bold px-2 py-1 rounded-md opacity-0 group-hover/volume:opacity-100 transition-opacity shadow-lg pointer-events-none">
                         %{volume}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={toggleFullscreen}
                title={
                  isFullscreen ? "Tam ekrandan çık (ESC)" : "Tam ekran yap"
                }
                className="p-2.5 rounded-xl border border-white/10 text-white hover:bg-indigo-500/20 transition-all duration-200 hover:scale-110 backdrop-blur-sm flex items-center gap-1.5"
              >
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  },
);

function ScreenShareStage({
  trackRef,
  onStopWatching,
  onUserContextMenu,
  onContextMenu: onContextMenuProp,
  onDoubleClick: onDoubleClickProp,
  isLocalSharing,
  onHideLocal,
  amISharing,
  setPinnedStreamIds,
  pinnedStreamIds,
  compact = false,
}) {
  const disableBackgroundEffects = useSettingsStore(
    (state) => state.disableBackgroundEffects,
  );
  const cameraMirrorEffect = useSettingsStore(
    (state) => state.cameraMirrorEffect,
  );

  const [volume, setVolume] = useState(50);
  const [prevVolume, setPrevVolume] = useState(50);
  const fsId = useStageFsId();
  const [showOverlay, setShowOverlay] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const { localParticipant } = useLocalParticipant();
  const containerRef = useRef(null);
  const audioRef = useRef(null);
  const mouseMoveTimeoutRef = useRef(null);
  const cursorTimeoutRef = useRef(null);

  const participant = trackRef?.participant;
  const myStreamId = `${participant?.identity}:${trackRef?.source === Track.Source.ScreenShare ? "screen" : "camera"}`;
  const isFullscreen = !!fsId && fsId === myStreamId;

  const audioTracks = useTracks([Track.Source.ScreenShareAudio]);
  const audioTrackRef = audioTracks.find(
    (t) => t.participant.sid === participant?.sid,
  );
  
  // 🚀 FIX: Yayın ses ayarı her zaman görünmeli (remote screen share ise)
  // Kullanıcı ses track'i gelmeden önce de ayarı görebilmeli.
  const isAudioDisabled = isLocalSharing || (trackRef.source !== Track.Source.ScreenShare && !audioTrackRef);

  // 🖱️ Cursor Broadcast — yayıncı ise cursor'unu gönder
  const { 
    requestPointing, 
    grantPointing, 
    denyPointing,
    releasePointing,
    myPermissions,
    pointingRequests,
    allowedPointers 
  } = useCursorBroadcast({ isScreenSharing: isLocalSharing });

  // 🤝 Collaborative Pointing State
  // Viewer bizzat kendi iznini kontrol eder (yayıncı Id'sine göre)
  const hasPointingPermission = myPermissions[participant?.identity] || false;
  
  // Viewer yayındaki kişiye istek gönderip göndermediğini anlık bilebilmeli
  const pendingRequests = useCursorShareStore(s => s.pendingRequests) || {};
  const isPointingRequested = pendingRequests[participant?.identity] && !isLocalSharing; 

  // Şimdilik toast ve myPermissions yeterli.

  useEffect(() => {
    const audioEl = audioRef.current;
    const track = audioTrackRef?.publication?.track;

    if (track && audioEl) {
      track.attach(audioEl);
    }
    return () => {
      // ✅ Captured variables kullan (stale ref önleme)
      if (track && audioEl) {
        track.detach(audioEl);
        // ✅ Audio element'in srcObject'ini temizle (memory leak önleme)
        audioEl.srcObject = null;
        audioEl.pause();
      }
    };
  }, [audioTrackRef]);

  useEffect(() => {
    if (audioRef.current) {
      // Agresif ses kapatma: tüm yöntemleri kullan
      if (volume === 0) {
        // 1. Audio element'i mute et
        audioRef.current.muted = true;
        // 2. Volume'u 0 yap
        audioRef.current.volume = 0;
        // 3. Audio element'i devre dışı bırak (ekstra güvenlik)
        audioRef.current.pause();
        // 4. Track'in mediaStreamTrack'ini de mute et (eğer varsa)
        if (audioTrackRef?.publication?.track?.mediaStreamTrack) {
          audioTrackRef.publication.track.mediaStreamTrack.enabled = false;
        }
      } else {
        // Ses açıldığında tüm kontrolleri geri al
        audioRef.current.muted = false;
        // Logaritmik (exponential) mapping: ses algısı logaritmik olduğu için
        // Linear mapping yerine exponential kullanıyoruz
        // Formül:
        // - 0-100%: volume = (percent/100)^2.5 (daha hassas düşük ses kontrolü)
        // - 100-200%: volume = 1.0 - (200-percent)/100 * 0.2 (100%'den 200%'e yumuşak artış, max 1.0)
        // NOT: HTMLMediaElement volume 0-1 aralığında olmalı, bu yüzden 1.0 ile sınırlıyoruz
        // %100-200 arası için daha hassas kontrol sağlamak için exponential mapping kullanıyoruz
        // 100% = 1.0, 150% = 0.9, 200% = 0.8 (daha yumuşak eğri)
        const mappedVolume =
          volume === 0
            ? 0
            : volume <= 100
              ? Math.pow(volume / 100, 2.5) // 0-100% arası için exponential
              : Math.min(1.0 - ((200 - volume) / 100) * 0.2, 1.0); // 100-200% arası için yumuşak artış, ama max 1.0 (HTMLMediaElement limiti)
        audioRef.current.volume = mappedVolume;
        audioRef.current.play().catch(() => {}); // AutoPlay policy nedeniyle hata olabilir, yoksay
        // Track'i tekrar aktif et
        if (audioTrackRef?.publication?.track?.mediaStreamTrack) {
          audioTrackRef.publication.track.mediaStreamTrack.enabled = true;
        }
      }
    }
  }, [volume, audioTrackRef]);

  const toggleMuteStream = () => {
    if (isAudioDisabled) return;
    if (volume > 0) {
      setPrevVolume(volume);
      setVolume(0);
    } else {
      setVolume(prevVolume > 0 ? prevVolume : 50);
    }
  };
  const toggleFullscreen = useCallback(() => {
    if (stageFs.id === myStreamId) stageFs.exit();
    else stageFs.request(myStreamId);
  }, [myStreamId]);

  // Mouse movement tracking - overlay ve cursor kontrolü
  // 🚀 OPTIMIZATION: Throttle eklendi
  const lastOverlayMouseMoveRef = useRef(0);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = () => {
      // 🚀 THROTTLE: 200ms aralıklarla işle (CPU Optimizasyonu v5.3)
      const now = Date.now();
      if (now - lastOverlayMouseMoveRef.current < 200) return;
      lastOverlayMouseMoveRef.current = now;

      // Overlay'i göster
      setShowOverlay(true);
      setShowCursor(true);

      // Önceki timeout'ları temizle
      if (mouseMoveTimeoutRef.current) {
        clearTimeout(mouseMoveTimeoutRef.current);
      }
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }

      // 2 saniye hareketsizlikten sonra overlay'i gizle
      mouseMoveTimeoutRef.current = setTimeout(() => {
        setShowOverlay(false);
      }, 2000);

      // 2 saniye hareketsizlikten sonra cursor'u gizle
      cursorTimeoutRef.current = setTimeout(() => {
        setShowCursor(false);
      }, 800);
    };

    const handleMouseEnter = () => {
      setShowOverlay(true);
      setShowCursor(true);
    };

    container.addEventListener("mousemove", handleMouseMove, { passive: true });
    container.addEventListener("mouseenter", handleMouseEnter);

    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseenter", handleMouseEnter);
      if (mouseMoveTimeoutRef.current) {
        clearTimeout(mouseMoveTimeoutRef.current);
      }
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }
    };
  }, []);

  const remoteState = useMemo(() => {
    try {
      return participant?.metadata ? JSON.parse(participant.metadata) : {};
    } catch {
      return {};
    }
  }, [participant?.metadata]);

  // Tam ekranda: öğe sahne kökünün (tam ekran hedefi) içine taşınır ve tüm ekranı kaplar. Yayın kapanırsa kök kalır,
  // tam ekran bozulmaz; yayın geri gelince bu öğe yeniden aynı yere yerleşir (kullanıcı hareketi gerekmez).
  const fullscreenHost = isFullscreen ? stageFs.root : null;
  const stageBody = (
    <div
      ref={containerRef}
      data-stage-container
      data-stream-id={myStreamId}
      onContextMenu={onContextMenuProp}
      className={`flex flex-col bg-gradient-to-br from-[#1a1b1f] via-[#141518] to-[#0e0f12] relative overflow-hidden ${
        fullscreenHost ? "absolute inset-0 z-[60]" : "h-full w-full"
      }`}
    >
      {/* Ambient background orbs - only in non-compact mode */}
      {!compact && !disableBackgroundEffects && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-500/[0.04] rounded-full blur-[60px] animate-pulse-slow" />
          <div
            className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-purple-500/[0.03] rounded-full blur-[50px] animate-pulse-slow"
            style={{ animationDelay: "1s" }}
          />
        </div>
      )}

      <div
        onDoubleClick={toggleFullscreen}
        className={`flex-1 relative flex items-center justify-center overflow-hidden ${
          !showCursor ? "cursor-none" : ""
        }`}
        style={{ cursor: showCursor ? "default" : "none" }}
      >
        <VideoTrack
          key={
            trackRef?.participant?.identity ||
            trackRef?.publication?.trackSid ||
            "video-track"
          }
          trackRef={trackRef}
          className="max-w-full max-h-full object-contain shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
          style={{
            // Kamera track'i için ayna efekti sadece yerel katılımcıya uygula
            transform:
              trackRef.source === Track.Source.Camera &&
              trackRef.participant?.isLocal &&
              cameraMirrorEffect
                ? "scaleX(-1)"
                : undefined,
          }}
        />
        {!isLocalSharing && trackRef.source === Track.Source.ScreenShare && (
          <audio ref={audioRef} autoPlay />
        )}

        {/* 🖱️ Remote Cursor Overlay — Herkes görür (Yayıncı izleyicileri, izleyiciler yayıncıyı/diğerlerini) */}
        {trackRef.source === Track.Source.ScreenShare && (
          <CursorOverlay 
            containerRef={containerRef} 
            sharerId={participant?.identity}
          />
        )}
        {/* 🤝 Pointer Capture — SADECE izleyiciyseniz VE izniniz varsa mouse hareketlerinizi göndeririz */}
        {!isLocalSharing && hasPointingPermission && trackRef.source === Track.Source.ScreenShare && (
           <PointerCapture 
              targetParticipant={participant}
              containerRef={containerRef}
           />
        )}

        <StageOverlay
          showOverlay={(!isLocalSharing && hasPointingPermission && isFullscreen) ? false : showOverlay}
          showCursor={(!isLocalSharing && hasPointingPermission && isFullscreen) ? true : showCursor}
          isLocalSharing={isLocalSharing}
          isAudioDisabled={isAudioDisabled}
          volume={volume}
          isFullscreen={isFullscreen}
          participant={participant}
          trackRef={trackRef}
          onStopWatching={onStopWatching}
          onHideLocal={onHideLocal}
          toggleMuteStream={toggleMuteStream}
          toggleFullscreen={toggleFullscreen}
          setVolume={setVolume}
          compact={compact}
          onRequestPointing={() => requestPointing(participant?.identity)}
          onReleasePointing={() => releasePointing(participant?.identity)}
          hasPointingPermission={hasPointingPermission}
          isPointingRequested={isPointingRequested}
          allowedPointers={allowedPointers}
          onRevokePointing={(pid) => denyPointing(pid)}
        />
      </div>
    </div>
  );
  return fullscreenHost ? createPortal(stageBody, fullscreenHost) : stageBody;
}

export default StageManager;
