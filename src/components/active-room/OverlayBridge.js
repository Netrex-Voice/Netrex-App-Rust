import { useEffect, useRef, useCallback } from "react";
import { useParticipants } from "@livekit/components-react";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useOverlayStore } from "@/src/store/overlayStore";
import { useSpeakingStore } from "@/src/store/speakingStore";
import { useAuthStore } from "@/src/store/authStore";
import { useServerStore } from "@/src/store/serverStore";
import { useDMStore } from "@/src/store/dmStore";
import { useAvatarStore, watchAvatar } from "@/src/store/avatarStore";

/**
 * 🎮 OverlayBridge — LiveKitRoom İÇİNDE çalışır
 * 
 * Mevcut active room state'ini alıp Electron overlay penceresine IPC ile iletir.
 * Overlay'den gelen aksiyonları (mute, leave) dinler ve karşılık gelir.
 * 
 * NOT: Bu bileşen asla doğrudan Livekit'e bağlanmaz.
 * Her şey mevcut active room sistemi üzerinden gelir.
 */
export default function OverlayBridge({ channelName, serverName, isDMCall, onLeave, onMuteToggle }) {
  const participants = useParticipants();

  // Stores — individual selectors to prevent unnecessary re-renders
  const overlayEnabled = useOverlayStore((s) => s.overlayEnabled);
  const visibilityMode = useOverlayStore((s) => s.visibilityMode);
  const position = useOverlayStore((s) => s.position);
  const customPosition = useOverlayStore((s) => s.customPosition);
  const size = useOverlayStore((s) => s.size);
  const opacity = useOverlayStore((s) => s.opacity);
  const fullOpacityOnHover = useOverlayStore((s) => s.fullOpacityOnHover);
  const maxVisibleUsers = useOverlayStore((s) => s.maxVisibleUsers);
  const showChannelName = useOverlayStore((s) => s.showChannelName);
  const showServerName = useOverlayStore((s) => s.showServerName);
  const showSelf = useOverlayStore((s) => s.showSelf);
  const showOnlySpeaking = useOverlayStore((s) => s.showOnlySpeaking);
  const controlMute = useOverlayStore((s) => s.controlMute);
  const controlDeafen = useOverlayStore((s) => s.controlDeafen);
  const controlLeave = useOverlayStore((s) => s.controlLeave);
  const antiCheatProtection = useOverlayStore((s) => s.antiCheatProtection);
  const setCustomPosition = useOverlayStore((s) => s.setCustomPosition);

  const isMuted = useSettingsStore((s) => s.isMuted);
  const isDeafened = useSettingsStore((s) => s.isDeafened);
  const toggleDeaf = useSettingsStore((s) => s.toggleDeaf);
  const localIsSpeaking = useSettingsStore((s) => s.localIsSpeaking);
  const localProfileColor = useSettingsStore((s) => s.profileColor);

  const speakingParticipants = useSpeakingStore((s) => s.speakingParticipants);
  const localUser = useAuthStore((s) => s.user);

  const serverMembers = useServerStore((s) => s.currentServer?.members || []);
  const dmParticipants = useDMStore((s) => s.activeConversation?.participants || []);
  const members = isDMCall ? dmParticipants : serverMembers;

  // Persistent reference refs for stable payload processing without re-triggering intervals
  const stateRef = useRef({
    participants, speakingParticipants, localIsSpeaking, isMuted, isDeafened,
    channelName, serverName, showServerName,
    settings: {
      maxVisibleUsers, showOnlySpeaking, showSelf,
      controlMute, controlDeafen, controlLeave,
      visibilityMode, size, opacity, fullOpacityOnHover
    }
  });

  // Always keep stateRef up to date immediately during render without triggering effects
  stateRef.current = {
    participants,
    speakingParticipants,
    localIsSpeaking,
    isMuted,
    isDeafened,
    localUser,
    localProfileColor,
    channelName,
    serverName,
    showServerName,
    members,
    settings: {
      maxVisibleUsers, showOnlySpeaking, showSelf, showSilentUsers: true,
      controlMute, controlDeafen, controlLeave,
      visibilityMode, size, opacity, fullOpacityOnHover
    }
  };

  const lastDataRef = useRef("");
  const overlayInitializedRef = useRef(false);

  // Mount/Unmount Overlay Window
  useEffect(() => {
    if (!window.netrex?.setVoiceOverlayEnabled) return;

    if (overlayEnabled) {
      window.netrex.setVoiceOverlayEnabled(true, {
        position, customPosition, size, opacity,
        fullOpacityOnHover, controlMute, controlDeafen, controlLeave,
        antiCheatProtection,
      });
      overlayInitializedRef.current = true;
      lastDataRef.current = ""; // pencere yeni/gizli olabilir: bir sonraki tick veriyi mutlaka göndersin
    } else {
      if (overlayInitializedRef.current) {
        window.netrex.setVoiceOverlayEnabled(false);
        overlayInitializedRef.current = false;
      }
    }

    // NOT: Burada temizlik (gizleme) YOK. Ayar her değiştiğinde bu effect yeniden çalışır; eskiden her seferinde
    // overlay gizleniyor, veri değişmediği için (lastDataRef) bir daha gösterilmiyordu. Rust, açıkken gelen
    // setVoiceOverlayEnabled çağrısıyla ayarları (konum, düğmeler) yerinde uygular.
  }, [
    overlayEnabled, position, customPosition, size, opacity,
    fullOpacityOnHover, controlMute, controlDeafen, controlLeave,
    antiCheatProtection
  ]);

  // Odadan çıkınca (bileşen kalkınca) overlay'i gizle
  useEffect(() => {
    return () => {
      if (overlayInitializedRef.current) {
        window.netrex?.closeVoiceOverlay?.();
        overlayInitializedRef.current = false;
        lastDataRef.current = ""; // sonraki odada ilk veri mutlaka gönderilsin
      }
    };
  }, []);

  // IPC Event Listeners (Mute/Deafen/Leave/Save Position)
  useEffect(() => {
    if (!window.netrex?.onVoiceOverlayAction) return;

    const cleanup = window.netrex.onVoiceOverlayAction((action, payload) => {
      switch (action) {
        case "toggle-mute": onMuteToggle?.(); break;
        case "toggle-deafen": toggleDeaf?.(); break;
        case "leave": onLeave?.(); break;
        case "position-saved":
          if (payload?.x !== undefined && payload?.y !== undefined) {
            setCustomPosition(payload);
          }
          break;
      }
    });

    return cleanup;
  }, [onMuteToggle, toggleDeaf, onLeave, setCustomPosition]);

  // Overlay'deki herkesin güncel fotoğrafını canlı dinle (ref-sayaçlı, başka avatarlarla paylaşılır)
  const participantIdsKey = participants.map((p) => p.identity).join(",");
  useEffect(() => {
    if (!overlayEnabled || !participantIdsKey) return;
    const releases = participantIdsKey.split(",").map((id) => watchAvatar(id));
    return () => releases.forEach((release) => release());
  }, [overlayEnabled, participantIdsKey]);

  // Heartbeat loop for syncing view state
  useEffect(() => {
    if (!overlayEnabled || !window.netrex?.updateVoiceOverlay) return;

    const tick = () => {
      const state = stateRef.current;
      
      const participantData = state.participants.map((p) => {
        let metadata = {};
        try { metadata = p.metadata ? JSON.parse(p.metadata) : {}; } catch { /* ignore */ }

        const member = state.members?.find((m) => m.id === p.identity || m.userId === p.identity);

        const speaking = p.isLocal ? state.localIsSpeaking : !!state.speakingParticipants[p.identity];

        // Canlı (Firestore) adres öncelikli; metadata/üye kaydındaki kopyalar yalnızca yedek (eskimiş olabilir)
        const liveAvatar = useAvatarStore.getState().photos[p.identity];
        const effAvatar = liveAvatar || (p.isLocal ? state.localUser?.photoURL : (metadata.photoURL || member?.photoURL || null));
        const effName = p.isLocal 
           ? (state.localUser?.displayName || state.localUser?.username || p.name || p.identity) 
           : (metadata.displayName || member?.displayName || member?.username || p.name || p.identity);
        const effColor = p.isLocal 
           ? (state.localProfileColor || "#6366f1") 
           : (metadata.profileColor || member?.profileColor || member?.color || "#6366f1");

        return {
          id: p.identity,
          name: effName,
          avatar: effAvatar,
          isSpeaking: speaking,
          isMuted: p.isLocal ? state.isMuted : !!metadata.isMuted,
          isDeafened: p.isLocal ? state.isDeafened : !!metadata.isDeafened,
          isLocal: p.isLocal,
          profileColor: effColor,
        };
      });

      const outData = {
        channel: {
          name: state.channelName || "—",
          serverName: state.showServerName ? state.serverName : null,
        },
        participants: participantData,
        localState: {
          isMuted: state.isMuted,
          isDeafened: state.isDeafened,
        },
        settings: state.settings,
      };

      // Handle visibilityMode strictly inside data builder
      if (state.settings.visibilityMode === "speaking") {
        const anyoneSpeaking = participantData.some((p) => p.isSpeaking);
        if (!anyoneSpeaking) {
          outData.participants = []; // Render invisible!
        }
      }

      const freshStr = JSON.stringify(outData);
      if (freshStr !== lastDataRef.current) {
        lastDataRef.current = freshStr;
        window.netrex.updateVoiceOverlay(outData);
      }
    };

    tick(); // immediate sync
    const iv = setInterval(tick, 150); // fast and perfectly stable

    return () => clearInterval(iv);
  }, [overlayEnabled]); // Only ever trigger effect on mount/unmount of enabled state

  return null; // Render nothing — pure data bridge
}
