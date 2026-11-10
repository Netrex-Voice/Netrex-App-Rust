"use client";

import { useSettingsStore } from "@/src/store/settingsStore";
import { Clock, Check, Settings2 } from "lucide-react";

export default function QuickStatusManager() {
  // ✅ Selector kullanımı - destructure yok
  const quickStatus = useSettingsStore(s => s.quickStatus);
  const presets = useSettingsStore(s => s.quickStatusPresets) || [];
  const setQuickStatus = useSettingsStore(s => s.setQuickStatus);
  const setLastQuickStatus = useSettingsStore(s => s.setLastQuickStatus);

  const handleSetStatus = (preset) => {
    if (!preset) return;
    if (quickStatus?.label === preset.label) {
      setQuickStatus(null);
    } else {
      setQuickStatus(preset);
      setLastQuickStatus(preset);
    }
  };

  return (
    <div className="flex flex-col gap-3 py-1">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-indigo-400" />
          <span className="text-[10px] font-bold text-[#949ba4] uppercase tracking-wider">Hızlı Durum</span>
        </div>
        <div className="flex items-center gap-1 bg-[#1a1b1e] px-1.5 py-0.5 rounded-lg border border-white/5">
            <Settings2 size={10} className="text-[#5c5e66]" />
            <span className="text-[8px] text-[#5c5e66] font-bold uppercase">Ayarlanabilir</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 px-1 relative z-10">
        {presets.map((preset) => {
          if (!preset) return null;
          const displayLabel = preset.label ? preset.label.split(' ')[0] : "...";
          const isActive = quickStatus?.label === preset.label;
          
          return (
            <button
              key={preset.id || Math.random()}
              onClick={() => handleSetStatus(preset)}
              className={`
                relative group/icon-btn
                flex flex-col items-center justify-center 
                aspect-square rounded-2xl
                transition-colors duration-150 border
                ${isActive
                  ? "bg-indigo-500/10 border-indigo-500/40"
                  : "bg-[#1a1b1e] border-white/5 hover:border-white/10 hover:bg-[#202225]"
                }
              `}
            >
              <span className={`text-2xl mb-1 transition-transform duration-150 ${!isActive && "group-hover/icon-btn:scale-110"}`}>
                  {preset.icon || "💬"}
              </span>
              <span className={`text-[8px] font-bold uppercase truncate w-full px-1 text-center transition-colors duration-150 ${!isActive ? "text-[#949ba4] group-hover/icon-btn:text-white" : "text-white"}`}>
                  {displayLabel}
              </span>
              
              {isActive && (
                <div className="absolute -top-1 -right-1 bg-indigo-500 rounded-full p-0.5 border-2 border-[#0d0e10]">
                  <Check size={8} className="text-white" strokeWidth={4} />
                </div>
              )}

              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-[#111214] text-[10px] font-bold text-white rounded-lg border border-white/10 opacity-0 group-hover/icon-btn:opacity-100 transition-opacity duration-150 whitespace-nowrap z-[100] pointer-events-none shadow-lg">
                {preset.label || "Durum"}
                <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-[#111214] border-b border-r border-white/10 rotate-45"></div>
              </div>
            </button>
          );
        })}
      </div>

      {quickStatus ? (
        <div className="mx-1 mt-1 p-2.5 rounded-xl bg-[#1a1b1e] border border-indigo-500/20 flex items-center justify-between group/active">
            <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-lg">
                    {quickStatus.icon || "💬"}
                </div>
                <div className="flex flex-col overflow-hidden">
                    <span className="text-[9px] text-indigo-400 font-black uppercase tracking-wider mb-0.5">AKTİF</span>
                    <span className="text-xs text-white font-bold truncate leading-none pb-0.5">{quickStatus.label || "Durum"}</span>
                </div>
            </div>
            <button 
                onClick={() => setQuickStatus(null)}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#2b2d31] text-[#949ba4] hover:bg-red-500 hover:text-white transition-colors shrink-0"
                title="Durumu Temizle"
            >
                <span className="text-[10px] font-black">X</span>
            </button>
        </div>
      ) : (
        <div className="mx-1 p-3 rounded-xl bg-[#1a1b1e] border border-dashed border-white/10 flex flex-col items-center justify-center gap-1 opacity-50">
            <span className="text-[10px] text-[#5c5e66] font-bold uppercase">Durum Seçilmedi</span>
        </div>
      )}
    </div>
  );
}