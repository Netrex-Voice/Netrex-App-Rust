"use client";

import { memo } from "react";
import { MicOff, PhoneOff, VolumeX } from "lucide-react";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useRoomPresenceStore } from "@/src/store/roomPresenceStore";
import VoiceParticipantItem from "@/src/components/server/sidebar/VoiceParticipantItem";

const MAX_VISIBLE = 6;

/**
 * Ana Sayfa'da sesli odadayken sağ altta duran küçük oda kutusu.
 *
 * Oda ekranı yerine gerçek Ana Sayfa gösterilirken odadaki kişileri CANLI gösterir: konuşan kişinin avatarı,
 * kenar çubuğundaki sesli oda satırlarıyla AYNI bileşen ve animasyonla parlar (VoiceParticipantItem + speakingStore).
 * Kişi listesi `roomPresenceStore`'dan gelir (odanın içindeki RoomPresencePublisher yazar).
 * Eylemler sayfanın mevcut işlevleridir; bağlantı mantığına dokunmaz.
 */
function VoiceMiniWidget({ room, onReturn, onLeave }) {
  const participants = useRoomPresenceStore((s) => s.participants);
  const isMuted = useSettingsStore((s) => s.isMuted);
  const isDeafened = useSettingsStore((s) => s.isDeafened);

  if (!room) return null;
  const visible = participants.slice(0, MAX_VISIBLE);
  const extra = participants.length - visible.length;

  return (
    <section
      role="region"
      aria-label="Sesli oda"
      className="absolute bottom-4 right-4 z-[70] w-72 max-w-[calc(100%-2rem)] overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-[#111214] to-[#111214] shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="flex items-center gap-2 px-3 pt-3" role="status" aria-live="polite">
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <span className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-emerald-400">Sesli bağlantı</span>
        <span className="ml-auto flex items-center gap-1">
          {isMuted && (
            <span title="Mikrofon kapalı" className="text-red-300">
              <MicOff size={12} aria-hidden="true" />
              <span className="sr-only">Mikrofon kapalı</span>
            </span>
          )}
          {isDeafened && (
            <span title="Kulaklık kapalı" className="text-red-300">
              <VolumeX size={12} aria-hidden="true" />
              <span className="sr-only">Kulaklık kapalı</span>
            </span>
          )}
        </span>
      </div>

      <div className="min-w-0 px-3 pt-1.5">
        <div className="truncate text-sm font-semibold text-white">{room.name}</div>
        <div className="truncate text-[11px] text-[#949ba4]">{room._serverName || "Sesli oda"}</div>
      </div>

      {visible.length > 0 && (
        <ul className="mt-2 max-h-56 space-y-0.5 overflow-y-auto px-2" aria-label="Odadakiler">
          {visible.map((p) => (
            <li key={p.userId}>
              <VoiceParticipantItem participant={p} channelId={room.id} />
            </li>
          ))}
          {extra > 0 && <li className="px-3 py-1 text-[11px] text-[#949ba4]">+{extra} kişi daha</li>}
        </ul>
      )}

      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          onClick={onReturn}
          className="flex-1 rounded-xl border border-indigo-500/25 bg-indigo-500/15 py-2 text-xs font-bold text-indigo-200 transition-colors hover:bg-indigo-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
        >
          Odaya dön
        </button>
        <button
          type="button"
          onClick={onLeave}
          aria-label="Sesli bağlantıyı kes"
          title="Bağlantıyı kes"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-500/25 bg-red-500/15 text-red-300 transition-colors hover:bg-red-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
        >
          <PhoneOff size={15} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}

export default memo(VoiceMiniWidget);
