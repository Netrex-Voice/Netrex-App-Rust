import React, {
  useEffect,
  useMemo,
  memo,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  useParticipantInfo,
  useParticipantAttributes,
  useParticipantTracks,
  useIsSpeaking,
  VideoTrack,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import { Tv, Maximize, VolumeX, MicOff, Clock, ShieldAlert, Loader2 } from "lucide-react";
import { isMicConnectingAttr } from "@/src/utils/micConnectingAttr";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useSpeakingStore } from "@/src/store/speakingStore";
import { GroupChip, CardTalkStatus, WhisperHold } from "./VoiceGroupsUI";
import { useAuthStore } from "@/src/store/authStore";
import ScreenSharePreviewComponent from "./ScreenSharePreview";
import { useRemoteSpeaking } from "@/src/hooks/useRemoteSpeaking";
import UserPhoto from "@/src/components/ui/UserPhoto";

const UserCard = ({
  participant,
  totalCount,
  onContextMenu,
  compact,
  hideIncomingVideo,
  setPinnedStreamIds,
  pinnedStreamIds,
  // ✅ OPTIMIZATION: Parent'tan gelen props (useTracks N kez yerine 1 kez çağrılır)
  screenShareTrackMap,
  cameraTrackMap,
  members,
}) => {
  const { identity, name, metadata } = useParticipantInfo({ participant });

  // ✅ CPU OPT: LiveKit VAD'in (useIsSpeaking) saniyede yüzlerce kez zorlayıcı State güncellemelerini Kestik! 
  // Orijinal hook'ları devre dışı bırakıp, sadece 250ms'lik (4 FPS) kontrollü sınırlı AudioLevel kullanacağız.
  const audioLevelSpeaking = useRemoteSpeaking(participant, participant.isLocal);


  const displayName = name || identity || "User";

  const getInitials = useCallback((nameStr) => {
    if (!nameStr) return "?";
    const trimmed = nameStr.trim();
    if (!trimmed) return "?";
    const parts = trimmed.split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (
      parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
    ).toUpperCase();
  }, []);

  const userInitials = useMemo(
    () => getInitials(displayName),
    [displayName, getInitials],
  );

  // ✅ OPTIMIZATION: members artık prop olarak geliyor (store subscription yok)
  const member = useMemo(
    () => members?.find((m) => m.id === identity || m.userId === identity),
    [members, identity],
  );

  const localUser = useAuthStore((s) => s.user);

  // 🚀 Store Optimizasyonu
  const localProfileColor = useSettingsStore((s) => s.profileColor);
  const cameraMirrorEffect = useSettingsStore((s) => s.cameraMirrorEffect);
  const disableAnimations = useSettingsStore((s) => s.disableAnimations);
  const graphicsQuality = useSettingsStore((s) => s.graphicsQuality);
  const localIsSpeaking = useSettingsStore((s) => s.localIsSpeaking);
  const storeIsMuted = useSettingsStore((s) => s.isMuted);
  const storeIsDeafened = useSettingsStore((s) => s.isDeafened);
  const useProfileColorForSpeaking = useSettingsStore((s) => s.useProfileColorForSpeaking ?? true);
  const localVolume = useSettingsStore((s) => s.userVolumes[participant.identity] ?? 100);
  const isLocallyMuted = !participant.isLocal && localVolume === 0;

  // Odaya yeni katılan kişinin mikrofonu hazır olana kadar (LiveKit özniteliği) "bağlanıyor" göster.
  // Kendi kartımızda gösterme: biz zaten odaya hazır olunca giriyoruz.
  const { attributes: participantAttributes } = useParticipantAttributes({ participant });
  // Öznitelik gecikebilir/takılı kalabilir (güncelleme kaybı, yeniden bağlanma). Mikrofon yayını zaten
  // alınıyorsa (ses gerçekten geliyor) "bağlanıyor" göstermek yanlış olur; bu durumda gösterme.
  const remoteMicTracks = useParticipantTracks([Track.Source.Microphone], participant.identity);
  const remoteMicLive = remoteMicTracks.some(
    (t) => !!t.publication?.track && !t.publication.isMuted,
  );
  const remoteMicConnecting =
    !participant.isLocal && isMicConnectingAttr(participantAttributes) && !remoteMicLive;

  // ✅ OPTIMIZATION: useTracks parent'tan Map olarak geliyor (O(1) lookup)
  const screenShareTrack = screenShareTrackMap?.get(participant.sid) || null;
  const hasScreenShare = !!screenShareTrack;
  const isCurrentlyWatching = pinnedStreamIds?.some(
    (id) =>
      id === participant.identity ||
      id === `${participant.identity}:screen` ||
      id === `${participant.identity}:camera`,
  );

  // ✅ DÜZELTME: Animasyon kontrolleri
  const shouldAnimate = useMemo(() => {
    if (disableAnimations === true) return false;
    if (graphicsQuality === "potato") return false;
    return true;
  }, [disableAnimations, graphicsQuality]);

  const shouldBlur = useMemo(() => {
    if (!graphicsQuality) return true;
    return graphicsQuality === "high" || graphicsQuality === "medium";
  }, [graphicsQuality]);

  const shouldAnimateRings = useMemo(() => {
    if (disableAnimations === true) return false;
    return !graphicsQuality || graphicsQuality === "high";
  }, [disableAnimations, graphicsQuality]);

  // ✅ PATATES MODU: Statik glow (animasyon yok, sadece opacity)
  const isPotatoMode = useMemo(() => {
    return graphicsQuality === "potato" || disableAnimations === true;
  }, [graphicsQuality, disableAnimations]);

  const remoteState = useMemo(() => {
    try {
      return metadata ? JSON.parse(metadata) : {};
    } catch {
      return {};
    }
  }, [metadata]);

  // Global identity data derived from all available states (Local > Remote > Member > Fallback)
  const effectivePhotoURL = participant.isLocal ? localUser?.photoURL : (remoteState.photoURL || member?.photoURL);
  const effectiveDisplayName = participant.isLocal 
    ? (localUser?.displayName || localUser?.username || displayName)
    : (remoteState.displayName || member?.displayName || member?.username || displayName);

  const isMuted = participant.isLocal ? storeIsMuted : remoteState.isMuted;
  const isDeafened = participant.isLocal
    ? storeIsDeafened
    : remoteState.isDeafened;

  const memberProfileColor = member?.profileColor || member?.color || null;

  const userColor = participant.isLocal
    ? localProfileColor || memberProfileColor || "#6366f1"
    : remoteState.profileColor || memberProfileColor || "#6366f1";

  const borderColor = useMemo(() => {
    if (!userColor || !userColor.includes("gradient"))
      return userColor || "#6366f1";
    const match = userColor.match(/#[0-9a-fA-F]{6}/);
    return match ? match[0] : "#6366f1";
  }, [userColor]);

  const borderStyle = useMemo(
    () => ({
      border:
        isMuted || isDeafened
          ? "2px solid rgba(239, 68, 68, 0.4)"
          : "2px solid rgba(255, 255, 255, 0.08)",
      transform: "translateZ(0)",
    }),
    [isMuted, isDeafened],
  );

  // ✅ CPU OPT: React State YERİNE DOM Ref Manipulasyonu! (0 Re-Render)
  const speakingTimerRef = useRef(null);
  
  // Hedef DOM Elemanları
  const speakingIndicatorRef = useRef(null);
  const backgroundGlowRef = useRef(null);
  const videoBorderRef = useRef(null);
  const ringHighQualityRef = useRef(null);
  const ringPotatoRef = useRef(null);

  const setSpeakingStore = useSpeakingStore(s => s.setSpeaking);

  useEffect(() => {
    const rawIsSpeaking = participant.isLocal
      ? localIsSpeaking
      : audioLevelSpeaking;
    const isSpeakingNow = rawIsSpeaking && !isMuted && !isDeafened;

    const applySpeakingStyles = (speaking) => {
      if (speakingIndicatorRef.current) speakingIndicatorRef.current.style.opacity = speaking ? "1" : "0";
      if (backgroundGlowRef.current) backgroundGlowRef.current.style.opacity = speaking ? (isPotatoMode ? "0.08" : "0.12") : "0";
      if (videoBorderRef.current) {
        videoBorderRef.current.style.opacity = speaking ? "1" : "0";
        if (speaking) videoBorderRef.current.style.borderColor = isPotatoMode ? borderColor : "rgba(255, 255, 255, 0.2)";
      }
      if (ringHighQualityRef.current) ringHighQualityRef.current.style.opacity = speaking ? "1" : "0";
      if (ringPotatoRef.current) ringPotatoRef.current.style.opacity = speaking ? "0.8" : "0";
    };

    if (isSpeakingNow) {
      if (speakingTimerRef.current) {
        clearTimeout(speakingTimerRef.current);
        speakingTimerRef.current = null;
      }
      applySpeakingStyles(true);
    } else {
      if (speakingTimerRef.current) {
        clearTimeout(speakingTimerRef.current);
        speakingTimerRef.current = null;
      }
      applySpeakingStyles(false);
    }
    
    // Global store senkronizasyonu
    if (participant.identity) {
      setSpeakingStore(participant.identity, isSpeakingNow);
    }

    return () => {
      if (participant.identity) {
        setSpeakingStore(participant.identity, false);
      }
      if (speakingTimerRef.current) {
        clearTimeout(speakingTimerRef.current);
        speakingTimerRef.current = null;
      }
    };
  }, [
    audioLevelSpeaking,
    localIsSpeaking,
    isMuted,
    isDeafened,
    participant.identity,
    participant.isLocal,
    isPotatoMode,
    borderColor,
    setSpeakingStore
  ]);

  const avatarSize = useMemo(() => {
    if (compact) return "w-10 h-10 text-base";
    if (totalCount <= 2) return "w-28 h-28 text-4xl";
    return "w-16 h-16 text-xl";
  }, [compact, totalCount]);

  // ✅ OPTIMIZATION: useTracks parent'tan Map olarak geliyor (O(1) lookup)
  const videoTrack = cameraTrackMap?.get(participant.sid) || null;

  const cameraPublication = participant.getTrackPublication(
    Track.Source.Camera,
  );

  const shouldShowVideo =
    cameraPublication &&
    !cameraPublication.isMuted &&
    !hideIncomingVideo &&
    cameraPublication.trackSid &&
    (participant.isLocal
      ? true
      : videoTrack?.isSubscribed || !!cameraPublication.track);

  const hasVisibleContent =
    (shouldShowVideo && videoTrack) || (hasScreenShare && screenShareTrack);

  const handleVideoClick = useCallback(
    (e) => {
      if (
        !isCurrentlyWatching &&
        setPinnedStreamIds &&
        participant.identity &&
        (hasScreenShare || shouldShowVideo)
      ) {
        e.stopPropagation();
        // ✅ Hem ekran hem kamera açıksa IKISINIDE ekle
        const newPins = [];
        if (hasScreenShare) newPins.push(`${participant.identity}:screen`);
        if (shouldShowVideo) newPins.push(`${participant.identity}:camera`);
        setPinnedStreamIds((prev) =>
          Array.from(new Set([...(prev || []), ...newPins])),
        );
      }
    },
    [
      isCurrentlyWatching,
      setPinnedStreamIds,
      participant.identity,
      hasScreenShare,
      shouldShowVideo,
    ],
  );

  const videoStyle = useMemo(
    () => ({
      transform:
        participant.isLocal && cameraMirrorEffect
          ? "scaleX(-1)"
          : undefined,
    }),
    [participant.isLocal, cameraMirrorEffect],
  );

  // ✅ SPEAKING INDICATOR STYLE (Animasyonlu + Statik)
  // ✅ CPU OPT: Renkleri memo'la, isSpeaking'e bağımlı değil (CSS transition halleder)
  const activeBorderColor = useProfileColorForSpeaking ? borderColor : "#34d399";
  const activeGlowColor = useProfileColorForSpeaking ? userColor : "#34d399";

  // ✅ CPU OPT: Statik stiller isSpeaking'den bağımsız - sadece renk değişince yeniden hesaplanır
  // isSpeaking değişiklikleri CSS transition ile handle edilir (JS re-render yok)
  const speakingIndicatorBaseStyle = useMemo(() => {
    if (isPotatoMode) {
      return {
        border: `2px solid ${activeBorderColor}`,
        transition: "opacity 200ms ease-out",
      };
    } else {
      // ✅ CPU OPT: boxShadow kaldırıldı - sadece border + opacity (GPU-composited)
      return {
        border: `2px solid ${activeBorderColor}cc`,
        transition: "opacity 200ms ease-out",
      };
    }
  }, [activeBorderColor, isPotatoMode]);

  // ✅ BACKGROUND GLOW STYLE (Sadece normal modda)
  // ✅ CPU OPT: Statik base + CSS transition ile opacity toggle (pulse-glow animasyonu kaldırıldı)
  const backgroundGlowBaseStyle = useMemo(() => {
    if (isPotatoMode) {
      return {
        background: activeBorderColor,
        transition: "opacity 250ms ease-out",
      };
    } else {
      // ✅ CPU OPT: CSS animation (pulse-glow) kaldırıldı - büyük CPU tasarrufu
      // Yerine sabit opacity + transition kullanılıyor (görsel fark minimal)
      return {
        background: activeGlowColor,
        transition: "opacity 250ms ease-out",
      };
    }
  }, [isPotatoMode, activeGlowColor, activeBorderColor]);

  // ✅ AVATAR TRANSFORM STYLE
  const avatarTransformStyle = useMemo(
    () => ({
      background: userColor,
      transform: "translateZ(0)",
      transition:
        shouldAnimate && !isPotatoMode ? "transform 300ms ease-out" : "none",
    }),
    [userColor, shouldAnimate, isPotatoMode],
  );

  return (
    <div className="w-full h-full p-1">
      <div
        onContextMenu={onContextMenu}
        onDoubleClick={(e) => {
          e.preventDefault();
          if (hasScreenShare || shouldShowVideo) {
            setPinnedStreamIds?.((prev) =>
              prev.includes(participant.identity)
                ? prev.filter((id) => id !== participant.identity)
                : [...prev, participant.identity],
            );
          }
        }}
        className={`relative w-full h-full rounded-xl flex flex-col items-center justify-center group overflow-hidden bg-[#141418]/85 ${hasScreenShare || shouldShowVideo ? "cursor-pointer" : "cursor-context-menu"}`}
        style={borderStyle}
        data-vg-card={participant.identity}
      >
        {/* 🎙️ Konuşma durumu: fısıltı / yanıt / özel konuşma — kartın kenarına bitişik çerçeve + etiket */}
        {!participant.isLocal && (
          <CardTalkStatus identity={participant.identity} compact={compact} />
        )}

        {/* 🚀 Speaking Indicator Layer - Her modda göster */}
        {/* ✅ CPU OPT: SIFIR RE-RENDER - Ref ve doğrudan DOM Manipülasyonuna geçirildi */}
        <div
          ref={speakingIndicatorRef}
          className="absolute inset-0 rounded-xl pointer-events-none z-20"
          style={{ ...speakingIndicatorBaseStyle, opacity: 0 }}
        />

        {/* 🔮 Background Glow - Her modda göster (patates'te minimal) */}
        {/* ✅ CPU OPT: SIFIR RE-RENDER - Ref ile JS dışı DOM güncellenir */}
        <div
          ref={backgroundGlowRef}
          className="absolute inset-0 pointer-events-none z-0"
          style={{ ...backgroundGlowBaseStyle, opacity: 0 }}
        />

        <div className="relative mb-2 w-full h-full flex flex-col items-center justify-center z-10">
          {shouldShowVideo && videoTrack ? (
            <div
              className="relative w-full h-full rounded-xl overflow-hidden z-20 group/camera"
              onClick={handleVideoClick}
              style={{
                cursor:
                  hasVisibleContent && !isCurrentlyWatching
                    ? "pointer"
                    : "default",
              }}
            >
              <VideoTrack
                trackRef={videoTrack}
                className="w-full h-full object-cover relative z-0"
                style={videoStyle}
              />

              {/* ✅ PATATES: Basit border, animasyon yok. Ref ile handle edildi */}
              <div
                ref={videoBorderRef}
                className="absolute inset-0 rounded-xl border-2 pointer-events-none"
                style={{
                  opacity: 0,
                  transition: isPotatoMode ? "none" : "border-color 200ms, opacity 200ms",
                }}
              ></div>

              {/* Hover overlay - Ekran Paylaşımı İzleme */}
              {hasScreenShare && screenShareTrack && !isCurrentlyWatching && (
                <div
                  className={`absolute inset-0 bg-[#00000090] opacity-0 group-hover/camera:opacity-100 transition duration-300 flex items-center justify-center cursor-pointer z-50 ${shouldBlur ? "backdrop-blur-[4px]" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Yayını izle + kamera da açıksa onu da ekle
                    const newPins = [`${participant.identity}:screen`];
                    if (shouldShowVideo)
                      newPins.push(`${participant.identity}:camera`);
                    setPinnedStreamIds?.((prev) =>
                      Array.from(new Set([...(prev || []), ...newPins])),
                    );
                  }}
                >
                  <div className="bg-[#5865f2] text-white px-3 py-1.5 rounded-full font-bold text-[11px] sm:text-xs tracking-wide flex items-center gap-1.5 shadow-[0_4px_14px_rgba(88,101,242,0.4)] transform translate-y-2 group-hover/camera:translate-y-0 transition duration-300 hover:bg-[#4752c4] hover:scale-105">
                    <Tv size={13} strokeWidth={2.5} />
                    Yayını İzle
                  </div>
                </div>
              )}

              {/* Hover overlay - Kamerayı Büyüt */}
              {!hasScreenShare && shouldShowVideo && !isCurrentlyWatching && (
                <div
                  className={`absolute inset-0 bg-[#00000085] opacity-0 group-hover/camera:opacity-100 transition duration-300 flex items-center justify-center cursor-pointer z-50 ${shouldBlur ? "backdrop-blur-[4px]" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPinnedStreamIds?.((prev) =>
                      Array.from(
                        new Set([
                          ...(prev || []),
                          `${participant.identity}:camera`,
                        ]),
                      ),
                    );
                  }}
                >
                  <div className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-full font-bold text-[11px] sm:text-xs tracking-wide flex items-center gap-1.5 shadow-lg backdrop-blur-md border border-white/10 transform translate-y-2 group-hover/camera:translate-y-0 transition duration-300 hover:scale-105">
                    <Maximize size={13} strokeWidth={2.5} />
                    Büyüt
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              className={`${avatarSize} rounded-xl flex items-center justify-center text-white font-bold z-10 relative group/avatar overflow-hidden`}
              style={{
                ...avatarTransformStyle,
                // ✅ Büyüme/küçülme tamamen kaldırıldı (sabit)
                transform: "translateZ(0)",
              }}
            >
              {/* ✅ RING ANIMASYONLARI - Sadece high quality'de */}
              {/* ✅ CPU OPT: Conditional render kaldırıldı, DOM Manipulasyonu ile Ref'ten idare ediliyor */}
              {!isPotatoMode && shouldAnimateRings && (
                <div
                  ref={ringHighQualityRef}
                  className="absolute inset-0 rounded-2xl border-2 z-20 transition-opacity duration-200 ease-in-out"
                  style={{
                    borderColor: activeBorderColor,
                    opacity: 0
                  }}
                />
              )}

              {/* 🥔 PATATES: Statik ring (animasyon yok) */}
              {isPotatoMode && (
                <div
                  ref={ringPotatoRef}
                  className="absolute inset-0 rounded-2xl border-2 z-20"
                  style={{
                    borderColor: activeBorderColor,
                    opacity: 0,
                    transition: "opacity 200ms ease-out",
                  }}
                />
              )}

              <UserPhoto
                uid={participant.identity}
                src={effectivePhotoURL}
                alt={effectiveDisplayName}
                className="w-full h-full object-cover rounded-2xl relative z-10"
                fallback={<span className="relative z-10 uppercase">{getInitials(effectiveDisplayName)}</span>}
              />

              {hasScreenShare && screenShareTrack && !isCurrentlyWatching && (
                <div
                  className={`absolute inset-0 bg-[#00000095] opacity-0 group-hover/avatar:opacity-100 transition duration-300 flex items-center justify-center cursor-pointer z-50 rounded-2xl ${shouldBlur ? "backdrop-blur-[4px]" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPinnedStreamIds?.((prev) =>
                      Array.from(
                        new Set([
                          ...(prev || []),
                          `${participant.identity}:screen`,
                        ]),
                      ),
                    );
                  }}
                >
                  <div className="bg-[#5865f2] text-white px-3 py-1.5 rounded-full font-bold text-[11px] sm:text-xs tracking-wide flex items-center gap-1.5 shadow-[0_4px_14px_rgba(88,101,242,0.4)] transform translate-y-2 group-hover/avatar:translate-y-0 transition duration-300 hover:bg-[#4752c4] hover:scale-105">
                    <Tv size={13} strokeWidth={2.5} />
                    Yayını İzle
                  </div>
                </div>
              )}
            </div>
          )}

          {/* İsim & Durum Badge */}
          <div
            className={`absolute z-40 max-w-[90%] ${
              compact
                ? `bottom-1 left-1 bg-black/40 px-2 py-1 rounded-md ${shouldBlur ? "backdrop-blur-sm" : ""}`
                : shouldShowVideo
                  ? `bottom-2 left-2 bg-black/60 px-2.5 py-1.5 rounded-lg ${shouldBlur ? "backdrop-blur-sm" : ""}`
                  : `bottom-3 left-3 bg-black/40 px-3 py-1.5 rounded-full shadow-sm ${shouldBlur ? "backdrop-blur-sm" : ""}`
            }`}
          >
            <div className="flex items-center gap-1.5">
              {(isMuted || isDeafened || isLocallyMuted) &&
                hasVisibleContent &&
                ((isDeafened || isLocallyMuted) ? (
                  <VolumeX size={compact ? 10 : 14} className="text-red-500" />
                ) : (
                  <MicOff size={compact ? 10 : 14} className="text-red-500" />
                ))}
              <span
                className={`font-semibold text-white tracking-wide truncate drop-shadow-md ${compact ? "text-[10px]" : "text-xs"}`}
              >
                {effectiveDisplayName}
              </span>
              <GroupChip identity={participant.identity} compact={compact} />
            </div>
          </div>

          {/* 🎙️ Kulak simgesi: basılı tutunca sadece bu kişi seni duyar (kartın üstüne gelince görünür) */}
          {!participant.isLocal && (
            <div className="absolute top-2 right-2 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <WhisperHold identity={participant.identity} size={compact ? "sm" : "md"} />
            </div>
          )}

          {hasScreenShare && screenShareTrack && !isCurrentlyWatching && (
            <ScreenSharePreviewComponent trackRef={screenShareTrack} />
          )}

          {hasScreenShare && screenShareTrack && (
            <div className="absolute top-2.5 left-2.5 z-40 bg-red-600 px-2 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black text-white shadow-lg tracking-wider border border-red-500/50 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              CANLI
            </div>
          )}
        </div>

        {/* 🔇 Mute/Deafen Overlay */}
        {(isMuted || isDeafened || isLocallyMuted) && (
          <div
            className={`absolute z-30 pointer-events-none rounded-xl overflow-hidden transition-opacity duration-300 ${
              shouldShowVideo && videoTrack
                ? "top-2 right-2 flex flex-col items-end group-hover:opacity-0"
                : `inset-0 flex items-center justify-center ${hasScreenShare ? "group-hover:opacity-0" : ""}`
            }`}
          >
            {!(shouldShowVideo && videoTrack) && (
              <div className="absolute inset-0 bg-black/50 transition duration-300" />
            )}

            {/* ✅ Video modunda sağ üstteki minik ikonların altına isim ekle (Sadece sunucu moderasyonu varsa) */}
            {(shouldShowVideo && videoTrack) && (remoteState.serverMuted || remoteState.serverDeafened) && (
              <div className="absolute top-10 right-2 z-50 flex items-center gap-1 bg-red-600/90 px-1.5 py-0.5 rounded border border-red-400/30 shadow-lg scale-90 origin-right transition-opacity group-hover:opacity-0">
                 <ShieldAlert size={10} className="text-white" />
                 <span className="text-[9px] font-black text-white uppercase truncate max-w-[60px]">
                    {typeof (remoteState.mutedBy || remoteState.deafenedBy) === 'object' 
                      ? (remoteState.mutedBy || remoteState.deafenedBy).displayName 
                      : (remoteState.mutedBy || remoteState.deafenedBy)}
                 </span>
              </div>
            )}

            <div
              className={`relative flex flex-col items-center ${shouldShowVideo && videoTrack ? "gap-1" : compact ? "gap-1.5" : "gap-3"}`}
            >
              <div
                className={`bg-zinc-900 border border-white/10 flex items-center justify-center rounded-full ${shouldShowVideo && videoTrack ? "p-1.5" : compact ? "p-2" : "p-4"}`}
              >
                {(isDeafened || isLocallyMuted) ? (
                  <VolumeX
                    size={
                      shouldShowVideo && videoTrack ? 16 : compact ? 18 : 32
                    }
                    className="text-red-500"
                    strokeWidth={2.5}
                  />
                ) : (
                  <MicOff
                    size={
                      shouldShowVideo && videoTrack ? 16 : compact ? 18 : 32
                    }
                    className="text-red-500"
                    strokeWidth={2.5}
                  />
                )}
              </div>

              {!(shouldShowVideo && videoTrack) && (
                <div
                  className={`bg-black/80 rounded-2xl border border-red-500/30 flex flex-col items-center justify-center shadow-2xl ${compact ? "px-2 py-1" : "px-4 py-2"}`}
                  style={{
                    background: 'linear-gradient(180deg, rgba(20,20,22,0.9) 0%, rgba(139,0,0,0.6) 100%)',
                    backdropBlur: '12px'
                  }}
                >
                  <span
                    className={`font-black text-white tracking-[0.15em] uppercase block ${compact ? "text-[8px]" : "text-[11px]"}`}
                  >
                    {remoteState.serverDeafened
                      ? "SUNUCU TARAFINDAN SAĞIRLAŞTIRILDI"
                      : remoteState.serverMuted
                        ? "SUNUCU TARAFINDAN SUSTURULDU"
                        : isLocallyMuted
                          ? "SESİ SENDE KAPALI"
                          : isDeafened
                            ? "SAĞIRLAŞTIRDI"
                            : "SUSTURDU"}
                  </span>
                  
                  {(remoteState.serverDeafened || remoteState.serverMuted) && (remoteState.deafenedBy || remoteState.mutedBy) && (
                    <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1 bg-red-950/40 rounded-lg border border-red-500/20">
                      <ShieldAlert size={compact ? 10 : 12} className="text-red-400" />
                      <span className={`font-bold text-red-200/90 whitespace-nowrap ${compact ? "text-[8px]" : "text-[10px]"}`}>
                        YETKİLİ: {typeof (remoteState.mutedBy || remoteState.deafenedBy) === 'object' 
                          ? (remoteState.mutedBy || remoteState.deafenedBy).displayName 
                          : (remoteState.mutedBy || remoteState.deafenedBy)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 🎤 Karşı tarafın mikrofonu hazırlanıyor: sesi henüz gitmiyor (susturma katmanıyla aynı stil).
            Zaten susturulmuş/sağırlaştırılmışsa o katman görünür, ikisi üst üste binmesin. */}
        {remoteMicConnecting && !(isMuted || isDeafened) && (
          <div
            role="status"
            className={`absolute z-30 pointer-events-none rounded-xl overflow-hidden transition-opacity duration-300 ${
              shouldShowVideo && videoTrack
                ? "top-2 right-2 flex flex-col items-end group-hover:opacity-0"
                : `inset-0 flex items-center justify-center ${hasScreenShare ? "group-hover:opacity-0" : ""}`
            }`}
          >
            {!(shouldShowVideo && videoTrack) && (
              <div className="absolute inset-0 bg-black/50 transition duration-300" />
            )}

            <div
              className={`relative flex flex-col items-center ${shouldShowVideo && videoTrack ? "gap-1" : compact ? "gap-1.5" : "gap-3"}`}
            >
              <div
                className={`bg-zinc-900 border border-white/10 flex items-center justify-center rounded-full ${shouldShowVideo && videoTrack ? "p-1.5" : compact ? "p-2" : "p-4"}`}
              >
                <Loader2
                  size={shouldShowVideo && videoTrack ? 16 : compact ? 18 : 32}
                  className="text-amber-400 animate-spin"
                  strokeWidth={2.5}
                />
              </div>

              {!(shouldShowVideo && videoTrack) && (
                <div
                  className={`bg-black/80 rounded-2xl border border-amber-500/30 flex flex-col items-center justify-center shadow-2xl ${compact ? "px-2 py-1" : "px-4 py-2"}`}
                  style={{
                    background: "linear-gradient(180deg, rgba(20,20,22,0.9) 0%, rgba(120,80,0,0.6) 100%)",
                  }}
                >
                  <span
                    className={`font-black text-white tracking-[0.15em] uppercase block ${compact ? "text-[8px]" : "text-[11px]"}`}
                  >
                    BAĞLANIYOR
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 🚀 QUICK STATUS DISPLAY - OPTIMIZED (No Animation) */}
        {remoteState.quickStatus && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
            {/* Kapsayıcıya hafif pulse animasyonu ekledik */}
            {compact ? (
              // 📱 COMPACT MOD: Sadece İkon (Statik Kırmızı)
              <div
                className="flex items-center justify-center w-8 h-8 rounded-full border border-white/20 shadow-lg bg-gradient-to-br from-red-600 to-red-900"
                style={{
                  boxShadow: `0 0 10px ${userColor ? `${userColor}80` : "#ef444480"}`, // Sabit User Color Glow
                }}
              >
                <span className="text-sm drop-shadow-md select-none text-white">
                  {remoteState.quickStatus.icon || "⏰"}
                </span>
              </div>
            ) : (
              // 🖥️ NORMAL MOD: İkon + Yazı (Statik Kırmızı)
              <div
                className="flex items-center gap-3 px-5 py-2.5 rounded-2xl border border-white/20 shadow-lg relative overflow-hidden max-w-[90%] bg-gradient-to-br from-red-600 via-red-700 to-red-900"
                style={{
                  boxShadow: `0 8px 25px ${userColor ? `${userColor}60` : "#b91c1c60"}`, // Sabit User Color Aura
                }}
              >
                {/* Parlama Efekti (Statik) */}
                <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

                {/* İçerik */}
                <div className="relative z-10 flex flex-col items-center text-center">
                  <span className="text-2xl mb-1 drop-shadow-lg filter contrast-125 select-none">
                    {remoteState.quickStatus.icon || "⏰"}
                  </span>
                  <span className="text-[11px] font-black text-white uppercase tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] leading-tight max-w-[200px] text-center break-words" style={{ wordBreak: 'break-word' }}>
                    {remoteState.quickStatus.label}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(UserCard);
