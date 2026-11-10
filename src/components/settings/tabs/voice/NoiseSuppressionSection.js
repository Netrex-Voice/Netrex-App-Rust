import { Zap } from "lucide-react";
import { useSettingsStore } from "@/src/store/settingsStore";

export default function NoiseSuppressionSection() {
  const noiseSuppressionMode = useSettingsStore(s => s.noiseSuppressionMode);
  const setNoiseSuppressionMode = useSettingsStore(s => s.setNoiseSuppressionMode);

  return (
    <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-4 mb-4 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
      
      <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-2 flex items-center gap-2 relative z-10">
        <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center">
          <Zap size={14} className="text-purple-400" />
        </div>
        Gürültü Azaltma
      </h4>
      <p className="text-xs text-[#949ba4] mb-4 ml-8 relative z-10">
        Klavye, fan ve arka plan konuşmalarını bastırır. Krisp en etkilisidir (yapay zekâ kullanır, biraz daha fazla işlemci harcar), Standart hafiftir, Yok seçilirse mikrofon sesi olduğu gibi gider.
      </p>

      <div className="relative z-10 grid grid-cols-3 gap-2">
        {/* Yok */}
        <label className={`flex flex-col items-center justify-center p-4 rounded-xl cursor-pointer transition-all duration-300 border-2 ${
          noiseSuppressionMode === "none"
            ? "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
            : "bg-[#1e1f22] border-white/10 hover:border-white/20 hover:bg-white/5"
        }`}>
          <input
            type="radio"
            name="noiseSuppressionMode"
            value="none"
            checked={noiseSuppressionMode === "none"}
            onChange={(e) => setNoiseSuppressionMode(e.target.value)}
            className="sr-only"
          />
          <div className={`w-6 h-6 rounded-full border-2 mb-2 flex items-center justify-center transition-all ${
            noiseSuppressionMode === "none"
              ? "border-indigo-500 bg-indigo-500"
              : "border-[#80848e]"
          }`}>
            {noiseSuppressionMode === "none" && (
              <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
            )}
          </div>
          <span className="text-sm text-white font-medium">Yok</span>
          <span className="text-[10px] text-[#949ba4] mt-1">Filtre yok</span>
        </label>

        {/* Standart */}
        <label className={`flex flex-col items-center justify-center p-4 rounded-xl cursor-pointer transition-all duration-300 border-2 ${
          noiseSuppressionMode === "standard"
            ? "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
            : "bg-[#1e1f22] border-white/10 hover:border-white/20 hover:bg-white/5"
        }`}>
          <input
            type="radio"
            name="noiseSuppressionMode"
            value="standard"
            checked={noiseSuppressionMode === "standard"}
            onChange={(e) => setNoiseSuppressionMode(e.target.value)}
            className="sr-only"
          />
          <div className={`w-6 h-6 rounded-full border-2 mb-2 flex items-center justify-center transition-all ${
            noiseSuppressionMode === "standard"
              ? "border-indigo-500 bg-indigo-500"
              : "border-[#80848e]"
          }`}>
            {noiseSuppressionMode === "standard" && (
              <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
            )}
          </div>
          <span className="text-sm text-white font-medium">Standart</span>
          <span className="text-[10px] text-[#949ba4] mt-1">Hafif filtre</span>
        </label>

        {/* Krisp (RNNoise) */}
        <label className={`flex flex-col items-center justify-center p-4 rounded-xl cursor-pointer transition-all duration-300 border-2 relative ${
          noiseSuppressionMode === "krisp"
            ? "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
            : "bg-[#1e1f22] border-white/10 hover:border-white/20 hover:bg-white/5"
        }`}>
          <span className="absolute -top-1 -right-1 text-[8px] px-1.5 py-0.5 rounded font-bold bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
            AI
          </span>
          <input
            type="radio"
            name="noiseSuppressionMode"
            value="krisp"
            checked={noiseSuppressionMode === "krisp"}
            onChange={(e) => setNoiseSuppressionMode(e.target.value)}
            className="sr-only"
          />
          <div className={`w-6 h-6 rounded-full border-2 mb-2 flex items-center justify-center transition-all ${
            noiseSuppressionMode === "krisp"
              ? "border-indigo-500 bg-indigo-500"
              : "border-[#80848e]"
          }`}>
            {noiseSuppressionMode === "krisp" && (
              <div className="w-2.5 h-2.5 rounded-full bg-white"></div>
            )}
          </div>
          <span className="text-sm text-white font-medium">Krisp</span>
          <span className="text-[10px] text-[#949ba4] mt-1">Yapay zekâ</span>
        </label>
      </div>
    </div>
  );
}
