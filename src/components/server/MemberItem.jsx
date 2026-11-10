"use client";

import { memo } from "react";
import Avatar from "@/src/components/ui/Avatar";
import GameDuration from "@/src/components/ui/GameDuration";
import GameIcon from "@/src/components/ui/GameIcon";
import { Crown } from "lucide-react";

const MemberItem = memo(
  function MemberItem({
    member,
    roleId,
    roleColor,
    isOfflineGroup,
    onClick,
    onContextMenu,
  }) {
    // profileColor → hem avatar arka planı hem border için kullan
    const effectiveColor = member.profileColor || member.color;

    return (
      <div
        onClick={(e) => onClick(e, member)}
        onContextMenu={(e) => onContextMenu(e, member)}
        className="
        group relative
        flex items-center gap-3 
        px-3 py-2 
        rounded-xl
        border border-transparent
        hover:bg-white/[0.04] hover:border-white/[0.04]
        cursor-pointer 
        transition-colors duration-200
      "
      >
        {/* Active Indicator Bar */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-indigo-500 rounded-r opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

        {/* Avatar */}
        <div className="relative shrink-0">
          <Avatar
            uid={member.id || member.userId}
            src={member.photoURL}
            name={member.displayName}
            size="md"
            status={member.presence || "online"}
            color={effectiveColor}
            borderColor={effectiveColor}
            className={`
            rounded-xl 
            ${roleId === "owner" ? "ring-2 ring-amber-500/20" : ""}
          `}
          />
          {roleId === "owner" && (
            <div className="absolute -top-1 -right-1 bg-[#111214] rounded-full p-0.5 border border-amber-500/30">
              <Crown size={8} className="text-amber-500 fill-amber-500" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center gap-1.5">
            <span
              className="text-sm font-medium truncate text-[#dbdee1] group-hover:text-white transition-colors"
              style={{
                color:
                  !isOfflineGroup && roleId !== "uncategorized"
                    ? roleColor
                    : undefined,
              }}
            >
              {member.displayName}
            </span>
          </div>

          {/* Status Text */}
          <div className="text-[11px] truncate text-[#949ba4] group-hover:text-[#b5bac1] transition-colors min-h-[16px] flex items-center">
            {member.gameActivity && member.presence !== "offline" ? (
              <span className="flex items-center gap-1.5 text-green-400 group/game relative">
                <GameIcon
                  iconUrl={member.gameActivity.iconUrl}
                  icon={member.gameActivity.icon}
                  name={member.gameActivity.name}
                  className="w-3.5 h-3.5 object-cover rounded-[2px]"
                />
                <span className="truncate max-w-[120px]">
                  {member.gameActivity.name}
                </span>
                <GameDuration startTime={member.gameActivity.startedAt} />
              </span>
            ) : member.quickStatus ? (
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold text-[9px] uppercase tracking-wider border border-indigo-500/30">
                <span className="text-[11px]">{member.quickStatus.icon}</span>
                {member.quickStatus.label}
              </span>
            ) : member.customStatus ? (
              <span style={{ color: member.customStatusColor || "inherit" }}>
                {member.customStatus}
              </span>
            ) : member.presence === "idle" ? (
              <span className="flex items-center gap-1 text-amber-500/80">
                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                Uzakta
              </span>
            ) : member.presence === "dnd" ? (
              <span className="text-red-400/80">Rahatsız Etme</span>
            ) : null}
          </div>
        </div>
      </div>
    );
  },
  (prev, next) => {
    return (
      prev.member.id === next.member.id &&
      prev.member.displayName === next.member.displayName &&
      prev.member.photoURL === next.member.photoURL &&
      prev.member.presence === next.member.presence &&
      prev.member.customStatus === next.member.customStatus &&
      prev.member.gameActivity?.name === next.member.gameActivity?.name &&
      prev.member.profileColor === next.member.profileColor && // ✅ profileColor değişince re-render
      prev.member.color === next.member.color &&
      prev.roleId === next.roleId &&
      prev.roleColor === next.roleColor &&
      prev.isOfflineGroup === next.isOfflineGroup
    );
  },
);

export default MemberItem;
