import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { Track, RoomEvent, ConnectionState } from "livekit-client";
import {
  Mic,
  MicOff,
  Headphones,
  VolumeX,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  ChevronUp,
  ChevronDown,
  Music,
  Hand,
  UserPlus,
  Radar,
  SwitchCamera,
  Camera,
  Check
} from "lucide-react";
import { createPortal } from "react-dom";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useChatStore } from "@/src/store/chatStore";
import { useShallow } from "zustand/react/shallow";
import { useWatchPartyStore } from "@/src/store/watchPartyStore";
import { useWatchPartyPermission } from "@/src/hooks/useWatchPartyPermission";
import { useAuthStore } from "@/src/store/authStore";
import { startWatchParty, endWatchParty } from "@/src/services/watchPartyService";
import { toast, toastOnce } from "@/src/utils/toast";
import { useSpatialAudioStore } from "@/src/store/spatialAudioStore";
import { VoiceGroupsControl } from "./VoiceGroupsUI";
import GamesButton from "@/src/modules/games/GamesButton";
import ScreenShareModal from "../ScreenShareModal";

// Ekran paylaşımı video codec'i ("h264" = GPU kodlayıcı; yedek: "vp8"). Ölçüm gerekçesi publishTrack'in yanında.
const SCREEN_SHARE_CODEC = "h264";
import TtsStopBadge from "../TtsStopBadge";
function ControlButton({
  isActive,
  activeIcon,
  inactiveIcon,
  onClick,
  tooltip,
  danger,
  disabled,
}) {
  const handleClick = (e) => {
    if (disabled) return;
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      title={tooltip}
      disabled={disabled}
      className={`w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl transition duration-300 relative group ${
        disabled
          ? "opacity-40 cursor-not-allowed bg-white/5 border border-white/5 text-white/40"
          : danger
          ? "bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] active:scale-95"
          : isActive
          ? "bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20 active:scale-95"
          : "bg-[#1e1f22] border border-white/5 text-[#b5bac1] hover:bg-white hover:text-black hover:border-white hover:shadow-[0_0_20px_rgba(255,255,255,0.2)] active:scale-95"
      }`}
    >
      
      {/* Icon Container */}
      <div className="relative z-10">
        {isActive ? activeIcon : inactiveIcon}
      </div>

      {/* Disabled Overlay - Çizgi */}
      {disabled && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[70%] h-[2px] bg-red-400/50 rotate-45 rounded-full" />
        </div>
      )}
    </button>
  );
}

export default function BottomControls({
  voicePanelHidden = false, // Kişiler paneli gizliyse sohbet tüm alanı kaplar; kontrol çubuğu sohbetin kenarına göre kaydırılmaz
  username,
  serverId,
  channelId,
  onLeave,
  onOpenSettings,
  isDeafened,
  playSound,
  setPinnedStreamIds,
  pinnedStreamIds,
  isCameraOn,
  setIsCameraOn,
  stopScreenShare,
  serverMuted,
  serverDeafened,
  isMuted,
  onMuteToggle,
  onDeafenToggle,
  mutedBy,
  deafenedBy,
  mutedAt,
  deafenedAt,
  isDMCall, // new prop check
  onInviteClick, // new prop callback
}) {
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const profileColor = useSettingsStore(state => state.profileColor);
  const enableCamera = useSettingsStore(state => state.enableCamera);
  const videoId = useSettingsStore(state => state.videoId);
  const videoResolution = useSettingsStore(state => state.videoResolution);
  const videoFrameRate = useSettingsStore(state => state.videoFrameRate);
  const videoCodec = useSettingsStore(state => state.videoCodec);
  const controlBarHidden = useSettingsStore(state => state.controlBarHidden);
  const toggleControlBarHidden = useSettingsStore(state => state.toggleControlBarHidden);
  const watchPartyEnabled = useSettingsStore(state => state.watchPartyEnabled);
  const cameraMirrorEffect = useSettingsStore(state => state.cameraMirrorEffect);
  // Seçicisiz abonelik her sohbet mesajında alt kontrolleri de yeniden render ediyordu
  const { showChatPanel, chatPosition, chatWidth: storedChatWidth } = useChatStore(
    useShallow((s) => ({ showChatPanel: s.showChatPanel, chatPosition: s.chatPosition, chatWidth: s.chatWidth })),
  );
  // Kişiler paneli gizliyken sohbet tüm alanı kaplar: kontrol çubuğu yan tarafa değil ortaya yerleşir
  const chatWidth = voicePanelHidden ? 0 : storedChatWidth;
  const [showScreenShareModal, setShowScreenShareModal] = useState(false);
  const [showScreenShareMenu, setShowScreenShareMenu] = useState(false);
  const screenShareMenuRef = useRef(null);
  const screenShareButtonRef = useRef(null);
  
  // ✅ FIX: State'i ref'te tut - mousedown listener'ının dependency olmasını önle
  const showScreenShareMenuRef = useRef(false);
  const showWatchPartyMenuRef = useRef(false);
  
  const [showWatchPartyMenu, setShowWatchPartyMenu] = useState(false);
  const watchPartyMenuRef = useRef(null);
  const watchPartyButtonRef = useRef(null);

  // Ref'leri state ile senkronize tut
  useEffect(() => { showScreenShareMenuRef.current = showScreenShareMenu; }, [showScreenShareMenu]);
  useEffect(() => { showWatchPartyMenuRef.current = showWatchPartyMenu; }, [showWatchPartyMenu]);

  const isScreenSharing = localParticipant?.isScreenShareEnabled;
  const hasSentInitialMetadataRef = useRef(false); // İlk metadata gönderildi mi?
  
  const quickStatus = useSettingsStore(state => state.quickStatus);
  const toggleLastQuickStatus = useSettingsStore(state => state.toggleLastQuickStatus);

  // Watch Party
  const wpActive = useWatchPartyStore((state) => state.isActive);
  const currentUser = useAuthStore((s) => s.user);
  const wpPermissions = useWatchPartyPermission(serverId);

  // 🎧 Spatial Audio
  const spatialEnabled = useSpatialAudioStore(s => s.enabled);
  const toggleSpatial = useSpatialAudioStore(s => s.toggleEnabled);
  const setShowWindow = useSpatialAudioStore(s => s.setShowWindow);

  const [showSpatialMenu, setShowSpatialMenu] = useState(false);
  const showSpatialMenuRef = useRef(false);
  useEffect(() => { showSpatialMenuRef.current = showSpatialMenu; }, [showSpatialMenu]);
  const spatialMenuRef = useRef(null);
  const spatialButtonRef = useRef(null);

  // 📱 Ön/Arka Kamera Yönü & Kamera Seçim Menüsü
  const [cameraFacingMode, setCameraFacingMode] = useState("user");
  const [selectedCameraDeviceId, setSelectedCameraDeviceId] = useState(null);
  const [showCameraMenu, setShowCameraMenu] = useState(false);
  const [availableCameras, setAvailableCameras] = useState([]);
  const cameraMenuRef = useRef(null);
  // Menü body'ye taşınır (alt çubuğun taşma/dönüşüm bağlamından çıkar) ve butona göre ekran içinde konumlanır
  const cameraButtonRef = useRef(null);
  const cameraPopoverRef = useRef(null);
  const [cameraMenuPos, setCameraMenuPos] = useState(null);

  // Menüyü butonun üstüne, ekranın dışına taşmayacak şekilde yerleştir.
  // Eskiden butonun sağ kenarına hizalanıp 288px sola açılıyordu: telefonda buton ortada olduğu için sol kısmı ekran dışında kalıyordu.
  const computeCameraMenuPos = useCallback(() => {
    const btn = cameraButtonRef.current;
    if (!btn || typeof window === "undefined") return null;
    const r = btn.getBoundingClientRect();
    const margin = 16;
    const width = Math.min(288, window.innerWidth - margin * 2);
    const left = Math.max(margin, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - margin));
    return {
      left,
      width,
      bottom: window.innerHeight - r.top + 12,
      maxHeight: Math.max(160, r.top - 24),
    };
  }, []);

  // Açıkken ekran döndürme / yeniden boyutlandırmada konumu güncelle
  useEffect(() => {
    if (!showCameraMenu) return;
    const update = () => setCameraMenuPos(computeCameraMenuPos());
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [showCameraMenu, computeCameraMenuPos]);

  // Kamera menüsü dışına tıklandığında kapat
  useEffect(() => {
    if (!showCameraMenu) return;
    const handleClickOutside = (e) => {
      const insideButton = cameraMenuRef.current && cameraMenuRef.current.contains(e.target);
      const insidePopover = cameraPopoverRef.current && cameraPopoverRef.current.contains(e.target);
      if (!insideButton && !insidePopover) {
        setShowCameraMenu(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("touchstart", handleClickOutside);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showCameraMenu]);

  const stateRef = useRef({
    isMuted,
    isDeafened,
    localParticipant,
    profileColor,
    isCameraOn,
    serverMuted,
    serverDeafened,
    mutedBy,
    deafenedBy,
    mutedAt,
    deafenedAt,
    quickStatus,
  });
  useEffect(() => {
    stateRef.current = {
      isMuted,
      isDeafened,
      localParticipant,
      profileColor,
      isCameraOn,
      serverMuted,
      serverDeafened,
      mutedBy,
      deafenedBy,
      mutedAt,
      deafenedAt,
      quickStatus,
    };
  }, [isMuted, isDeafened, localParticipant, profileColor, isCameraOn, serverMuted, serverDeafened, mutedBy, deafenedBy, mutedAt, deafenedAt, quickStatus]);

  // Metadata update'i debounce et (timeout önlemek için)
  const metadataUpdateRef = useRef(null);
  const lastMetadataRef = useRef("");
  const isUpdatingMetadataRef = useRef(false);

  // Room bağlantı durumunu kontrol et
  const isRoomConnected = room?.state === ConnectionState.Connected;

  useEffect(() => {
    // Room bağlantısı tamamlanmadan önce metadata güncelleme yapma
    if (!isRoomConnected) {
      if (process.env.NODE_ENV === "development") {
        console.log(
          "⏳ Room bağlantısı tamamlanmadı, metadata güncellemesi bekleniyor"
        );
      }
      return;
    }

    if (!localParticipant) {
      if (process.env.NODE_ENV === "development") {
        console.log("⚠️ Local participant yok, metadata güncellenemedi");
      }
      return;
    }

    const newMetadata = JSON.stringify({
      isDeafened,
      isMuted,
      profileColor,
      photoURL: currentUser?.photoURL || null,
      displayName: currentUser?.displayName || currentUser?.username || null,
      isCameraOn,
      serverMuted,
      serverDeafened,
      quickStatus,
      watchingStreamId: pinnedStreamIds?.[0] || null, // Geri uyumluluk için ilkini tut
      watchingStreamIds: pinnedStreamIds || [], // Yeni: Birden fazla yayın izliyor olabilir
      mutedBy: serverMuted ? mutedBy : null,
      deafenedBy: serverDeafened ? deafenedBy : null,
      mutedAt: serverMuted ? mutedAt : null,
      deafenedAt: serverDeafened ? deafenedAt : null,
      cameraMirrorEffect: cameraMirrorEffect,
    });

    // Aynı metadata ise güncelleme yapma
    if (lastMetadataRef.current === newMetadata) {
      if (process.env.NODE_ENV === "development") {
        console.log("⏭️ Metadata değişmedi, güncelleme atlandı");
      }
      return;
    }

    if (process.env.NODE_ENV === "development") {
      console.log("🔄 Metadata güncelleniyor:", JSON.parse(newMetadata));
    }

    // Önceki timeout'u iptal et
    if (metadataUpdateRef.current) {
      clearTimeout(metadataUpdateRef.current);
    }

    // Yeni timeout başlat (300ms debounce)
    metadataUpdateRef.current = setTimeout(async () => {
      // Bağlantı durumunu tekrar kontrol et
      if (!isRoomConnected || room?.state !== ConnectionState.Connected) {
        if (process.env.NODE_ENV === "development") {
          console.log(
            "⏳ Room bağlantısı kesildi, metadata güncellemesi iptal edildi"
          );
        }
        isUpdatingMetadataRef.current = false;
        return;
      }

      // Eğer zaten güncelleme yapılıyorsa bekle
      if (isUpdatingMetadataRef.current) return;

      // Metadata değişmiş mi kontrol et
      if (lastMetadataRef.current === newMetadata) return;

      // Participant kontrolü
      if (!localParticipant) {
        isUpdatingMetadataRef.current = false;
        return;
      }

      isUpdatingMetadataRef.current = true;
      try {
        // setMetadata çağrısı yapılmadan önce room bağlantısının tamamlandığından emin ol
        await localParticipant.setMetadata(newMetadata);
        lastMetadataRef.current = newMetadata;
        if (process.env.NODE_ENV === "development") {
          console.log("✅ Metadata güncellendi:", JSON.parse(newMetadata));
        }
      } catch (error) {
        // Bağlantı hatalarını ve timeout hatalarını sessizce yoksay
        const errorMessage = error?.message || "";
        const shouldIgnore =
          errorMessage.includes("timeout") ||
          errorMessage.includes("Request to update") ||
          errorMessage.includes(
            "cannot send signal request before connected"
          ) ||
          errorMessage.includes("not connected") ||
          errorMessage.includes("before connected");

        if (!shouldIgnore) {
          console.warn("❌ Metadata update error:", error);
        } else {
          // Bağlantı hatası varsa, metadata'yı güncelleme (retry için)
          // lastMetadataRef.current'i güncelleme, böylece tekrar denenecek
          if (process.env.NODE_ENV === "development") {
            console.log(
              "⏳ Bağlantı hatası, metadata güncellemesi ertelendi:",
              errorMessage
            );
          }
        }
      } finally {
        isUpdatingMetadataRef.current = false;
      }
    }, 300); // 300ms debounce

    return () => {
      if (metadataUpdateRef.current) {
        clearTimeout(metadataUpdateRef.current);
      }
    };
  }, [
    isDeafened,
    isMuted,
    localParticipant,
    profileColor,
    isCameraOn,
    isRoomConnected,
    room,
    serverMuted,
    serverDeafened,
    mutedBy,
    deafenedBy,
    mutedAt,
    deafenedAt,
    quickStatus,
    pinnedStreamIds,
    cameraMirrorEffect
  ]);

  // Video track durumunu senkronize et (sadece event'lerde, sürekli kontrol yok)
  const isTogglingCameraRef = useRef(false); // Toggle sırasında event listener'ları devre dışı bırak
  const lastCameraStateRef = useRef(isCameraOn); // Son state'i takip et

  useEffect(() => {
    if (!localParticipant) return;

    // Track publish/unpublish event'lerini dinle
    const handleTrackPublished = (pub) => {
      if (pub.source === Track.Source.Camera && pub.participant.isLocal) {
        // Toggle sırasında event listener'ı devre dışı bırak
        if (isTogglingCameraRef.current) return;
        // Sadece state değiştiyse güncelle (sonsuz döngüyü önle)
        if (!lastCameraStateRef.current) {
          setIsCameraOn(true);
          lastCameraStateRef.current = true;
        }
      }
    };

    const handleTrackUnpublished = (pub) => {
      if (pub.source === Track.Source.Camera && pub.participant.isLocal) {
        // Toggle sırasında event listener'ı devre dışı bırak
        if (isTogglingCameraRef.current) return;
        // Sadece state değiştiyse güncelle (sonsuz döngüyü önle)
        if (lastCameraStateRef.current) {
          setIsCameraOn(false);
          lastCameraStateRef.current = false;
        }
      }
    };

    localParticipant.on(RoomEvent.TrackPublished, handleTrackPublished);
    localParticipant.on(RoomEvent.TrackUnpublished, handleTrackUnpublished);

    return () => {
      localParticipant.off(RoomEvent.TrackPublished, handleTrackPublished);
      localParticipant.off(RoomEvent.TrackUnpublished, handleTrackUnpublished);
    };
  }, [localParticipant]);

  // isCameraOn değiştiğinde ref'i güncelle
  useEffect(() => {
    lastCameraStateRef.current = isCameraOn;
  }, [isCameraOn]);

  const [mRequestTimeout, setMRequestTimeout] = useState(false);
  const [dRequestTimeout, setDRequestTimeout] = useState(false);

  const sendUnmuteRequest = useCallback(() => {
    if (mRequestTimeout) return;
    const payload = JSON.stringify({
      type: "MODERATION_REQUEST",
      userId: localParticipant?.identity,
      username: username || localParticipant?.name || localParticipant?.identity,
      action: "UNMUTE_REQUEST",
      timestamp: Date.now()
    });
    if (localParticipant) {
      localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
      toastOnce("Susturmanın kaldırılması için yetkililere talep gönderildi.", "success");
      setMRequestTimeout(true);
      setTimeout(() => setMRequestTimeout(false), 5000);
    }
  }, [localParticipant, username, mRequestTimeout]);

  const sendUndeafenRequest = useCallback(() => {
    if (dRequestTimeout) return;
    const payload = JSON.stringify({
      type: "MODERATION_REQUEST",
      userId: localParticipant?.identity,
      username: username || localParticipant?.name || localParticipant?.identity,
      action: "UNDEAFEN_REQUEST",
      timestamp: Date.now()
    });
    if (localParticipant) {
      localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
      toastOnce("Sağırlaştırmanın kaldırılması için yetkililere talep gönderildi.", "success");
      setDRequestTimeout(true);
      setTimeout(() => setDRequestTimeout(false), 5000);
    }
  }, [localParticipant, username, dRequestTimeout]);

  const toggleMute = useCallback(() => {
    const { isMuted, serverMuted } = stateRef.current;
    if (serverMuted) {
      sendUnmuteRequest();
      return;
    }
    onMuteToggle();
    playSound(!isMuted ? "mute" : "unmute");
  }, [playSound, onMuteToggle, sendUnmuteRequest]);

  const toggleDeaf = useCallback(() => {
    const { isDeafened, serverDeafened } = stateRef.current;
    if (serverDeafened) {
      sendUndeafenRequest();
      return;
    }
    onDeafenToggle();
    playSound(!isDeafened ? "deafen" : "undeafen");
  }, [playSound, onDeafenToggle, sendUndeafenRequest]);

  const toggleCamera = useCallback(async () => {
    if (!enableCamera) {
      toastOnce("Kamera erişimi Ayarlar'dan kapatılmış.", "error");
      return;
    }

    // Local participant'ı direkt hook'tan al (daha güvenli)
    if (!localParticipant) {
      console.error("❌ Local participant bulunamadı - kamera açılamadı");
      toastOnce("Kamera açılamadı: Bağlantı hatası", "error");
      return;
    }

    // Toggle başladığını işaretle (event listener'ları devre dışı bırak)
    isTogglingCameraRef.current = true;

    // State'i hemen güncelle (optimistic update) - 2 kere basma sorununu çözer
    const currentState = isCameraOn;
    const newState = !currentState;
    setIsCameraOn(newState);

    try {
      if (newState) {
        // Çözünürlük ayarlarını belirle
        const resolutionMap = {
          "240p": { width: 426, height: 240, bitrate: 120000 },
          "360p": { width: 640, height: 360, bitrate: 250000 },
          "480p": { width: 854, height: 480, bitrate: 450000 },
          "720p": { width: 1280, height: 720, bitrate: 750000 },
        };
        const selectedResolution = resolutionMap[videoResolution] || resolutionMap["720p"] || resolutionMap["480p"];
        const selectedFps = videoFrameRate || 18;

        // Önce eski video track'i kaldır (eğer varsa)
        const existingVideoTracks = localParticipant
          .getTrackPublications()
          .filter((pub) => pub.source === Track.Source.Camera);
        for (const trackPub of existingVideoTracks) {
          try {
            // Önce track'i durdur
            const existingTrack = trackPub.track;
            if (existingTrack) {
              existingTrack.stop();
              // Sonra unpublish et - publication'dan track'i al
              await localParticipant.unpublishTrack(existingTrack);
            }
          } catch (err) {
            console.warn("Eski video track kaldırılırken hata:", err);
          }
        }

        // Kamera stream'i al - Kullanıcı ayarlarına göre
        const constraints = {
          video: {
            deviceId: videoId && videoId !== "default" ? { ideal: videoId } : undefined,
            width: { ideal: selectedResolution.width },
            height: { ideal: selectedResolution.height },
            frameRate: { ideal: selectedFps },
            facingMode: { ideal: cameraFacingMode },
          },
        };

        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (constraintErr) {
          console.warn("Kamera ideal constraint ile açılamadı, temel mod deneniyor:", constraintErr);
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: cameraFacingMode } },
            audio: false,
          });
        }

        const videoTrack = stream.getVideoTracks()[0];

        if (!videoTrack) {
          throw new Error("Video track alınamadı");
        }

        // Video track'i kullanıcı ayarlarına göre optimize et
        if (videoTrack.getCapabilities) {
          const capabilities = videoTrack.getCapabilities();
          if (videoTrack.applyConstraints) {
            try {
              await videoTrack.applyConstraints({
                width: { ideal: selectedResolution.width, max: selectedResolution.width },
                height: { ideal: selectedResolution.height, max: selectedResolution.height },
                frameRate: { ideal: selectedFps, max: selectedFps },
              });
            } catch (err) {
              console.warn("Video track constraint uygulanamadı:", err);
            }
          }
        }

        const settings = videoTrack.getSettings();
        // Sadece development'ta log göster
        if (process.env.NODE_ENV === "development") {
          console.log("📹 Video track ayarları:", {
            width: settings.width,
            height: settings.height,
            frameRate: settings.frameRate,
            deviceId: settings.deviceId,
            requestedResolution: videoResolution,
            requestedFps: selectedFps,
          });
        }

        // Video track'i LiveKit'e publish et - Kullanıcı ayarlarına göre
        let publication;
        try {
          publication = await localParticipant.publishTrack(videoTrack, {
            source: Track.Source.Camera,
            videoEncoding: {
              maxBitrate: selectedResolution.bitrate,
              maxFramerate: selectedFps,
            },
            videoCodec: videoCodec || "h264",
            degradationPreference: "maintain-framerate",
            simulcast: false,
          });
        } catch (publishError) {
          console.error("❌ Track publish hatası:", publishError);
          videoTrack.stop();
          throw new Error(
            `Kamera yayınlanamadı: ${publishError.message || "Bilinmeyen hata"}`
          );
        }

        // KRİTİK KONTROLLER: Track'in doğru publish edildiğinden emin ol
        if (!publication) {
          videoTrack.stop();
          throw new Error("Publication oluşturulamadı!");
        }

        // Track'in enabled olduğundan ve muted olmadığından emin ol
        if (!publication.track) {
          console.error("❌ Publication'da track yok!");
          videoTrack.stop();
          throw new Error("Publication'da track bulunamadı!");
        }

        // Track'i enabled yap (hem LiveKit track hem de mediaStreamTrack)
        publication.track.enabled = true;
        if (publication.track.mediaStreamTrack) {
          publication.track.mediaStreamTrack.enabled = true;
        }

        // Publication'ın muted olmadığından emin ol
        if (publication.isMuted) {
          try {
            await publication.setMuted(false);
          } catch (muteError) {
            console.warn("⚠️ setMuted(false) hatası:", muteError);
          }
        }

        // Publication durumunu kontrol et ve retry mekanizması
        const isPublished = publication.trackSid && !publication.isMuted;
        if (!isPublished) {
          console.warn(
            "⚠️ Video track düzgün publish edilmedi, tekrar deneniyor...",
            {
              trackSid: publication.trackSid,
              isMuted: publication.isMuted,
              enabled: publication.track?.enabled,
            }
          );

          // Track'i durdur ve tekrar dene (max 2 retry)
          videoTrack.stop();
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Tekrar dene
          try {
            const retryStream = await navigator.mediaDevices.getUserMedia(
              constraints
            );
            const retryVideoTrack = retryStream.getVideoTracks()[0];
            if (retryVideoTrack) {
              const retryPublication = await localParticipant.publishTrack(
                retryVideoTrack,
                {
                  source: Track.Source.Camera,
                  videoEncoding: {
                    maxBitrate: selectedResolution.bitrate,
                    maxFramerate: selectedFps,
                  },
                  videoCodec: videoCodec || "h264",
                  degradationPreference: "maintain-framerate",
                  simulcast: false,
                }
              );

              if (
                retryPublication &&
                retryPublication.trackSid &&
                !retryPublication.isMuted
              ) {
                retryPublication.track.enabled = true;
                if (retryPublication.track.mediaStreamTrack) {
                  retryPublication.track.mediaStreamTrack.enabled = true;
                }
                if (retryPublication.isMuted) {
                  await retryPublication.setMuted(false);
                }
                publication = retryPublication;
                retryStream.getAudioTracks().forEach((track) => track.stop());
              } else {
                throw new Error("Retry başarısız");
              }
            }
          } catch (retryError) {
            console.error("❌ Retry başarısız:", retryError);
            throw new Error("Kamera yayınlanamadı: Tekrar deneme başarısız");
          }
        }

        // Remote participant'ların track'i görebilmesi için bir kısa gecikme ekle
        // (LiveKit'in track'i diğer participant'lara iletmesi için)
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Track kontrolü: LiveKit track'i internal olarak yönetir,
        // track geçici olarak undefined olabilir ama trackSid varsa publish başarılıdır
        if (publication.trackSid) {
          // Track başarıyla publish edildi
          if (publication.track) {
            // Track mevcut, durumunu kontrol et
            if (publication.track.mediaStreamTrack?.readyState === "ended") {
              console.warn(
                "⚠️ Track ended durumuna geçti, yeniden publish gerekebilir"
              );
            }
          }
          // Track undefined olsa bile trackSid varsa publish başarılıdır
          // LiveKit track'i gerektiğinde yeniden oluşturabilir
        } else {
          console.error("❌ Track publish başarısız - trackSid yok!");
        }

        // State'i güncelle (track publish edildi) - ref'i de güncelle
        setIsCameraOn(true);
        lastCameraStateRef.current = true;

        // Sadece development'ta detaylı log göster
        if (process.env.NODE_ENV === "development") {
          console.log("✅ Video track publish edildi:", {
            trackSid: publication.trackSid,
            isMuted: publication.isMuted,
            enabled: publication.track?.enabled,
            hasTrack: !!publication.track,
            hasMediaStreamTrack: !!publication.track?.mediaStreamTrack,
          });

          // Local participant'ın publication durumunu kontrol et
          setTimeout(() => {
            try {
              const localPub = localParticipant.getTrackPublication(
                Track.Source.Camera
              );
              if (localPub) {
                console.log("📹 Local camera track durumu (1 saniye sonra):", {
                  trackSid: localPub.trackSid,
                  isMuted: localPub.isMuted,
                  hasTrack: !!localPub.track,
                  enabled: localPub.track?.enabled,
                });

                // Remote participant'ları kontrol et (room varsa)
                // Not: localParticipant.room bazen undefined olabilir, bu normal
                const room = localParticipant.room;
                if (room && room.remoteParticipants) {
                  const remoteParticipants = Array.from(
                    room.remoteParticipants.values()
                  );
                  console.log(
                    "📊 Remote participant sayısı:",
                    remoteParticipants.length
                  );

                  if (remoteParticipants.length === 0) {
                    console.log(
                      "ℹ️ Remote participant yok. Başka bir cihazdan odaya girdiğinizde track görünecektir."
                    );
                  } else {
                    remoteParticipants.forEach((remoteParticipant) => {
                      // Remote participant'ın local participant'ın track'ini görebilmesi için
                      // local participant'ın publication'ını kontrol et
                      const localPubForRemote =
                        localParticipant.getTrackPublication(
                          Track.Source.Camera
                        );
                      console.log(
                        `📹 Remote participant "${remoteParticipant.identity}" için local track durumu:`,
                        {
                          localTrackSid: localPubForRemote?.trackSid,
                          localTrackMuted: localPubForRemote?.isMuted,
                          localHasTrack: !!localPubForRemote?.track,
                        }
                      );

                      // Remote participant'ın kendi track'ini kontrol et (eğer varsa)
                      const remotePub = remoteParticipant.getTrackPublication(
                        Track.Source.Camera
                      );
                      if (remotePub) {
                        console.log(
                          `📹 Remote participant "${remoteParticipant.identity}" kendi camera track durumu:`,
                          {
                            trackSid: remotePub.trackSid,
                            isMuted: remotePub.isMuted,
                            hasTrack: !!remotePub.track,
                          }
                        );
                      }
                    });
                  }
                }
                // Room undefined ise bu normal, çünkü room bağlantısı henüz tam kurulmamış olabilir
              } else {
                console.warn("⚠️ Local camera publication bulunamadı!");
              }
            } catch (error) {
              console.error("❌ Track durumu kontrolü hatası:", error);
            }
          }, 1000);
        }

        // Stream'deki diğer track'leri durdur (sadece video kullanıyoruz)
        stream.getAudioTracks().forEach((track) => track.stop());
      } else {
        // Kamera kapatıldığında tüm video track'leri kaldır
        const videoTracks = localParticipant
          .getTrackPublications()
          .filter((pub) => pub.source === Track.Source.Camera);

        for (const trackPub of videoTracks) {
          try {
            // Publication'dan track'i al
            const trackToUnpublish = trackPub.track;
            if (trackToUnpublish) {
              // Önce track'i durdur
              trackToUnpublish.stop();
              // Sonra unpublish et
              await localParticipant.unpublishTrack(trackToUnpublish);
            }
          } catch (err) {
            console.warn("Video track kaldırılırken hata:", err);
            // Hata olsa bile track'i durdurmaya çalış
            if (trackPub.track) {
              trackPub.track.stop();
            }
          }
        }

        // State'i güncelle - ref'i de güncelle
        setIsCameraOn(false);
        lastCameraStateRef.current = false;
      }
    } catch (error) {
      console.error("❌ Kamera hatası:", error);
      setIsCameraOn(currentState); // Hata durumunda state'i geri al
      lastCameraStateRef.current = currentState;
      const errorMessage =
        error?.message || error?.toString() || "Bilinmeyen hata";
      toastOnce(`Kamera açılamadı: ${errorMessage}`, "error");
    } finally {
      // Toggle bittiğini işaretle (event listener'ları tekrar aktif et)
      isTogglingCameraRef.current = false;
    }
  }, [enableCamera, videoId, videoResolution, videoFrameRate, localParticipant, setIsCameraOn, isCameraOn, cameraFacingMode]);

  // 📱 Ön/Arka Kamera Değiştir (Flip Camera)
  const switchCameraFacingMode = useCallback(async () => {
    const nextMode = cameraFacingMode === "user" ? "environment" : "user";
    setCameraFacingMode(nextMode);

    if (!localParticipant || !isCameraOn) {
      toastOnce(nextMode === "environment" ? "Arka kamera seçildi" : "Ön kamera seçildi", "info");
      return;
    }

    try {
      // Mevcut video track'i kaldır
      const existingTracks = localParticipant
        .getTrackPublications()
        .filter((pub) => pub.source === Track.Source.Camera);
      for (const trackPub of existingTracks) {
        if (trackPub.track) {
          trackPub.track.stop();
          await localParticipant.unpublishTrack(trackPub.track).catch(() => {});
        }
      }

      const resolutionMap = {
        "240p": { width: 426, height: 240, bitrate: 120000 },
        "360p": { width: 640, height: 360, bitrate: 250000 },
        "480p": { width: 854, height: 480, bitrate: 450000 },
        "720p": { width: 1280, height: 720, bitrate: 750000 },
      };
      const selectedResolution = resolutionMap[videoResolution] || resolutionMap["720p"] || resolutionMap["480p"];
      const selectedFps = videoFrameRate || 18;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: nextMode },
          width: { ideal: selectedResolution.width },
          height: { ideal: selectedResolution.height },
          frameRate: { ideal: selectedFps },
        },
        audio: false,
      });

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const publication = await localParticipant.publishTrack(videoTrack, {
          source: Track.Source.Camera,
          videoEncoding: {
            maxBitrate: selectedResolution.bitrate,
            maxFramerate: selectedFps,
          },
          videoCodec: videoCodec || "h264",
          degradationPreference: "maintain-framerate",
          simulcast: false,
        });
        if (publication?.track) {
          publication.track.enabled = true;
        }
        toastOnce(nextMode === "environment" ? "Arka kameraya geçildi" : "Ön kameraya geçildi", "success");
      }
    } catch (err) {
      console.warn("Kamera değiştirilemedi:", err);
      toastOnce("Kamera değiştirilemedi", "error");
    }
  }, [cameraFacingMode, localParticipant, isCameraOn, videoResolution, videoFrameRate, videoCodec]);

  // 📱 Kullanılabilir Kameraları Listele
  const fetchCameras = useCallback(async () => {
    try {
      if (!navigator?.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevs = devices.filter((d) => d.kind === "videoinput");
      setAvailableCameras(videoDevs);
    } catch (e) {
      console.warn("Kamera listesi alınamadı:", e);
    }
  }, []);

  // 📱 Menüden Kamera Seç
  const handleSelectCamera = useCallback(async ({ deviceId, facingMode, label }) => {
    setShowCameraMenu(false);
    setSelectedCameraDeviceId(deviceId || null);

    let targetFacingMode = facingMode;
    if (!targetFacingMode) {
      const lower = (label || "").toLowerCase();
      if (lower.includes("ön") || lower.includes("front") || lower.includes("selfie")) {
        targetFacingMode = "user";
      } else if (lower.includes("arka") || lower.includes("back") || lower.includes("rear") || lower.includes("çevre")) {
        targetFacingMode = "environment";
      }
    }
    if (targetFacingMode) {
      setCameraFacingMode(targetFacingMode);
    }

    if (!localParticipant || !isCameraOn) {
      if (label) toastOnce(`${label} seçildi`, "info");
      return;
    }

    try {
      // Eski track'leri kaldır
      const existingTracks = localParticipant
        .getTrackPublications()
        .filter((pub) => pub.source === Track.Source.Camera);
      for (const trackPub of existingTracks) {
        if (trackPub.track) {
          trackPub.track.stop();
          await localParticipant.unpublishTrack(trackPub.track).catch(() => {});
        }
      }

      const resolutionMap = {
        "240p": { width: 426, height: 240, bitrate: 120000 },
        "360p": { width: 640, height: 360, bitrate: 250000 },
        "480p": { width: 854, height: 480, bitrate: 450000 },
        "720p": { width: 1280, height: 720, bitrate: 750000 },
      };
      const selectedResolution = resolutionMap[videoResolution] || resolutionMap["720p"] || resolutionMap["480p"];
      const selectedFps = videoFrameRate || 18;

      const videoConstraints = {
        width: { ideal: selectedResolution.width },
        height: { ideal: selectedResolution.height },
        frameRate: { ideal: selectedFps },
      };

      if (deviceId) {
        videoConstraints.deviceId = { exact: deviceId };
      } else if (targetFacingMode) {
        videoConstraints.facingMode = { ideal: targetFacingMode };
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });
      } catch (err) {
        console.warn("Özel constraint ile kamera açılamadı, esnek mod deneniyor:", err);
        stream = await navigator.mediaDevices.getUserMedia({
          video: targetFacingMode ? { facingMode: { ideal: targetFacingMode } } : true,
          audio: false,
        });
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        const publication = await localParticipant.publishTrack(videoTrack, {
          source: Track.Source.Camera,
          videoEncoding: {
            maxBitrate: selectedResolution.bitrate,
            maxFramerate: selectedFps,
          },
          videoCodec: videoCodec || "h264",
          degradationPreference: "maintain-framerate",
          simulcast: false,
        });
        if (publication?.track) {
          publication.track.enabled = true;
        }
        toastOnce(label ? `${label} seçildi` : "Kamera değiştirildi", "success");
      }
    } catch (err) {
      console.warn("Kamera değiştirme hatası:", err);
      toastOnce("Kamera değiştirilemedi", "error");
    }
  }, [localParticipant, isCameraOn, videoResolution, videoFrameRate, videoCodec]);

  const startScreenShare = async ({
    resolution,
    fps,
    sourceId,
    withAudio,
    audioMode,
    withCursor = true,
  }) => {
    try {
      // Eğer zaten bir ekran paylaşımı varsa, önce onu durdur
      if (localParticipant?.isScreenShareEnabled) {
        const tracks = localParticipant.getTrackPublications();
        const existingScreenShareTracks = tracks.filter(
          (trackPub) =>
            trackPub.source === Track.Source.ScreenShare ||
            trackPub.source === Track.Source.ScreenShareAudio
        );

        if (existingScreenShareTracks.length > 0) {
          // Mevcut ekran paylaşımını durdur
          for (const trackPub of existingScreenShareTracks) {
            try {
              const track = trackPub.track;
              if (track) {
                if (track.mediaStreamTrack) {
                  track.mediaStreamTrack.stop();
                }
                track.stop();
                await localParticipant.unpublishTrack(track).catch(() => {});
              } else {
                await localParticipant.unpublishTrack(trackPub).catch(() => {});
              }
            } catch (error) {
              console.warn("Mevcut ekran paylaşımı durdurulurken hata:", error);
            }
          }
          // Kısa bir bekleme (track'lerin tamamen temizlenmesi için)
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      const { width, height } =
        resolution === 1440
          ? { width: 2560, height: 1440 }
          : resolution === 1080
          ? { width: 1920, height: 1080 }
          : resolution === 720
          ? { width: 1280, height: 720 }
          : { width: 854, height: 480 };

      const isScreen = sourceId?.startsWith("screen");

      // Audio constraint'leri kaynak tipine göre ayarla
      let audioConstraints = false;
      // macOS'ta Chromium masaüstü/sistem sesi yakalamayı desteklemiyor;
      // audio constraint verilirse getUserMedia tamamen hata veriyor.
      const isMacPlatform =
        typeof navigator !== "undefined" && /Mac/i.test(navigator.platform || "");
      if (withAudio && !(window.netrex && isMacPlatform)) {
        if (audioMode === "app" || !isScreen) {
          // Uygulama paylaşımı: Sadece o uygulamanın sesi
          audioConstraints = {
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: sourceId, // Sadece bu uygulama
            },
          };
        } else {
          // Ekran paylaşımı: Sistem sesi (tüm sesler)
          audioConstraints = {
            mandatory: {
              chromeMediaSource: "desktop",
              // Sistem sesi için sourceId belirtme (tüm sesler)
            },
          };
        }
      }

      // Electron'da getUserMedia kullan (chromeMediaSource constraint'leri sadece getUserMedia ile çalışır)
      let stream;
      if (window.netrex?.isTauri && sourceId) {
        // Tauri: ekranı/pencereyi Rust yakalar (WebView2'de chromeMediaSource:"desktop" yok)
        // Ses: pencere → yalnızca o uygulamanın sesi; ekran → Netrex HARİÇ sistem sesi
        // (odadaki insanların sesi yayına karışmaz)
        stream = await window.netrex.captureSource(sourceId, {
          width,
          height,
          fps,
          audio: withAudio ? (audioMode === "app" || !isScreen ? "app" : "system") : false,
          cursor: withCursor,
        });
      } else if (window.netrex && sourceId) {
        // Electron: getUserMedia ile chromeMediaSource kullan
        const constraints = {
          audio: audioConstraints || false,
          video: {
            mandatory: {
              chromeMediaSource: "desktop",
              chromeMediaSourceId: sourceId,
              maxWidth: width,
              maxHeight: height,
              maxFrameRate: fps,
            },
          },
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);

        // Track'i aldıktan sonra resolution ve frame rate ayarlarını ekstra olarak uygula
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && videoTrack.applyConstraints) {
          try {
            await videoTrack.applyConstraints({
              width: { ideal: width },
              height: { ideal: height },
              frameRate: { ideal: fps },
            });
          } catch (e) {
            // Constraint uygulanamazsa devam et
            console.warn("Could not apply video constraints:", e);
          }
        }
      } else {
        // Browser: Standart getDisplayMedia
        if (!navigator.mediaDevices?.getDisplayMedia) {
          toast.info("Ekran paylaşımı mobil tarayıcılarda desteklenmemektedir.");
          return;
        }

        const constraints = {
          audio: audioConstraints || false,
          video: {
            width: { ideal: width },
            height: { ideal: height },
            frameRate: { ideal: fps },
          },
        };
        stream = await navigator.mediaDevices.getDisplayMedia(constraints);
      }
      const videoTrack = stream.getVideoTracks()[0];
      videoTrack.contentHint = fps > 15 ? "motion" : "detail";
      
      // Çözünürlüğe ve FPS'ye göre bitrate ayarla (yüksek kalite için)
      // Bit hızı TAVANLARI (kota için artırılmadı; eski değerler). Bağlantı yetmezse LiveKit kendisi düşürür.
      // Ölçüm (720p60, çok hareketli içerik): H.264 + "akıcılığı koru" ile 4 Mbps'te 57-59 FPS tutuluyor, tavan
      // aşılınca bit hızı değil ÇÖZÜNÜRLÜK düşüyor.
      const maxBitrate =
        resolution === 1440
          ? 8000000
          : resolution === 1080
          ? (fps > 30 ? 6000000 : 5000000)
          : resolution === 720
          ? (fps >= 60 ? 4000000 : 2500000)
          : 1500000;

      // Codec: H.264. Donanım (GPU) kodlayıcısı var (NVIDIA/AMD/Intel), yoksa yazılıma düşer; VP8 yalnızca
      // işlemcide kodlanıyordu ve zayıf bağlantıda FPS'i çökertiyordu. Ölçüm (720p60, 1.5 Mbps): H.264 59 FPS,
      // VP8 "dengeli" modda 10 FPS. Tek yerden değiştirilebilir: SCREEN_SHARE_CODEC.
      // Bozulma tercihi: LiveKit ekran paylaşımında varsayılan "maintain-resolution" (netliği koru) kullanır:
      // bağlantı/işlemci yetmeyince FPS'i düşürür (60 seçilse bile ~35 FPS ölçüldü). Kullanıcı yüksek FPS
      // seçtiyse (>=45) akıcılık korunur; düşük FPS (belge/ders paylaşımı) seçtiyse netlik korunur.
      await localParticipant.publishTrack(videoTrack, {
        name: "screen_share_video",
        source: Track.Source.ScreenShare,
        videoCodec: SCREEN_SHARE_CODEC,
        simulcast: false,
        degradationPreference: fps >= 45 ? "maintain-framerate" : "maintain-resolution",
        videoEncoding: { maxBitrate, maxFramerate: fps },
      });

      const audioTrack = stream.getAudioTracks()[0];
      if (withAudio && audioTrack) {
        // Ekran paylaşımı için Netrex seslerini filtrele
        if (isScreen && audioMode === "system") {
          // Audio track'i filtrele: LiveKit audio track'lerini exclude et
          // Bu Electron API'sine bağlı, şimdilik direkt publish ediyoruz
          // İleride audio context ile filtreleme eklenebilir
        }

        await localParticipant.publishTrack(audioTrack, {
          name: "screen_share_audio",
          source: Track.Source.ScreenShareAudio,
          disableDtx: false,
        });

        videoTrack.onended = () => {
          // 🔥 FIX: Track'i DURDUR - yoksa MediaStreamTrack capture etmeye devam eder (CPU leak)
          videoTrack.stop();
          localParticipant.unpublishTrack(videoTrack).catch(() => {});
          if (audioTrack) {
            audioTrack.stop();
            localParticipant.unpublishTrack(audioTrack).catch(() => {});
          }
          // Stream'deki tüm track'leri de durdur (garbage collection için)
          stream.getTracks().forEach(t => { try { t.stop(); } catch(e) {} });
          // PinnedStreamIds'den kaldır ki StageManager video element'i render etmesin
          setPinnedStreamIds(prev => prev.filter(id => id !== `${localParticipant.identity}:screen` && id !== localParticipant.identity));
        };
      } else {
        // Audio yoksa sadece video ve kullanılmayan audio'ları durdur
        if (audioTrack) audioTrack.stop(); // Kullanılmayan audio track'i hemen durdur
        
        videoTrack.onended = () => {
          // 🔥 FIX: Track'i DURDUR
          videoTrack.stop();
          localParticipant.unpublishTrack(videoTrack).catch(() => {});
          // Stream'deki tüm track'leri de durdur
          stream.getTracks().forEach(t => { try { t.stop(); } catch(e) {} });
          // PinnedStreamIds'den kaldır
          setPinnedStreamIds(prev => prev.filter(id => id !== `${localParticipant.identity}:screen` && id !== localParticipant.identity));
        };
      }

      setPinnedStreamIds(prev => Array.from(new Set([...(prev || []), `${localParticipant.identity}:screen`])));
    } catch (e) {
      console.error("Screen share error:", e);
      toastOnce("Ekran paylaşımı başlatılamadı: " + e.message, "error");
    }
  };

  // ✅ FIX: Hotkey handler ref'ten çalışıyor - IPC listener birikmesi yok
  const setQuickStatusByIndex = useSettingsStore(state => state.setQuickStatusByIndex);
  const hotkeysRef = useRef({ toggleMute, toggleDeaf, toggleCamera, toggleLastQuickStatus, setQuickStatusByIndex });
  useEffect(() => {
    hotkeysRef.current = { toggleMute, toggleDeaf, toggleCamera, toggleLastQuickStatus, setQuickStatusByIndex };
  }, [toggleMute, toggleDeaf, toggleCamera, toggleLastQuickStatus, setQuickStatusByIndex]);

  useEffect(() => {
    if (!window.netrex) return;
    const handleHotkey = (action) => {
      if (action === "toggle-mute") hotkeysRef.current.toggleMute();
      if (action === "toggle-deafen") hotkeysRef.current.toggleDeaf();
      if (action === "toggle-camera") hotkeysRef.current.toggleCamera();
      if (action === "toggle-quick-status") hotkeysRef.current.toggleLastQuickStatus();
      // ✅ Per-slot quick status hotkeys: "toggle-quick-status-0", "toggle-quick-status-1", ...
      const slotMatch = action.match(/^toggle-quick-status-(\d+)$/);
      if (slotMatch) {
        hotkeysRef.current.setQuickStatusByIndex(parseInt(slotMatch[1], 10));
      }
    };
    
    // ✅ Sadece MOUNT'ta kayıt yap - dependency yok, IPC listener birikmiyor
    const cleanup = window.netrex.onHotkeyTriggered(handleHotkey);
    return () => cleanup?.();
  }, []); // ✅ boş array - handler artık ref üzerinden güncel kalıyor

  // ✅ FIX: mousedown listener artık state'e bağlı değil - ref kullanıyor
  // Eski: [showScreenShareMenu, showWatchPartyMenu] dep. → her menu aç-kapa'da listener kaldırılıp ekleniyor
  // Yeni: Sadece MOUNT'ta ekleniyor, ref'ten okuyarak güncel state'e erişiyor
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        showScreenShareMenuRef.current &&
        screenShareMenuRef.current &&
        screenShareButtonRef.current &&
        !screenShareMenuRef.current.contains(e.target) &&
        !screenShareButtonRef.current.contains(e.target)
      ) {
        setShowScreenShareMenu(false);
      }
      
      if (
        showWatchPartyMenuRef.current &&
        watchPartyMenuRef.current &&
        watchPartyButtonRef.current &&
        !watchPartyMenuRef.current.contains(e.target) &&
        !watchPartyButtonRef.current.contains(e.target)
      ) {
        setShowWatchPartyMenu(false);
      }

      if (
        showSpatialMenuRef.current &&
        spatialMenuRef.current &&
        spatialButtonRef.current &&
        !spatialMenuRef.current.contains(e.target) &&
        !spatialButtonRef.current.contains(e.target)
      ) {
        setShowSpatialMenu(false);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []); // ✅ boş array - artık listener birikmiyor

  // 📱 Kameraları Türkçe ve Numaralı Olarak Formatla
  const formattedCameraList = useMemo(() => {
    let frontIdx = 0;
    let backIdx = 0;
    let otherIdx = 0;

    return availableCameras.map((cam, idx) => {
      const raw = (cam.label || "").toLowerCase();
      let friendlyName = "";
      let isFront = false;

      if (raw.includes("front") || raw.includes("user") || raw.includes("ön") || raw.includes("facing front")) {
        frontIdx++;
        isFront = true;
        friendlyName = `Ön Kamera ${frontIdx > 1 ? frontIdx : ""}`.trim();
      } else if (raw.includes("back") || raw.includes("environment") || raw.includes("arka") || raw.includes("facing back") || raw.includes("rear")) {
        backIdx++;
        isFront = false;
        if (raw.includes("wide") || raw.includes("geniş")) {
          friendlyName = `Arka Kamera ${backIdx} (Geniş Açı)`;
        } else if (raw.includes("ultra")) {
          friendlyName = `Arka Kamera ${backIdx} (Ultra Geniş)`;
        } else if (raw.includes("tele")) {
          friendlyName = `Arka Kamera ${backIdx} (Telefoto)`;
        } else {
          friendlyName = `Arka Kamera ${backIdx}`;
        }
      } else {
        otherIdx++;
        friendlyName = cam.label ? cam.label : `Kamera ${otherIdx}`;
      }

      return {
        deviceId: cam.deviceId,
        rawLabel: cam.label,
        friendlyName,
        isFront,
      };
    });
  }, [availableCameras]);

  return (
    <>
      <ScreenShareModal
        isOpen={showScreenShareModal}
        onClose={() => setShowScreenShareModal(false)}
        onStart={startScreenShare}
      />
      
      {/* Show Toggle Button when control bar is hidden - Ultra Bright Indigo Neon - Rendered via Portal to escape stacking contexts */}
      {controlBarHidden && createPortal(
        <button
          onClick={toggleControlBarHidden}
          className="fixed bottom-6 z-[50000] pointer-events-auto flex items-center justify-center w-11 h-11 rounded-xl backdrop-blur-md bg-gradient-to-br from-indigo-600/90 to-indigo-500/80 border border-indigo-400/50 shadow-[0_8px_32px_rgba(79,70,229,0.4),0_0_20px_rgba(99,102,241,0.3)] hover:bg-indigo-500 hover:border-indigo-300 hover:shadow-[0_0_60px_rgba(99,102,241,0.8),0_0_30px_rgba(129,140,248,0.6),inset_0_0_20px_rgba(255,255,255,0.2)] hover:scale-110 active:scale-95 transition duration-700 ease-in-out group overflow-hidden"
          style={{
            right: showChatPanel && chatPosition === "right" ? `${chatWidth + 24}px` : "24px",
            left: showChatPanel && chatPosition === "left" ? `${chatWidth + 24}px` : "auto",
            ...(voicePanelHidden && showChatPanel ? { bottom: "96px" } : {}),
          }}
          title="Kontrolleri Göster"
        >
          {/* Glass Specular Highlight - Stronger */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-white/5 to-transparent pointer-events-none group-hover:opacity-100 transition-opacity"></div>
          
          {/* Inner Glow animation */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/20 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          
          {/* Icon */}
          <ChevronUp size={22} className="text-white drop-shadow-md relative z-10 group-hover:text-white group-hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] transition" strokeWidth={2.5} />
        </button>,
        document.body
      )}
      
      {/* Floating Control Bar Container */}
      <div 
        className={`h-controls absolute bottom-[52px] sm:bottom-0 pb-0.5 sm:pb-12 flex items-center justify-center shrink-0 select-none z-50 pointer-events-none transition duration-700 ease-in-out origin-bottom-right ${
          controlBarHidden 
            ? 'opacity-0 pointer-events-none translate-x-[calc(50vw-80px)] scale-[0.15]' 
            : 'opacity-100 translate-x-0 scale-100'
        }`}
        style={{
          left: showChatPanel && chatPosition === "left" ? `${chatWidth}px` : "0",
          right: showChatPanel && chatPosition === "right" ? `${chatWidth}px` : "0",
        }}
      >
        {/* TTS Stop Badge - Controls'un hemen üzerinde */}
        <TtsStopBadge />

        {/* Kontrol Butonları - Floating Glass Style */}
        <div className="pointer-events-auto flex items-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-1 sm:py-2.5 relative z-10 rounded-xl sm:rounded-2xl backdrop-blur-2xl bg-[#131418]/90 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition duration-300 hover:bg-[#131418] hover:border-white/15 hover:shadow-[0_12px_40px_rgba(0,0,0,0.6)]">
          {/* Inner Glow */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>

          {/* Ses Kontrolleri Grubu */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            <ControlButton
              isActive={!isMuted}
              activeIcon={serverMuted ? <Hand size={20} className="sm:w-5 sm:h-5 text-amber-400" /> : <Mic size={20} className="sm:w-5 sm:h-5" />}
              inactiveIcon={serverMuted ? <Hand size={20} className="sm:w-5 sm:h-5 text-amber-400" /> : <MicOff size={20} className="sm:w-5 sm:h-5" />}
              onClick={toggleMute}
              tooltip={serverMuted ? `Susturmayı açmalarını talep et (${mutedBy || "Yetkili"})` : isMuted ? "Susturmayı Kaldır" : "Sustur"}
              danger={isMuted && !serverMuted}
              disabled={isDeafened || (serverMuted && mRequestTimeout)}
            />
            <ControlButton
              isActive={!isDeafened}
              activeIcon={<Headphones size={20} className="sm:w-5 sm:h-5" />}
              inactiveIcon={<VolumeX size={20} className="sm:w-5 sm:h-5" />}
              onClick={toggleDeaf}
              tooltip={serverDeafened ? `Sunucu tarafından sağırlaştırıldı (${deafenedBy || "Yetkili"})` : isDeafened ? "Sağırlaştırmayı Kaldır" : "Sağırlaştır"}
              danger={isDeafened}
            />
          </div>
          
          {/* Ayırıcı */}
          <div className="w-px h-8 bg-white/10 mx-1"></div>
          
          {/* Video Kontrolleri Grubu */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* Kamera Butonu */}
            <button
              onClick={toggleCamera}
              disabled={!enableCamera}
              className={`w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl transition duration-300 relative group ${
                !enableCamera
                  ? "opacity-40 cursor-not-allowed bg-white/5 border border-white/5 text-white/40"
                  : isCameraOn
                  ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-105 hover:shadow-[0_0_25px_rgba(255,255,255,0.4)]"
                  : "bg-white/5 border border-white/10 text-[#b5bac1] hover:bg-white/10 hover:text-white hover:border-white/20 active:scale-95"
              }`}
              title={
                !enableCamera
                  ? "Kamera Devre Dışı"
                  : isCameraOn
                  ? "Kamerayı Kapat"
                  : "Kamerayı Aç"
              }
            >
              <div className="relative z-10">
                {isCameraOn ? <Video size={20} className="sm:w-5 sm:h-5" /> : <VideoOff size={20} className="sm:w-5 sm:h-5" />}
              </div>
            </button>

            {/* Ön / Arka Kamera & Cihaz Seçim Menüsü (Kamera açıkken görünür) */}
            {isCameraOn && (
              <div className="relative" ref={cameraMenuRef}>
                <button
                  ref={cameraButtonRef}
                  onClick={() => {
                    fetchCameras();
                    setShowCameraMenu(!showCameraMenu);
                  }}
                  className={`w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl transition duration-300 active:scale-95 border ${
                    showCameraMenu
                      ? "bg-indigo-600 text-white border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.5)]"
                      : "bg-indigo-500/20 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/30 hover:text-white shadow-[0_0_15px_rgba(99,102,241,0.2)]"
                  }`}
                  title="Kamera Seçenekleri"
                >
                  <SwitchCamera size={19} className="sm:w-5 sm:h-5" />
                </button>

                {/* Kamera Seçim Menüsü Popover (Ekrandan Taşmayan Responsive Tasarım) */}
                {showCameraMenu && cameraMenuPos && typeof document !== "undefined" && createPortal(
                  <div
                    ref={cameraPopoverRef}
                    style={{
                      left: cameraMenuPos.left,
                      bottom: cameraMenuPos.bottom,
                      width: cameraMenuPos.width,
                      maxHeight: cameraMenuPos.maxHeight,
                    }}
                    className="fixed overflow-y-auto rounded-2xl shadow-[0_16px_50px_rgba(0,0,0,0.85)] z-[99999] animate-scaleIn origin-bottom bg-[#111214]/98 border border-white/15 backdrop-blur-2xl p-2.5 flex flex-col gap-1.5">
                    <div className="px-2 py-1.5 border-b border-white/10 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Camera size={13} className="text-indigo-400" />
                        Kamera Seçin
                      </span>
                    </div>

                    {/* Hızlı Ön Kamera Seçeneği */}
                    <button
                      onClick={() => handleSelectCamera({ facingMode: "user", label: "Ön Kamera (Selfie)" })}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition ${
                        (!selectedCameraDeviceId && cameraFacingMode === "user") || (selectedCameraDeviceId && cameraFacingMode === "user")
                          ? "bg-indigo-600/30 text-white border border-indigo-500/40"
                          : "text-[#dbdee1] hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Camera size={15} className="text-indigo-400 shrink-0" />
                        <span className="font-semibold">Ön Kamera (Selfie)</span>
                      </div>
                      {cameraFacingMode === "user" && <Check size={14} className="text-indigo-400 shrink-0" />}
                    </button>

                    {/* Hızlı Arka Kamera Seçeneği */}
                    <button
                      onClick={() => handleSelectCamera({ facingMode: "environment", label: "Arka Kamera (Çevre)" })}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition ${
                        (!selectedCameraDeviceId && cameraFacingMode === "environment") || (selectedCameraDeviceId && cameraFacingMode === "environment")
                          ? "bg-cyan-600/30 text-white border border-cyan-500/40"
                          : "text-[#dbdee1] hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Camera size={15} className="text-cyan-400 shrink-0" />
                        <span className="font-semibold">Arka Kamera (Çevre)</span>
                      </div>
                      {cameraFacingMode === "environment" && <Check size={14} className="text-cyan-400 shrink-0" />}
                    </button>

                    {/* Varsa Ayrıştırılmış Tüm Cihazlar Listesi */}
                    {formattedCameraList.length > 0 && (
                      <div className="mt-1 pt-1.5 border-t border-white/10 flex flex-col gap-1 max-h-48 overflow-y-auto scrollbar-thin">
                        <span className="px-2 py-0.5 text-[10px] font-bold text-[#949ba4] uppercase tracking-wider">Mevcut Donanım Kameraları</span>
                        {formattedCameraList.map((item, idx) => {
                          const isSelected = selectedCameraDeviceId
                            ? selectedCameraDeviceId === item.deviceId
                            : (item.isFront ? cameraFacingMode === "user" : cameraFacingMode === "environment");

                          return (
                            <button
                              key={item.deviceId || idx}
                              onClick={() => handleSelectCamera({ deviceId: item.deviceId, facingMode: item.isFront ? "user" : "environment", label: item.friendlyName })}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition text-left truncate ${
                                isSelected
                                  ? "bg-white/10 text-white border border-white/15 font-semibold"
                                  : "text-[#949ba4] hover:text-white hover:bg-white/5"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 truncate">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${item.isFront ? "bg-indigo-400" : "bg-cyan-400"}`} />
                                <span className="truncate">{item.friendlyName}</span>
                              </div>
                              {isSelected && <Check size={14} className={item.isFront ? "text-indigo-400 shrink-0" : "text-cyan-400 shrink-0"} />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>,
                  document.body
                )}
              </div>
            )}
            
            {/* Ekran Paylaşımı Butonu (Telefonda kaldırılmıştır, sadece masaüstü md:block ekranlarda gösterilir) */}
            <div className="relative hidden md:block" ref={screenShareButtonRef}>
              <button
                onClick={() => {
                  if (isScreenSharing) {
                    setShowScreenShareMenu(!showScreenShareMenu);
                  } else {
                    setShowScreenShareModal(true);
                  }
                }}
                className={`w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl transition duration-300 relative group ${
                  isScreenSharing
                    ? "bg-[#23a559] text-white shadow-[0_0_20px_rgba(35,165,89,0.3)] hover:bg-[#1b8746] hover:scale-105 hover:shadow-[0_0_25px_rgba(35,165,89,0.4)]"
                    : "bg-white/5 border border-white/10 text-[#b5bac1] hover:bg-white/10 hover:text-white hover:border-white/20 active:scale-95"
                }`}
                title={
                  isScreenSharing ? "Ekran Paylaşımı Seçenekleri" : "Ekran Paylaş"
                }
              >
                <div className="relative z-10">
                  <Monitor size={20} className="sm:w-5 sm:h-5" />
                </div>
              </button>

              {/* Ekran Paylaşımı Menüsü */}
              {showScreenShareMenu && isScreenSharing && (
                <div
                  ref={screenShareMenuRef}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] z-[99999] w-64 animate-scaleIn origin-bottom bg-[#111214] border border-white/10 overflow-hidden"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <div className="p-1.5 space-y-1">
                    <div className="px-3 py-2 flex items-center gap-2 mb-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-xs font-bold text-white/90">Yayın Aktif</span>
                    </div>

                    <button
                      onClick={() => {
                        setShowScreenShareMenu(false);
                        setShowScreenShareModal(true);
                      }}
                      className="w-full px-3 py-2 rounded-lg text-left text-sm font-medium text-[#b5bac1] hover:text-white hover:bg-white/5 transition flex items-center gap-3"
                    >
                      <Monitor size={16} />
                      Ekranı Değiştir
                    </button>

                    <button
                      onClick={() => {
                        setShowScreenShareMenu(false);
                        stopScreenShare();
                      }}
                      className="w-full px-3 py-2 rounded-lg text-left text-sm font-medium text-red-400 hover:bg-red-500/10 transition flex items-center gap-3"
                    >
                      <MonitorOff size={16} />
                      Paylaşımı Durdur
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Watch Party Butonu */}
          {serverId && watchPartyEnabled && (
            <div className="relative flex items-center" ref={watchPartyButtonRef}>
              <div className="w-px h-8 bg-white/10 mx-1"></div>
              <button
                onClick={() => {
                  if (!wpActive) {
                    if (wpPermissions.canStartParty) {
                      startWatchParty(serverId, channelId, currentUser?.uid);
                    } else {
                      toastOnce("Bu kanalda Watch Party başlatma yetkin yok.", "error");
                    }
                  } else {
                    setShowWatchPartyMenu(!showWatchPartyMenu);
                  }
                }}
                className={`w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl transition duration-300 relative group ${
                  wpActive 
                    ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.4)] active:scale-95"
                    : "bg-white/5 border border-white/10 text-[#b5bac1] hover:bg-white/10 hover:text-white hover:border-white/20 active:scale-95"
                }`}
                title={wpActive ? "Watch Party Seçenekleri" : "Watch Party Başlat"}
              >
                <div className="relative z-10">
                  <Music size={20} className="sm:w-5 sm:h-5" />
                </div>
              </button>

              {/* Watch Party Menüsü */}
              {showWatchPartyMenu && wpActive && (
                <div
                  ref={watchPartyMenuRef}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] z-[99999] w-64 animate-scaleIn origin-bottom bg-[#111214] border border-white/10 overflow-hidden"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <div className="p-1.5 space-y-1">
                    <div className="px-3 py-2 flex items-center gap-2 mb-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                      <span className="text-xs font-bold text-white/90">Watch Party Aktif</span>
                    </div>

                    <button
                      onClick={() => {
                        setShowWatchPartyMenu(false);
                        useWatchPartyStore.getState().setLocalPref('showPlayer', true);
                      }}
                      className="w-full px-3 py-2 rounded-lg text-left text-sm font-medium text-[#b5bac1] hover:text-white hover:bg-white/5 transition flex items-center gap-3"
                    >
                      <Music size={16} />
                      Oynatıcıyı Göster
                    </button>

                    {wpPermissions.canControl && (
                      <button
                        onClick={() => {
                          setShowWatchPartyMenu(false);
                          endWatchParty(serverId, channelId);
                        }}
                        className="w-full px-3 py-2 rounded-lg text-left text-sm font-medium text-red-400 hover:bg-red-500/10 transition flex items-center gap-3"
                      >
                        <PhoneOff size={16} />
                        Watch Party'yi Kapat
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* DM Call Invite Button */}
          {isDMCall && onInviteClick && (
            <div className="relative flex items-center">
              <div className="w-px h-8 bg-white/10 mx-1"></div>
              <button
                onClick={onInviteClick}
                className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white hover:border-indigo-500 hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] transition duration-300 active:scale-95 group relative"
                title="Kişi Davet Et"
              >
                <div className="relative z-10">
                  <UserPlus size={20} className="sm:w-5 sm:h-5" />
                </div>
              </button>
            </div>
          )}

          {/* 🎙️ Konuşma Grupları */}
          <VoiceGroupsControl />

          {/* 🎲 Masa (isteğe bağlı modül; ayarlardan kapalıysa görünmez) */}
          <GamesButton />

          {/* 🎧 Spatial Audio Toggle */}
          <div className="relative flex items-center" ref={spatialButtonRef}>
            <div className="w-px h-8 bg-white/10 mx-1"></div>
            <button
              onClick={() => {
                if (!spatialEnabled) {
                  toggleSpatial();
                  setShowWindow(true);
                } else {
                  setShowSpatialMenu(!showSpatialMenu);
                }
              }}
              className={`w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl transition duration-300 relative group ${
                spatialEnabled
                  ? "bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500 hover:text-white hover:border-indigo-500 hover:shadow-[0_0_20px_rgba(99,102,241,0.4)] active:scale-95"
                  : "bg-white/5 border border-white/10 text-[#b5bac1] hover:bg-white/10 hover:text-white hover:border-white/20 active:scale-95"
              }`}
              title={spatialEnabled ? "Spatial Audio Seçenekleri" : "Spatial Audio: Kapalı"}
            >
              <div className="relative z-10">
                <Radar size={20} className="sm:w-5 sm:h-5" />
              </div>
              {spatialEnabled && (
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_6px_rgba(99,102,241,0.6)]" />
              )}
            </button>

            {/* Spatial Audio Menüsü */}
            {showSpatialMenu && spatialEnabled && (
              <div
                ref={spatialMenuRef}
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.5)] z-[99999] w-64 animate-scaleIn origin-bottom bg-[#111214] border border-white/10 overflow-hidden"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <div className="p-1.5 space-y-1">
                  <div className="px-3 py-2 flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                    <span className="text-xs font-bold text-white/90">Spatial Audio Aktif</span>
                  </div>

                  <button
                    onClick={() => {
                      setShowSpatialMenu(false);
                      setShowWindow(true);
                    }}
                    className="w-full px-3 py-2 rounded-lg text-left text-sm font-medium text-[#b5bac1] hover:text-white hover:bg-white/5 transition flex items-center gap-3"
                  >
                    <Radar size={16} />
                    Arayüzü Göster
                  </button>

                  <button
                    onClick={() => {
                      setShowSpatialMenu(false);
                      toggleSpatial();
                      setShowWindow(false);
                    }}
                    className="w-full px-3 py-2 rounded-lg text-left text-sm font-medium text-red-400 hover:bg-red-500/10 transition flex items-center gap-3"
                  >
                    <Radar size={16} className="opacity-50" />
                    Spatial Audio'yu Kapat
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Ayırıcı */}
          <div className="w-px h-8 bg-white/10 mx-1"></div>
          
          {/* Çıkış butonu */}
          <button
            onClick={onLeave}
            className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white hover:border-red-500 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] transition duration-300 active:scale-95 group relative overflow-hidden"
            title="Bağlantıyı Kes"
          >
            <PhoneOff size={20} className="sm:w-5 sm:h-5 relative z-10" />
          </button>
          
          {/* Ayırıcı */}
          <div className="w-px h-6 bg-white/10"></div>
          
          {/* Hide Button */}
          <button
            onClick={toggleControlBarHidden}
            className="flex items-center justify-center w-8 h-8 rounded-lg cursor-pointer transition duration-200 hover:bg-indigo-500/20 border border-transparent hover:border-indigo-500/30"
            title="Kontrolleri Gizle"
          >
            <ChevronDown size={16} className="text-white/40 hover:text-indigo-400 transition-colors" />
          </button>
        </div>
      </div>
    </>
  );
}
