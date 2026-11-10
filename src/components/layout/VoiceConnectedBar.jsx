"use client";

import { memo } from "react";
import { MicOff, PhoneOff, VolumeX } from "lucide-react";
import { useSettingsStore } from "@/src/store/settingsStore";

/**
 * Sesli bağlantı kartı (kenar çubuğunun altı).
 *
 * Sesli bir odadayken oda ekranından ayrılınca (Mesajlar, başka sunucu…) bağlı olduğunu GÖSTERİR ve tek
 * tıkla odaya dönmeyi / bağlantıyı kesmeyi sağlar. Eskiden odanın dışında bağlı olduğunu gösteren hiçbir şey yoktu:
 * mikrofon açık kalabiliyor, kullanıcı fark etmiyordu.
 *
 * Yalnızca GÖRÜNÜM + iki eylem; bağlantı mantığına dokunmaz (eylemler sayfanın zaten kullandığı işlevlerdir).
 */
function VoiceConnectedBar({ room, onReturn, onLeave }) {
  const isMuted = useSettingsStore((s) => s.isMuted);
  const isDeafened = useSettingsStore((s) => s.isDeafened);

  if (!room) return null;
  const where = room._serverName || "Sesli oda";

  return (
    <section
      role="region"
      aria-label="Sesli bağlantı"
      className="mx-3 mb-3 shrink-0 rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-[#111214] to-[#111214] p-3 shadow-[0_0_20px_rgba(16,185,129,0.08)]"
    >
      <div className="flex items-center gap-2" role="status" aria-live="polite">
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

      <div className="mt-2 min-w-0">
        <div className="truncate text-sm font-semibold text-white">{room.name}</div>
        <div className="truncate text-[11px] text-[#949ba4]">{where}</div>
      </div>

      <div className="mt-3 flex items-center gap-2">
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

export default memo(VoiceConnectedBar);
