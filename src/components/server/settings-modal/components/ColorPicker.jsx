import React, { useRef } from 'react';
import { Plus } from "lucide-react";
import Input from "@/src/components/ui/Input";

const ROLE_COLOR_PRESETS = [
  "#6366f1", "#8b5cf6", "#d946ef", "#f43f5e", "#f59e0b", "#10b981", "#06b6d4", "#3b82f6", "#94a3b8", "#1e1f22", "#2b2d31", "#ffffff"
];

const BADGE_COLOR_PRESETS = [
  "#f59e0b", "#ef4444", "#22c55e", "#06b6d4", "#6366f1", "#8b5cf6", "#ec4899", "#f97316", "#14b8a6", "#3b82f6"
];

export function ColorPicker({ value, onChange, presets = ROLE_COLOR_PRESETS }) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {presets.map((preset, idx) => {
        const isGradient = preset.includes("gradient");
        const isActive = value === preset;
        
        return (
          <button
            key={idx}
            onClick={() => onChange(preset)}
            className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 active:scale-90 ${isActive ? 'border-white scale-110 shadow-[0_0_10px_rgba(255,255,255,0.3)]' : 'border-transparent opacity-80 hover:opacity-100'}`}
            style={{ 
              background: preset,
            }}
            title={isGradient ? "Gradient Renk" : preset}
          />
        );
      })}
    </div>
  );
}

export function PremiumColorInput({ value, onChange }) {
  const inputRef = useRef(null);
  
  return (
    <div className="flex items-center gap-3">
      {/* Visual Color Box */}
      <button 
        onClick={() => inputRef.current?.click()}
        className="w-12 h-12 rounded-xl border border-white/20 shadow-lg group relative overflow-hidden transition-transform hover:scale-105 active:scale-95 flex-shrink-0"
        style={{ background: value }}
        title="Renk Seç"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity scale-75 group-hover:scale-100 duration-300">
           <Plus size={16} className="text-white drop-shadow-md" />
        </div>
        {/* Hidden Native Input */}
        <input 
          ref={inputRef}
          type="color" 
          value={value?.startsWith('linear') ? '#6366f1' : value} 
          onChange={(e) => onChange(e.target.value)} 
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
      </button>

      {/* Hex Input */}
      <div className="flex-1 relative group">
        <Input 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="pl-9 font-mono tracking-wider"
          placeholder="#000000"
        />
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-nds-text-muted font-mono text-sm group-focus-within:text-nds-accent-primary transition-colors">
          #
        </div>
      </div>
    </div>
  );
}

export { ROLE_COLOR_PRESETS, BADGE_COLOR_PRESETS };
