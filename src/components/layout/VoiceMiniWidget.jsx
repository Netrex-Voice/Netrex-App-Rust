"use client";

import { memo } from "react";
import { Maximize2, MicOff, PhoneOff, VolumeX } from "lucide-react";
import Avatar from "@/src/components/ui/Avatar";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useRoomPresenceStore } from "@/src/store/roomPresenceStore";
import { useSpeakingStore } from "@/src/store/speakingStore";

const MAX_VISIBLE = 5;

/** Tek avatar: konuşuyorsa parlar (kenar çubuğundaki sesli oda satırlarıyla aynı `speaking` görünümü ve aynı depo). */
const MiniAvatar = memo(function MiniAvatar({ p }) {
  const speaking = useSpeakingStore((s) => !!s.speakingParticipants[p.userId]);
  return (
    <li
      title={p.displayName + (p.isMuted ? " (mikrofon kapalı)" : "")}
      className={`relative rounded-xl ring-2 transition-all duration-200 ${
        speaking ? "z-10 scale-110 ring-emerald-400/70 shadow-[0_0_14px_rgba(52,211,153,0.55)]" : "ring-[#111214]"
      }`}
    >
      <Avatar
        size="lg"
        uid={p.userId}
        src={p.photoURL || null}
        name={p.displayName}
        color={p.profileColor}
        borderColor={p.profileColor}
        borderless
        speaking={speaking}
        muted={p.isMuted}
        deafened={p.isDeafened}
      />
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
 * Avatar odaklı: odadakiler büyük avatarlar olarak yan yana (üst üste binerek) durur, konuşan kişi parlar/büyür.
 * Altında oda adı. Yalnızca iki simge düğmesi: odaya dön, bağlantıyı kes. Kişi listesi `roomPresenceStore`'dan gelir.
 * Eylemler sayfanın işlevleridir; bağlantı mantığına dokunmaz.
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
      className="absolute bottom-4 right-4 z-[70] max-w-[calc(100%-2rem)] rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-[#111214]/95 to-[#111214]/95 p-2.5 shadow-[0_8px_28px_rgba(0,0,0,0.5)] backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-1.5" role="status" aria-live="polite">
            <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="max-w-[9rem] truncate text-[11px] font-bold text-emerald-300">{room.name}</span>
            {isMuted && (
              <span title="Mikrofon kapalı" className="text-red-300">
                <MicOff size={11} aria-hidden="true" />
                <span className="sr-only">Mikrofon kapalı</span>
              </span>
            )}
            {isDeafened && (
              <span title="Kulaklık kapalı" className="text-red-300">
                <VolumeX size={11} aria-hidden="true" />
                <span className="sr-only">Kulaklık kapalı</span>
              </span>
            )}
          </div>

          <ul className="flex items-center -space-x-2" aria-label="Odadakiler">
            {visible.map((p) => (
              <MiniAvatar key={p.userId} p={p} />
            ))}
            {extra > 0 && (
              <li className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-[#2b2d31] text-[11px] font-bold text-[#b5bac1] ring-2 ring-[#111214]">
                +{extra}
              </li>
            )}
          </ul>
        </div>

        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={onReturn}
            aria-label="Odaya dön"
            title="Odaya dön"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-500/25 bg-indigo-500/15 text-indigo-200 transition-colors hover:bg-indigo-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
          >
            <Maximize2 size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onLeave}
            aria-label="Sesli bağlantıyı kes"
            title="Bağlantıyı kes"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/25 bg-red-500/15 text-red-300 transition-colors hover:bg-red-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
          >
            <PhoneOff size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}

export default memo(VoiceMiniWidget);
