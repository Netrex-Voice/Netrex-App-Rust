"use client";

import { useEffect, useRef } from "react";
import { useParticipants } from "@livekit/components-react";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useAuthStore } from "@/src/store/authStore";
import { useServerStore } from "@/src/store/serverStore";
import { useDMStore } from "@/src/store/dmStore";
import { useRoomPresenceStore } from "@/src/store/roomPresenceStore";

/**
 * Odadaki kişileri `roomPresenceStore`'a yayınlar (LiveKitRoom İÇİNDE çalışır, görünmez).
 * Ad / avatar / renk çözümleme sırası OverlayBridge ile aynıdır (metadata > üye kaydı > LiveKit adı).
 * Yalnızca değişince yazar (imza karşılaştırması); odadan çıkınca depoyu temizler.
 */
export default function RoomPresencePublisher({ roomId, channelName, serverName, isDMCall }) {
  const participants = useParticipants();
  const localUser = useAuthStore((s) => s.user);
  const isMuted = useSettingsStore((s) => s.isMuted);
  const isDeafened = useSettingsStore((s) => s.isDeafened);
  const localColor = useSettingsStore((s) => s.profileColor);
  const serverMembers = useServerStore((s) => s.currentServer?.members);
  const dmParticipants = useDMStore((s) => s.activeConversation?.participants);
  const members = (isDMCall ? dmParticipants : serverMembers) || [];

  const lastSig = useRef("");

  useEffect(() => {
    const list = participants.map((p) => {
      let meta = {};
      try { meta = p.metadata ? JSON.parse(p.metadata) : {}; } catch { /* bozuk metadata: yoksay */ }
      const member = members.find((m) => m.id === p.identity || m.userId === p.identity);
      return {
        userId: p.identity,
        displayName: p.isLocal
          ? (localUser?.displayName || localUser?.username || p.name || p.identity)
          : (meta.displayName || member?.displayName || member?.username || p.name || p.identity),
        photoURL: p.isLocal ? (localUser?.photoURL || null) : (meta.photoURL || member?.photoURL || null),
        profileColor: p.isLocal ? (localColor || "#6366f1") : (meta.profileColor || member?.profileColor || member?.color || "#6366f1"),
        isMuted: p.isLocal ? !!isMuted : !!meta.isMuted,
        isDeafened: p.isLocal ? !!isDeafened : !!meta.isDeafened,
        isLocal: !!p.isLocal,
      };
    });
    const sig = JSON.stringify([roomId, channelName, serverName, list]);
    if (sig === lastSig.current) return;
    lastSig.current = sig;
    useRoomPresenceStore.getState().publish({ roomId, channelName: channelName || "", serverName: serverName || "", participants: list });
  }, [participants, members, localUser, isMuted, isDeafened, localColor, roomId, channelName, serverName]);

  // Odadan çıkınca temizle
  useEffect(() => () => useRoomPresenceStore.getState().clear(), []);

  return null;
}
