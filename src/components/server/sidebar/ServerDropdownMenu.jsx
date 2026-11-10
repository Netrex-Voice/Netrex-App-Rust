"use client";

import { memo } from "react";
import { UserPlus, Settings, Plus, Trash2, LogOut, Users } from "lucide-react";
import { useServerStore } from "@/src/store/serverStore";

/**
 * 📋 ServerDropdownMenu - OPTIMIZED Dropdown Menu
 */
const ServerDropdownMenu = memo(function ServerDropdownMenu({
  isOwner,
  canManageServer,
  canManageChannels,
  onInvite,
  onSettings,
  onCreateChannel,
  onDeleteServer,
  onLeaveServer
}) {
  return (
    <div className="absolute top-[calc(100%)] left-4 right-4 mt-2 bg-[#111214]/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-50 animate-in fade-in zoom-in-95 slide-in-from-top-2 p-2 space-y-1">
      <button 
        onClick={onInvite} 
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500 hover:text-white transition-all"
      >
        <UserPlus size={18} />
        <span className="text-sm font-semibold">Davet Et</span>
      </button>

      {/* Üye Listesi */}
      <MenuButton 
        icon={<Users size={18} />} 
        label="Üye Listesi" 
        onClick={() => {
          useServerStore.getState().setMobileMemberDrawerOpen(true);
        }} 
      />

      <div className="h-px bg-white/10 my-1 mx-2" />

      {/* Server Settings - Owner or Manager */}
      {(isOwner || canManageServer) && (
        <MenuButton 
          icon={<Settings size={18} />} 
          label="Ayarlar" 
          onClick={onSettings} 
        />
      )}

      {/* Create Channel - Owner or Manage Channels */}
      {(isOwner || canManageChannels) && (
        <MenuButton 
          icon={<Plus size={18} />} 
          label="Kanal Ekle" 
          onClick={onCreateChannel} 
        />
      )}

      {/* Delete Server - Owner Only */}
      {isOwner && (
        <MenuButton 
          icon={<Trash2 size={18} />} 
          label="Sunucuyu Sil" 
          danger 
          onClick={onDeleteServer} 
        />
      )}
      
      {/* Leave Server - Non-Owners */}
      {!isOwner && (
        <MenuButton 
          icon={<LogOut size={18} />} 
          label="Ayrıl" 
          danger 
          onClick={onLeaveServer} 
        />
      )}
    </div>
  );
});

/**
 * Menu Button Component
 */
function MenuButton({ icon, label, onClick, danger }) {
  return (
    <button 
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
        ${danger 
          ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300' 
          : 'text-[#949ba4] hover:bg-white/5 hover:text-white'
        }
      `}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

export default ServerDropdownMenu;
