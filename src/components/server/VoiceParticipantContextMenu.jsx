"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRightLeft, LogOut, Volume2, UserPlus, Split } from "lucide-react";
import { VOICE_GROUPS, DEFAULT_GROUP_ID } from "@/src/store/voiceGroupStore";

/**
 * 🎛️ Sesli kanaldaki bir kişiye sağ tık menüsü (Discord'daki gibi)
 *  - Başka kanala taşı (listeden seç)
 *  - Kanalıma çek (sen bir sesli kanaldaysan)
 *  - Sesli kanaldan at
 *
 * Kişinin aynı odada olması gerekmez; komut Realtime Database üzerinden gider ve hedefte yetkisi doğrulanır.
 */
export default function VoiceParticipantContextMenu({
  x,
  y,
  participant,
  currentChannelId,   // kişinin şu an bulunduğu kanal
  myChannelId,        // benim şu an bulunduğum sesli kanal (yoksa null)
  voiceChannels,      // sunucudaki sesli kanallar
  canMove,
  canDisconnect,
  group,              // konuşma grubu bilgisi/eylemleri (yoksa null): { groupId, isSelf, onMoveToGroup, onSplit, roomSize, myGroupId }
  onMove,             // (channelId) => void
  onDisconnect,       // () => void
  onClose,
}) {
  const menuRef = useRef(null);
  const [coords, setCoords] = useState({ top: y, left: x });
  const [ready, setReady] = useState(false);

  const displayName = participant?.displayName || participant?.username || "Kullanıcı";
  const otherChannels = voiceChannels.filter((c) => c.id !== currentChannelId);
  const canBringToMe = canMove && myChannelId && myChannelId !== currentChannelId;

  // Ekran dışına taşmasın (gerçek boyut ölçülür)
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = 8;
    let left = x;
    let top = y;
    if (left + r.width > window.innerWidth - pad) left = window.innerWidth - r.width - pad;
    if (top + r.height > window.innerHeight - pad) top = window.innerHeight - r.height - pad;
    setCoords({ left: Math.max(pad, left), top: Math.max(pad, top) });
    setReady(true);
  }, [x, y]);

  useEffect(() => {
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("blur", onClose);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  if (!canMove && !canDisconnect && !group) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[10060] w-64 bg-[#0d0e10] border border-white/[0.08] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.05)] p-2 flex flex-col select-none"
      style={{
        left: coords.left,
        top: coords.top,
        opacity: ready ? 1 : 0,
        transform: ready ? "scale(1)" : "scale(0.96)",
        transition: "opacity 120ms ease-out, transform 120ms ease-out",
        transformOrigin: "top left",
        maxHeight: "calc(100vh - 16px)",
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="px-2.5 pt-1 pb-2 border-b border-white/[0.06] mb-1">
        <span className="text-xs font-bold text-white truncate block">
          {displayName}
          {group?.isSelf ? " (Sen)" : ""}
        </span>
        <span className="text-[10px] text-[#5c5e66]">{canMove || canDisconnect ? "Sesli kanal yönetimi" : "Konuşma grubu"}</span>
      </div>

      {/* 🎙️ Konuşma grubu: gruba taşı / gruptan çık / onunla ayrı konuş */}
      {group && (
        <div className="px-1 pb-2 mb-1 border-b border-white/[0.06]">
          <div className="px-1.5 pt-1 pb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#72767d] font-semibold">
            <Split size={11} />
            Konuşma Grubu
          </div>
          <div className="flex items-center gap-1.5 px-1">
            {VOICE_GROUPS.map((g) => {
              const active = group.groupId === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => {
                    group.onMoveToGroup(g.id);
                    onClose();
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95 ${
                    active ? "text-white" : "bg-white/5 text-[#949ba4] hover:text-white hover:bg-white/10"
                  }`}
                  style={active ? { background: g.color, boxShadow: `0 0 10px ${g.color}55` } : undefined}
                >
                  {g.name}
                </button>
              );
            })}
          </div>

          {/* Gruptan çık: Grup 1'e (ana gruba) dön */}
          {group.groupId !== DEFAULT_GROUP_ID && (
            <button
              onClick={() => {
                group.onMoveToGroup(DEFAULT_GROUP_ID);
                onClose();
              }}
              className="mt-1.5 w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-[#dbdee1] hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              <LogOut size={14} className="text-indigo-400" />
              {group.isSelf ? "Gruptan Çık" : "Gruptan Çıkar"}
            </button>
          )}

          {/* Onunla ayrı konuş (ikimiz de aynı gruptayız ve odada 3+ kişi var) */}
          {!group.isSelf && group.groupId === group.myGroupId && group.roomSize > 2 && (
            <button
              onClick={() => {
                group.onSplit();
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-[#dbdee1] hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              <Split size={14} className="text-indigo-400" />
              Onunla Ayrı Konuş
            </button>
          )}
        </div>
      )}

      {canBringToMe && (
        <button
          onClick={() => {
            onMove(myChannelId);
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-[#dbdee1] hover:bg-white/[0.06] hover:text-white transition-colors"
        >
          <UserPlus size={14} className="text-cyan-400" />
          Kanalıma Çek
        </button>
      )}

      {canMove && (
        <div className="mt-1">
          <div className="px-2.5 pt-1.5 pb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[#72767d] font-semibold">
            <ArrowRightLeft size={11} />
            Kanala Taşı
          </div>
          {otherChannels.length === 0 ? (
            <div className="px-2.5 py-2 text-xs text-[#5c5e66] italic">Başka sesli kanal yok</div>
          ) : (
            <div className="max-h-52 overflow-y-auto custom-scrollbar">
              {otherChannels.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    onMove(c.id);
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[13px] font-medium text-[#b5bac1] hover:bg-white/[0.06] hover:text-white transition-colors"
                >
                  <Volume2 size={13} className="text-[#5c5e66] shrink-0" />
                  <span className="truncate">{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {canDisconnect && (
        <>
          {canMove && <div className="h-px bg-white/[0.06] my-1.5 mx-1" />}
          <button
            onClick={() => {
              onDisconnect();
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
          >
            <LogOut size={14} />
            Sesli Kanaldan At
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
