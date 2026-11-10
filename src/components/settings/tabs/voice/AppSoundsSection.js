import { useState, useEffect } from "react";
import { Volume2 } from "lucide-react";
import { useSettingsStore } from "@/src/store/settingsStore";
import { useSoundEffects } from "@/src/hooks/useSoundEffects";

export default function AppSoundsSection() {
  const sfxVolume = useSettingsStore(s => s.sfxVolume);
  const setSfxVolume = useSettingsStore(s => s.setSfxVolume);
  const { playSound } = useSoundEffects();

  const [localSfxVolume, setLocalSfxVolume] = useState(sfxVolume);

  useEffect(() => {
    setLocalSfxVolume(sfxVolume);
  }, [sfxVolume]);

  return (
    <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-4 mb-4 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
      
      <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-3 flex items-center gap-2 relative z-10">
        <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center">
          <Volume2 size={14} className="text-indigo-400" />
        </div>
        Uygulama Sesleri
        <span className="ml-auto text-xs text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-lg">
          %{localSfxVolume}
        </span>
      </h4>
      
      <div className="relative z-10 bg-[#1e1f22] rounded-xl px-4 py-2.5 border border-white/5">
        <div className="relative w-full h-10 flex items-center select-none">
          <div className="absolute w-full h-3 bg-[#2b2d31] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-75 rounded-full"
              style={{ width: `${localSfxVolume}%` }}
            ></div>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={localSfxVolume}
            onChange={(e) => setLocalSfxVolume(parseInt(e.target.value))}
            onMouseUp={() => {
              setSfxVolume(localSfxVolume);
              playSound("join");
            }}
            onTouchEnd={() => {
              setSfxVolume(localSfxVolume);
              playSound("join");
            }}
            className="w-full absolute z-20 opacity-0 cursor-pointer h-full"
          />
          <div
            className="absolute h-5 w-5 bg-white rounded-full shadow-lg pointer-events-none transition-all z-30 border-2 border-indigo-500"
            style={{
              left: `${localSfxVolume}%`,
              transform: "translateX(-50%)",
            }}
          ></div>
        </div>
        <p className="text-xs text-[#949ba4] mt-3">
          Giriş, çıkış, mute ve diğer bildirim seslerinin yüksekliği.
        </p>
      </div>
    </div>
  );
}
