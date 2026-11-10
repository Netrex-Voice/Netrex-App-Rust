"use client";

/**
 * 📱 MobileServerSelector — Mobil Sunucu Listesi & Seçici
 * Masaüstü ServerRail tasarım diline uygun, modern dikey liste görünümü.
 */

import { Plus, Compass, ChevronRight, Crown, Shield } from "lucide-react";
import { useServerStore } from "@/src/store/serverStore";
import { useAuthStore } from "@/src/store/authStore";

export default function MobileServerSelector({ onSelectServer, onCreateServer, onClose }) {
  const { servers, currentServer } = useServerStore();
  const { user } = useAuthStore();

  const handleSelect = (serverId) => {
    onSelectServer(serverId);
    onClose?.();
  };

  return (
    <div className="flex flex-col h-full bg-[#111214] text-white">
      {/* Sunucu Listesi */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 custom-scrollbar">
        <div className="text-[11px] font-bold text-[#949ba4] uppercase tracking-wider px-2 mb-2">
          Sunucuların ({servers.length})
        </div>

        {servers.map((server) => {
          const isActive = currentServer?.id === server.id;
          const isOwner = server.ownerId === user?.uid;

          return (
            <button
              key={server.id}
              onClick={() => handleSelect(server.id)}
              className={`
                w-full flex items-center gap-3.5 p-2.5 rounded-2xl transition-all duration-200 text-left relative group
                ${isActive 
                  ? "bg-gradient-to-r from-indigo-500/20 via-purple-500/10 to-transparent border border-indigo-500/30 shadow-lg shadow-indigo-500/10" 
                  : "bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.04]"
                }
              `}
            >
              {/* Active Indicator Bar */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-indigo-500 rounded-r-full shadow-[0_0_10px_#6366f1]" />
              )}

              {/* Server Icon */}
              <div className={`
                w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-base flex-shrink-0 relative overflow-hidden transition-transform duration-200 group-active:scale-95
                ${isActive 
                  ? "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-md shadow-indigo-500/30 ring-2 ring-indigo-400/50" 
                  : "bg-[#25272a] text-[#dbdee1] border border-white/10"
                }
              `}>
                {server.iconUrl ? (
                  <img
                    src={server.iconUrl}
                    alt={server.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>
                    {server.name?.charAt(0)?.toUpperCase() || "S"}
                  </span>
                )}
              </div>

              {/* Server Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold truncate ${isActive ? "text-white" : "text-[#dbdee1]"}`}>
                    {server.name}
                  </span>
                  {isOwner && (
                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 text-[10px] font-bold flex-shrink-0">
                      <Crown size={10} />
                      Sahip
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-[#949ba4] mt-0.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                  <span>{isActive ? "Şu anki sunucu" : "Giriş yap"}</span>
                </div>
              </div>

              <ChevronRight size={18} className={`flex-shrink-0 transition-transform ${isActive ? "text-indigo-400" : "text-[#5c6370]"}`} />
            </button>
          );
        })}

        {servers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-3 text-indigo-400">
              <Compass size={28} />
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">Sunucu Bulunamadı</h3>
            <p className="text-xs text-[#949ba4] max-w-[200px]">
              Aşağıdaki butonla hemen yeni bir sunucu oluştur.
            </p>
          </div>
        )}
      </div>

      {/* Alt Buton: Sunucu Ekle */}
      <div className="p-3 border-t border-white/[0.06] bg-black/30">
        <button
          onClick={() => {
            onCreateServer?.();
            onClose?.();
          }}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-semibold shadow-lg shadow-emerald-900/30 active:scale-[0.98] transition-all"
        >
          <Plus size={18} />
          <span>Yeni Sunucu Oluştur veya Katıl</span>
        </button>
      </div>
    </div>
  );
}
