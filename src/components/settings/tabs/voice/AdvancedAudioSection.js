import { Zap } from "lucide-react";
import { useSettingsStore } from "@/src/store/settingsStore";
import ToggleSwitch from "../../ToggleSwitch";

export default function AdvancedAudioSection() {
  const echoCancellation = useSettingsStore(s => s.echoCancellation);
  const toggleEchoCancellation = useSettingsStore(s => s.toggleEchoCancellation);
  const noiseSuppression = useSettingsStore(s => s.noiseSuppression);
  const toggleNoiseSuppression = useSettingsStore(s => s.toggleNoiseSuppression);
  const autoGainControl = useSettingsStore(s => s.autoGainControl);
  const toggleAutoGainControl = useSettingsStore(s => s.toggleAutoGainControl);

  return (
    <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-4 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
      
      <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-3 flex items-center gap-2 relative z-10">
        <div className="w-6 h-6 rounded-lg bg-orange-500/20 flex items-center justify-center">
          <Zap size={14} className="text-orange-400" />
        </div>
        Gelişmiş Ses İşleme
      </h4>
      
      <div className="relative z-10 space-y-1">
        <div className="bg-[#1e1f22] rounded-xl px-4 py-2.5 border border-white/5 hover:border-cyan-500/20 transition-colors duration-300">
          <ToggleSwitch
            label="Yankı Engelleme"
            description="Sesinin yankılanmasını önler. Kulaklık kullanmıyorsan kesinlikle aç."
            checked={echoCancellation}
            onChange={toggleEchoCancellation}
          />
        </div>
        <div className="bg-[#1e1f22] rounded-xl px-4 py-2.5 border border-white/5 hover:border-indigo-500/20 transition-colors duration-300">
          <ToggleSwitch
            label="Yerleşik Gürültü Bastırma"
            description="Tarayıcının kendi basit gürültü filtresi. Yukarıdaki “Gürültü Azaltma” modu (Krisp) daha güçlüdür; genelde birini kullanmanız yeterli."
            checked={noiseSuppression}
            onChange={toggleNoiseSuppression}
          />
        </div>
        <div className="bg-[#1e1f22] rounded-xl px-4 py-2.5 border border-white/5 hover:border-purple-500/20 transition-colors duration-300">
          <ToggleSwitch
            label="Otomatik Kazanç Kontrolü"
            description="Ses seviyeni otomatik olarak dengeler (Bağırdığında kısar, fısıldadığında açar). Kapatırsan mikrofon seviyesi düşer; Giriş Hassasiyeti çizgisini buna göre sola çekmen gerekir."
            checked={autoGainControl}
            onChange={toggleAutoGainControl}
          />
        </div>
      </div>
    </div>
  );
}
