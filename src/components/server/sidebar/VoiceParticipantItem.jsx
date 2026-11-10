"use client";

import { memo } from "react";
import { MicOff, Headphones } from "lucide-react";
import Avatar from "@/src/components/ui/Avatar";
import { useSpeakingStore } from "@/src/store/speakingStore";

const VoiceParticipantItem = memo(
  function VoiceParticipantItem({
    participant,
    channelId,
    canDrag = false,                 // yetkili: başka bir sesli kanala sürükleyerek taşıyabilir
    onParticipantContextMenu,        // (e, participant, channelId) — sağ tık menüsü (taşı / at)
    onParticipantDragStart,          // (e, participant, channelId)
  }) {
    const displayName =
      participant.displayName || participant.username || "Kullanıcı";

    // profileColor hem avatar arka planı hem border için
    const effectiveColor =
      participant.profileColor || participant.color || null;

    const isSpeaking = useSpeakingStore(
      (state) => state.speakingParticipants[participant.userId] || false
    );

    return (
      <div
        draggable={canDrag}
        onDragStart={canDrag ? (e) => onParticipantDragStart?.(e, participant, channelId) : undefined}
        onContextMenu={
          onParticipantContextMenu
            ? (e) => onParticipantContextMenu(e, participant, channelId)
            : undefined
        }
        className={`animate-in fade-in slide-in-from-left-2 duration-300 flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-colors ${
          canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-default"
        }`}
      >
        {/* Avatar */}
        <div className={`relative flex-shrink-0 transition-opacity duration-200 ${(participant.isMuted || participant.isDeafened) ? 'opacity-50' : 'opacity-100'}`}>
          <Avatar
            size="sm"
            uid={participant.userId}
            src={participant.photoURL || null}
            name={displayName}
            color={effectiveColor}
            borderColor={effectiveColor}
            borderless={true}
            speaking={isSpeaking}
          />
        </div>

        {/* Username & Status */}
        <div className={`flex-1 min-w-0 flex items-center gap-2 transition-opacity duration-200 ${(participant.isMuted || participant.isDeafened) ? 'opacity-50' : 'opacity-100'}`}>
          <span className="text-xs text-[#949ba4] font-medium truncate">
            {displayName}
          </span>
          {participant.quickStatus && (
            <span
              className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-indigo-500/15 text-indigo-400 font-bold text-[8px] uppercase tracking-tighter border border-indigo-500/20"
              title={participant.quickStatus.label}
            >
              <span>{participant.quickStatus.icon}</span>
              <span className="hidden sm:inline truncate max-w-[40px]">
                {participant.quickStatus.label}
              </span>
            </span>
          )}
        </div>

        {/* Status Indicators Container */}
        <div className="flex items-center gap-1.5 shrink-0 pl-1">
          {/* Deafen Icon */}
          {participant.isDeafened && (
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-red-500/10 shadow-[0_0_8px_rgba(239,68,68,0.15)] transition-all">
               <Headphones size={13} strokeWidth={2.5} className="text-red-400 drop-shadow-sm" />
            </div>
          )}

          {/* Mute Icon (Also shown if deafened because deafen implies mute) */}
          {(participant.isMuted || participant.isDeafened) && (
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-red-500/10 shadow-[0_0_8px_rgba(239,68,68,0.15)] transition-all">
               <MicOff size={13} strokeWidth={2.5} className="text-red-400 drop-shadow-sm" />
            </div>
          )}

          {/* Speaking Indicator */}
          {!participant.isMuted && !participant.isDeafened && !isSpeaking && (
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50 shadow-[0_0_4px_rgba(16,185,129,0.3)] ml-0.5" />
          )}
          {isSpeaking && (
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] ml-0.5 animate-pulse" />
          )}
        </div>
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.participant.userId === next.participant.userId &&
      prev.participant.isMuted === next.participant.isMuted &&
      prev.participant.isDeafened === next.participant.isDeafened &&
      prev.participant.username === next.participant.username &&
      prev.participant.displayName === next.participant.displayName &&
      prev.participant.quickStatus === next.participant.quickStatus &&
      prev.participant.photoURL === next.participant.photoURL &&
      prev.participant.profileColor === next.participant.profileColor &&
      prev.participant.color === next.participant.color &&
      prev.channelId === next.channelId &&
      prev.canDrag === next.canDrag &&
      prev.onParticipantContextMenu === next.onParticipantContextMenu &&
      prev.onParticipantDragStart === next.onParticipantDragStart
    );
  },
);

export default VoiceParticipantItem;
