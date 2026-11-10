"use client";

/**
 * 👤 UserCard - Voice Channel User Card
 * NDS v2.0 - Netrex Design System
 */

import { MicOff, VolumeX, Video, Monitor } from "lucide-react";
import Avatar from "./Avatar";

export default function UserCard({
  user,
  speaking = false,
  muted = false,
  deafened = false,
  hasVideo = false,
  isScreenSharing = false,
  isCurrentUser = false,
  onClick,
  className = "",
}) {
  const displayName = user?.displayName || user?.name || "Kullanıcı";

  return (
    <div
      onClick={onClick}
      className={`
        flex items-center p-3 gap-3 rounded-xl cursor-pointer group
        transition-all duration-normal
        ${speaking
          ? "bg-nds-success/10 border border-nds-success/50 shadow-nds-glow-green"
          : "bg-nds-glass-light hover:bg-white/[0.08] border border-transparent"
        }
        ${muted || deafened ? "opacity-60" : ""}
        ${className}
      `}
    >
      <Avatar
        uid={user?.uid || user?.id}
        src={user?.photoURL}
        name={displayName}
        size="md"
        speaking={speaking}
        muted={muted}
        deafened={deafened}
        borderColor={user?.profileColor}
      />

      <div className="flex-1 min-w-0">
        <div className={`text-body font-medium truncate ${speaking ? "text-nds-success" : "text-nds-text-primary"}`}>
          {displayName}
          {isCurrentUser && <span className="text-nds-text-muted text-caption ml-1">(Sen)</span>}
        </div>
        {(hasVideo || isScreenSharing) && (
          <div className="flex items-center gap-1.5 mt-0.5">
            {hasVideo && <span className="flex items-center gap-1 text-caption text-nds-accent-primary"><Video size={10} />Video</span>}
            {isScreenSharing && <span className="flex items-center gap-1 text-caption text-nds-accent-secondary"><Monitor size={10} />Ekran</span>}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        {muted && <div className="p-1 rounded bg-nds-danger/20 text-nds-danger"><MicOff size={14} /></div>}
        {deafened && <div className="p-1 rounded bg-nds-danger/20 text-nds-danger"><VolumeX size={14} /></div>}
      </div>
    </div>
  );
}
