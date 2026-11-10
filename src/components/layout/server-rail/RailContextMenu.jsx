"use client";

import { createPortal } from "react-dom";
import { Upload, RefreshCw, Settings, UserPlus, LogOut } from "lucide-react";

/**
 * 🖱️ RailContextMenu - Server right-click menu
 */
export default function RailContextMenu({ 
  menuPos, 
  onClose, 
  isOwner, 
  canManage, 
  serverId, 
  onOpenSettings, 
  onOpenInvite, 
  onLeave, 
  fileInputRef, 
  handleFileChange, 
  hasLocalIcon, 
  clearLocalIcon 
}) {
  if (typeof document === 'undefined') return null;
  
  return createPortal(
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[9999]" 
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      
      {/* Menu */}
      <div 
        className="
          fixed z-[10000] w-56
          bg-[#0d0e10]/95
          backdrop-blur-xl
          rounded-xl overflow-hidden 
          shadow-[0_8px_32px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.05)]
          border border-white/[0.08]
          p-1.5 space-y-0.5
          animate-in fade-in zoom-in-95 duration-150 origin-top-left
        "
        style={{ top: menuPos.top, left: menuPos.left }}
      >
        {/* Section 1: Actions */}
        <div className="px-2.5 py-1.5 text-[10px] font-semibold text-[#5c5e66] uppercase tracking-wider">
          Sunucu
        </div>
        
        <MenuButton 
          icon={<UserPlus size={14}/>} 
          label="İnsanları Davet Et" 
          onClick={() => { onClose(); onOpenInvite(serverId); }} 
          color="indigo" 
        />

        <div className="h-px bg-white/[0.06] my-1" />

        {(isOwner || canManage) && (
          <MenuButton 
            icon={<Settings size={14}/>} 
            label="Sunucu Ayarları" 
            onClick={() => { onClose(); onOpenSettings(serverId, 'overview'); }} 
          />
        )}

        {!isOwner && (
          <MenuButton 
            icon={<LogOut size={14}/>} 
            label="Sunucudan Ayrıl" 
            onClick={() => { onClose(); onLeave(); }} 
            color="red" 
          />
        )}

        {/* Section 2: Customization */}
        <div className="h-px bg-white/[0.06] my-1" />
        <div className="px-2.5 py-1.5 text-[10px] font-semibold text-[#5c5e66] uppercase tracking-wider">
          Simge Yönetimi
        </div>
        
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="image/*" 
          className="hidden" 
        />
        
        <MenuButton 
          icon={<Upload size={14}/>} 
          label="Simge Değiştir" 
          onClick={() => fileInputRef.current?.click()} 
        />
        
        {hasLocalIcon && (
          <MenuButton 
            icon={<RefreshCw size={14}/>} 
            label="Varsayılanı Geri Yükle" 
            onClick={clearLocalIcon} 
            color="red" 
          />
        )}
      </div>
    </>,
    document.body
  );
}

/**
 * Menu Button Component
 */
function MenuButton({ icon, label, onClick, color = "default" }) {
  const colors = {
    default: "text-[#b5bac1] hover:bg-white/[0.06] hover:text-white",
    indigo: "text-indigo-400 hover:bg-indigo-500/15 hover:text-indigo-300",
    red: "text-red-400 hover:bg-red-500/15 hover:text-red-300",
  };

  return (
    <button 
      onClick={onClick}
      className={`
        w-full text-left px-2.5 py-2 rounded-lg text-[13px] font-medium 
        transition-all duration-150 flex items-center gap-2.5 group
        ${colors[color]}
      `}
    >
      <span className="opacity-70 group-hover:opacity-100 transition-opacity">
        {icon}
      </span>
      {label}
    </button>
  );
}
