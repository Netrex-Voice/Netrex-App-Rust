"use client";

import { memo } from "react";
import { MicOff, PhoneOff, VolumeX } from "lucide-react";
import Avatar from "@/src/components/ui/Avatar";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useRoomPresenceStore } from "@/src/store/roomPresenceStore";
import { useSpeakingStore } from "@/src/store/speakingStore";

const MAX_VISIBLE = 5;

/** Tek kişi: büyük yuvarlak avatar (üst üste biner) + altında kısa isim. Konuşuyorsa avatar parlar. */
const MiniPerson = memo(function MiniPerson({ p }) {
  const speaking = useSpeakingStore((s) => !!s.speakingParticipants[p.userId]);
  return (
    <li
      title={p.displayName + (p.isMuted ? " (mikrofon kapalı)" : "")}
      className={`relative flex w-12 shrink-0 flex-col items-center transition-transform duration-200 ${speaking ? "z-10 scale-105" : ""}`}
    >
      <div
        className={`rounded-full ring-[3px] transition-all duration-200 [&_div]:!rounded-full ${
          speaking ? "ring-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.6)]" : "ring-black/40"
        }`}
      >
        <div style={{ zoom: 0.75 }}>
        <Avatar
          size="xl"
          uid={p.userId}
          src={p.photoURL || null}
          name={p.displayName}
          color={p.profileColor}
          borderColor={p.profileColor}
          borderless
          muted={p.isMuted}
          deafened={p.isDeafened}
        />
        </div>
      </div>
      <span aria-hidden="true" className="mt-1 w-12 truncate text-center text-[10px] font-semibold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.9)]">
        {p.displayName}
      </span>
      <span className="sr-only">
        {p.displayName}
        {speaking ? ", konuşuyor" : ""}
        {p.isMuted ? ", mikrofonu kapalı" : ""}
      </span>
    </li>
  );
});

/**
 * Ana Sayfa'da sesli odadayken sağ altta duran KÜÇÜK oda kutusu.
 *
 * Üst satır: sunucu adı (tıklanınca odaya döner) + yanında çıkış düğmesi. Altı: odadakiler büyük yuvarlak avatarlar
 * (üst üste binerek), her birinin altında kısa isim; konuşan kişi parlar. Kişi listesi `roomPresenceStore`'dan gelir.
 * Eylemler sayfanın işlevleridir; bağlantı mantığına dokunmaz.
 */
function VoiceMiniWidget({ room, onReturn, onLeave }) {
  const participants = useRoomPresenceStore((s) => s.participants);
  const serverName = useRoomPresenceStore((s) => s.serverName);
  const isMuted = useSettingsStore((s) => s.isMuted);
  const isDeafened = useSettingsStore((s) => s.isDeafened);

  if (!room) return null;
  const visible = participants.slice(0, MAX_VISIBLE);
  const extra = participants.length - visible.length;
  const title = serverName || room.name;

  return (
    <section
      role="region"
      aria-label="Sesli oda"
      className="absolute bottom-4 right-4 z-[70] max-w-[calc(100%-2rem)] animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onReturn}
          aria-label={`Odaya dön: ${room.name}`}
          title={`Odaya dön (${room.name})`}
          className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 py-1 text-left transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
        >
          <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-extrabold uppercase tracking-wide text-emerald-300 [text-shadow:0_1px_4px_rgba(0,0,0,0.9)]">{title}</span>
          {isMuted && (
            <span title="Mikrofon kapalı" className="text-red-300">
              <MicOff size={13} aria-hidden="true" />
              <span className="sr-only">Mikrofon kapalı</span>
            </span>
          )}
          {isDeafened && (
            <span title="Kulaklık kapalı" className="text-red-300">
              <VolumeX size={13} aria-hidden="true" />
              <span className="sr-only">Kulaklık kapalı</span>
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onLeave}
          aria-label="Sesli bağlantıyı kes"
          title="Bağlantıyı kes"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-500/80 text-white shadow-[0_2px_8px_rgba(0,0,0,0.5)] transition-colors hover:bg-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300/70"
        >
          <PhoneOff size={14} aria-hidden="true" />
        </button>
      </div>

      <ul className="mt-2 flex items-start justify-end -space-x-3" aria-label="Odadakiler">
        {visible.map((p) => (
          <MiniPerson key={p.userId} p={p} />
        ))}
        {extra > 0 && (
          <li className="relative flex w-12 shrink-0 flex-col items-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2b2d31] text-xs font-bold text-[#b5bac1] ring-[3px] ring-black/40">
              +{extra}
            </div>
          </li>
        )}
      </ul>
    </section>
  );
}

export default memo(VoiceMiniWidget);
