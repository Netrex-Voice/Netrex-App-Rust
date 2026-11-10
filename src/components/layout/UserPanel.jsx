"use client";

/**
 * 👤 UserPanel - Bottom User Info Panel
 * NDS v2.0 - Netrex Design System
 * 
 * Shows current user info at the bottom of sidebar:
 * - Avatar with status
 * - Username
 * - Quick action buttons (mute, deafen, settings)
 */

import { Mic, MicOff, Headphones, VolumeX, Settings } from "lucide-react";
import UserPhoto from "@/src/components/ui/UserPhoto";
import { AvatarFallback } from "@/src/components/ui/Avatar";

export default function UserPanel({ 
  user,
  isMuted = false,
  isDeafened = false,
  onMuteToggle,
  onDeafenToggle,
  onSettingsClick,
  className = "" 
}) {
  const displayName = user?.displayName || user?.email?.split("@")[0] || "Kullanıcı";
  const statusText = isMuted ? "Susturuldu" : isDeafened ? "Sağır" : "Çevrimiçi";

  return (
    <div className={`
      user-panel
      h-full w-full
      flex items-center
      px-2 gap-2
      ${className}
    `}>
      {/* Avatar with Status */}
      <div className="relative flex-shrink-0">
        <div 
          className="
            w-8 h-8
            rounded-lg
            flex items-center justify-center
            text-white
            font-semibold
            text-small
            overflow-hidden
          "
        >
          <UserPhoto
            uid={user?.uid}
            src={user?.photoURL}
            alt={displayName}
            className="w-full h-full object-cover"
            fallback={<AvatarFallback name={displayName} className="w-full h-full" textClassName="text-small" />}
          />
        </div>

        {/* Status Indicator */}
        <div className="
          absolute -bottom-0.5 -right-0.5
          w-3.5 h-3.5
          bg-nds-bg-deep
          rounded-full
          flex items-center justify-center
        ">
          <div className={`
            w-2.5 h-2.5
            rounded-full
            ${isMuted || isDeafened ? 'bg-nds-offline' : 'bg-nds-online'}
          `} />
        </div>
      </div>

      {/* User Info */}
      <div className="flex-1 min-w-0">
        <div className="
          text-small
          font-semibold
          text-nds-text-primary
          truncate
        ">
          {displayName}
        </div>
        <div className="
          text-nano
          text-nds-text-muted
          truncate
        ">
          {statusText}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {/* Mute Toggle */}
        <button
          onClick={onMuteToggle}
          className={`
            w-8 h-8
            rounded-md
            flex items-center justify-center
            transition-all duration-normal
            ${isMuted 
              ? 'text-nds-danger bg-nds-danger/10' 
              : 'text-nds-text-tertiary hover:text-nds-text-primary hover:bg-white/5'
            }
          `}
          title={isMuted ? "Sesi Aç" : "Sustur"}
        >
          {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        {/* Deafen Toggle */}
        <button
          onClick={onDeafenToggle}
          className={`
            w-8 h-8
            rounded-md
            flex items-center justify-center
            transition-all duration-normal
            ${isDeafened 
              ? 'text-nds-danger bg-nds-danger/10' 
              : 'text-nds-text-tertiary hover:text-nds-text-primary hover:bg-white/5'
            }
          `}
          title={isDeafened ? "Sağırlaştırmayı Kapat" : "Sağırlaştır"}
        >
          {isDeafened ? <VolumeX size={18} /> : <Headphones size={18} />}
        </button>

        {/* Settings */}
        <button
          onClick={onSettingsClick}
          className="
            w-8 h-8
            rounded-md
            flex items-center justify-center
            text-nds-text-tertiary
            hover:text-nds-text-primary
            hover:bg-white/5
            hover:rotate-45
            transition-all duration-medium
          "
          title="Ayarlar"
        >
          <Settings size={18} />
        </button>
      </div>
    </div>
  );
}
