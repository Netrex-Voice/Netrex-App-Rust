"use client";

import { memo } from "react";
import { MoreVertical, Users } from "lucide-react";
import { useServerStore } from "@/src/store/serverStore";

/**
 * 📋 ServerHeader - OPTIMIZED Server Dashboard Header
 * Memoized to prevent unnecessary re-renders
 */
const ServerHeader = memo(function ServerHeader({ 
  server, 
  showMenu, 
  onToggleMenu, 
  voiceCount, 
  memberCount 
}) {
  return (
    <div 
      onClick={onToggleMenu}
      onContextMenu={(e) => { e.preventDefault(); onToggleMenu(); }}
      className={`
        relative overflow-hidden
        group flex flex-col justify-between 
        p-4 rounded-3xl cursor-pointer 
        border transition-all duration-300
        ${showMenu 
          ? 'bg-[#1a1b1e] border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.15)]' 
          : 'bg-gradient-to-br from-[#16171a] to-[#111214] border-white/10 hover:border-white/20 hover:shadow-lg'
        }
      `}
    >
      {/* Header Glow */}
      <div className="absolute inset-0 bg-white/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      <div className="flex items-start justify-between relative z-10">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg overflow-hidden">
          {server.iconUrl ? (
            <img 
              src={server.iconUrl} 
              alt={server.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            server.name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              useServerStore.getState().setMobileMemberDrawerOpen(true);
            }}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#949ba4] hover:text-white transition-colors flex items-center gap-1 text-xs"
            title="Üye Listesi"
          >
            <Users size={16} className="text-indigo-400" />
          </button>
          <div className={`p-2 rounded-xl transition-colors ${showMenu ? 'bg-white/10 text-white' : 'text-[#5c5e66] group-hover:text-white'}`}>
            <MoreVertical size={18} />
          </div>
        </div>
      </div>
      
      <div className="mt-3 relative z-10">
        <h1 className="font-bold text-lg text-white tracking-tight truncate">
          {server.name}
        </h1>
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-2">
            <span className="flex w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="text-xs text-[#949ba4] font-medium">
              {voiceCount} Sesli
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              useServerStore.getState().setMobileMemberDrawerOpen(true);
            }}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white/5 hover:bg-indigo-500/20 text-[#949ba4] hover:text-white transition-all text-xs font-semibold"
            title="Üyeleri Gör"
          >
            <Users size={12} className="text-indigo-400" />
            <span>{memberCount} Üye</span>
          </button>
        </div>
      </div>
    </div>
  );
});

export default ServerHeader;
