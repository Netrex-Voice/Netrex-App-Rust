"use client";

import { memo, useMemo, useState } from "react";
import { VOICE_GROUPS, DEFAULT_GROUP_ID } from "@/src/store/voiceGroupStore";
import { Volume2, Signal, Lock } from "lucide-react";
import VoiceParticipantItem from "./VoiceParticipantItem";
import { USER_MIME, CHANNEL_MIME, hasType, readDragData } from "./dnd";

/**
 * 🎤 VoiceChannelItem - OPTIMIZED Voice Channel Card
 * Memoized with participant list
 *
 * Sürükle-bırak:
 *  - Bir KİŞİYİ (yetkili) bu kanalın üzerine bırakınca o kişi bu kanala taşınır.
 *  - Bir KANALI (kanal yönetimi yetkisi) başka bir sesli kanalın üzerine bırakınca sıra değişir.
 */
const VoiceChannelItem = memo(function VoiceChannelItem({
  channel,
  isActive,
  participants,
  hasRestrictions,
  onClick,
  onContextMenu,
  canMoveUsers = false,
  canReorder = false,
  onMoveUser,                 // (userId, toChannelId) => void
  onReorder,                  // (draggedChannelId, targetChannelId) => void
  onParticipantContextMenu,   // (e, participant, channelId)
  onParticipantDragStart,     // (e, participant, channelId)
  groupAssignments,           // { [userId]: groupId } — sadece bağlı olduğum kanalda dolu
  myIdentity,
}) {
  // "user": kişi bırakılabilir, "channel": kanal sırası değişecek
  const [dropState, setDropState] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // 🎙️ Konuşma grupları: yalnızca bağlı olduğum kanal için (grup bilgisi odadakilerde paylaşılır)
  const grouped = useMemo(() => {
    if (!groupAssignments || Object.keys(groupAssignments).length === 0) return null;
    const mineId = myIdentity ? (groupAssignments[myIdentity] ?? DEFAULT_GROUP_ID) : null;
    return VOICE_GROUPS.map((group) => ({
      group,
      isMine: group.id === mineId,
      members: participants.filter((p) => (groupAssignments[p.userId] ?? DEFAULT_GROUP_ID) === group.id),
    })).filter((g) => g.members.length > 0);
  }, [groupAssignments, myIdentity, participants]);

  const handleDragOver = (e) => {
    if (canMoveUsers && hasType(e, USER_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dropState !== "user") setDropState("user");
    } else if (canReorder && hasType(e, CHANNEL_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dropState !== "channel") setDropState("channel");
    }
  };

  const handleDragLeave = (e) => {
    // Alt öğelere girerken yanıp sönmesin
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDropState(null);
  };

  const handleDrop = (e) => {
    setDropState(null);
    if (canMoveUsers && hasType(e, USER_MIME)) {
      e.preventDefault();
      const data = readDragData(e, USER_MIME);
      if (data?.userId && data.fromChannelId !== channel.id) onMoveUser?.(data.userId, channel.id);
    } else if (canReorder && hasType(e, CHANNEL_MIME)) {
      e.preventDefault();
      const data = readDragData(e, CHANNEL_MIME);
      if (data?.id && data.type === "voice" && data.id !== channel.id) onReorder?.(data.id, channel.id);
    }
  };

  return (
    <div
      className={`flex flex-col rounded-2xl transition-shadow duration-150 ${
        dropState === "user"
          ? "ring-2 ring-cyan-400/60 shadow-[0_0_18px_rgba(34,211,238,0.2)]"
          : dropState === "channel"
            ? "ring-2 ring-cyan-400/50 bg-cyan-500/[0.04]"
            : ""
      } ${isDragging ? "opacity-50" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Voice Channel Card */}
      <div
        onClick={onClick}
        onContextMenu={onContextMenu}
        draggable={canReorder}
        onDragStart={
          canReorder
            ? (e) => {
                e.dataTransfer.setData(CHANNEL_MIME, JSON.stringify({ id: channel.id, type: "voice" }));
                e.dataTransfer.setData("text/plain", channel.name);
                e.dataTransfer.effectAllowed = "move";
                setIsDragging(true);
              }
            : undefined
        }
        onDragEnd={() => setIsDragging(false)}
        className={`
          group relative p-3 rounded-2xl cursor-pointer border transition-all duration-300
          ${isActive
            ? "bg-gradient-to-br from-[#1a1b1e] to-[#111214] border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.1)]"
            : "bg-[#111214] border-white/5 hover:border-white/10 hover:bg-[#16171a]"
          }
        `}
      >
        {/* Channel Info Row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className={`
              p-1.5 rounded-lg transition-colors
              ${isActive ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-[#5c5e66] group-hover:text-[#949ba4]'}
            `}>
              {isActive ? <Signal size={14} /> : <Volume2 size={14} />}
            </div>
            <span className={`truncate font-semibold text-sm ${isActive ? 'text-white' : 'text-[#949ba4] group-hover:text-white'}`}>
              {channel.name}
            </span>
          </div>
          {hasRestrictions && <Lock size={12} className="text-[#5c5e66]" />}
        </div>

        {/* Participants Count Badge */}
        <div className="flex items-center justify-between">
          {dropState === "user" ? (
            <span className="text-[10px] text-cyan-300 font-semibold">Taşımak için bırak</span>
          ) : participants.length > 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-cyan-400 font-semibold">{participants.length} kişi bağlı</span>
            </div>
          ) : (
            <span className="text-[10px] text-[#5c5e66] italic group-hover:text-[#80848e] transition-colors">
              Boş oda
            </span>
          )}

          {/* Active Dot if connected */}
          {isActive && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />}
        </div>
      </div>

      {/* Participants List (Under Channel Card) */}
      {participants.length > 0 && (
        grouped ? (
          // 🎙️ Konuşma grupları açıksa: kişiler renkli grup bloklarında (sadece bağlı olduğum kanalda bilinir)
          <div className="mt-1 ml-3 space-y-1.5">
            {grouped.map(({ group, members, isMine }) => (
              <div
                key={group.id}
                className="rounded-xl border-l-2 pl-1 py-1"
                style={{ borderColor: group.color, background: `${group.color}${isMine ? "14" : "0a"}` }}
              >
                <div className="flex items-center gap-1.5 px-2 pb-0.5">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: group.color }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: group.color }}>
                    {group.name}
                  </span>
                  <span className="text-[10px] text-[#5c5e66]">{members.length}</span>
                  {isMine && (
                    <span
                      className="ml-auto text-[8px] font-black px-1.5 py-0.5 rounded text-white tracking-wide"
                      style={{ background: group.color }}
                    >
                      SEN
                    </span>
                  )}
                </div>
                <div className="space-y-0.5">
                  {members.map((participant) => (
                    <VoiceParticipantItem
                      key={participant.userId}
                      participant={participant}
                      channelId={channel.id}
                      canDrag={canMoveUsers}
                      onParticipantContextMenu={onParticipantContextMenu}
                      onParticipantDragStart={onParticipantDragStart}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-1 ml-3 space-y-0.5">
            {participants.map((participant) => (
              <VoiceParticipantItem
                key={participant.userId}
                participant={participant}
                channelId={channel.id}
                canDrag={canMoveUsers}
                onParticipantContextMenu={onParticipantContextMenu}
                onParticipantDragStart={onParticipantDragStart}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison
  return (
    prevProps.channel.id === nextProps.channel.id &&
    prevProps.channel.name === nextProps.channel.name &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.hasRestrictions === nextProps.hasRestrictions &&
    prevProps.participants.length === nextProps.participants.length &&
    JSON.stringify(prevProps.participants) === JSON.stringify(nextProps.participants) &&
    prevProps.onClick === nextProps.onClick && // ✅ onClick değişimini kontrol et!
    prevProps.canMoveUsers === nextProps.canMoveUsers &&
    prevProps.canReorder === nextProps.canReorder &&
    prevProps.onMoveUser === nextProps.onMoveUser &&
    prevProps.onReorder === nextProps.onReorder &&
    prevProps.onParticipantContextMenu === nextProps.onParticipantContextMenu &&
    prevProps.onParticipantDragStart === nextProps.onParticipantDragStart &&
    prevProps.groupAssignments === nextProps.groupAssignments &&
    prevProps.myIdentity === nextProps.myIdentity
  );
});

export default VoiceChannelItem;
