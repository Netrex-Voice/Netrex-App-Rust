import { Palette, Zap, Sparkles, Layers, BarChart2, Trash2, Cpu as CpuIcon } from "lucide-react";
import ToggleSwitch from "../ToggleSwitch";
import { useSettingsStore } from "@/src/store/settingsStore";

export default function PerformanceSettings() {
  const hardwareAcceleration = useSettingsStore(state => state.hardwareAcceleration);
  const setHardwareAcceleration = useSettingsStore(state => state.setHardwareAcceleration);
  const graphicsQuality = useSettingsStore(state => state.graphicsQuality);
  const setGraphicsQuality = useSettingsStore(state => state.setGraphicsQuality);
  const disableAnimations = useSettingsStore(state => state.disableAnimations);
  const toggleDisableAnimations = useSettingsStore(state => state.toggleDisableAnimations);
  const disableBackgroundEffects = useSettingsStore(state => state.disableBackgroundEffects);
  const toggleDisableBackgroundEffects = useSettingsStore(state => state.toggleDisableBackgroundEffects);
  const dataSaver = useSettingsStore(state => state.dataSaver);
  const toggleDataSaver = useSettingsStore(state => state.toggleDataSaver);
  const latencyMode = useSettingsStore(state => state.latencyMode ?? "low");
  const setLatencyMode = useSettingsStore(state => state.setLatencyMode);

  const LATENCY_MODES = [
    { id: "normal", label: "Normal", desc: "Tarayıcı varsayılanı. En kararlı, biraz daha gecikmeli." },
    { id: "low", label: "Düşük", desc: "Önerilen. Alıcı tamponu küçülür; ağ takılırsa otomatik geri açılır." },
    { id: "ultra", label: "Ultra", desc: "Olabildiğince az gecikme. Zayıf ağda ses daha çok kırılabilir; koruma devreye girer." },
  ];

  const QUALITY_EFFECTS = {
    ultra: "Animasyonlar, arka plan ışıkları ve GPU hızlandırma açık. En zengin görünüm.",
    high: "Animasyonlar, arka plan ışıkları ve GPU hızlandırma açık.",
    medium: "Arka plan ışıkları kapalı. Animasyonlar ve GPU hızlandırma açık.",
    low: "Arka plan ışıkları kapalı, katılımcı listesindeki animasyonlar sadeleşir. GPU hızlandırma açık.",
    potato: "Animasyonlar, arka plan ışıkları ve GPU hızlandırma kapalı. En düşük kaynak kullanımı.",
  };

  const QUALITY_MODES = [
    { 
      id: "ultra", 
      label: "Ultra", 
      desc: "En zengin", 
      icon: Sparkles,
      color: "purple",
      activeBorder: "border-purple-500",
      activeBg: "bg-purple-500/10",
      activeText: "text-purple-400",
      activeShadow: "shadow-[0_0_15px_rgba(168,85,247,0.15)]",
      dotColor: "bg-purple-500"
    },
    { 
      id: "high", 
      label: "Yüksek", 
      desc: "Tüm efektler", 
      icon: Zap,
      color: "green",
      activeBorder: "border-green-500",
      activeBg: "bg-green-500/10",
      activeText: "text-green-400",
      activeShadow: "shadow-[0_0_15px_rgba(34,197,94,0.15)]",
      dotColor: "bg-green-500"
    },
    { 
      id: "medium", 
      label: "Orta", 
      desc: "Sade arka plan", 
      icon: Layers,
      color: "blue",
      activeBorder: "border-blue-500",
      activeBg: "bg-blue-500/10",
      activeText: "text-blue-400",
      activeShadow: "shadow-[0_0_15px_rgba(59,130,246,0.15)]",
      dotColor: "bg-blue-500"
    },
    { 
      id: "low", 
      label: "Düşük", 
      desc: "Sade (varsayılan)", 
      icon: BarChart2,
      color: "yellow",
      activeBorder: "border-yellow-500",
      activeBg: "bg-yellow-500/10",
      activeText: "text-yellow-400",
      activeShadow: "shadow-[0_0_15px_rgba(234,179,8,0.15)]",
      dotColor: "bg-yellow-500"
    },
    { 
      id: "potato", 
      label: "Patates", 
      desc: "En hafif", 
      icon: Trash2,
      color: "red",
      activeBorder: "border-red-500",
      activeBg: "bg-red-500/10",
      activeText: "text-red-400",
      activeShadow: "shadow-[0_0_15px_rgba(239,68,68,0.15)]",
      dotColor: "bg-red-500"
    },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
      <h3 className="text-xl font-bold text-white mb-3 relative">
        <span className="relative z-10">Performans Ayarları</span>
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-500/20 opacity-0 hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
      </h3>

      {/* Header Banner */}
      <div className="glass-strong rounded-2xl overflow-hidden border border-white/20 shadow-soft-lg hover:shadow-xl transition-all duration-300 mb-4 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-emerald-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 z-10 pointer-events-none"></div>

        <div className="h-16 w-full bg-gradient-to-r from-green-600 via-emerald-600 to-green-600 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/30"></div>
          <div className="absolute inset-0 flex items-center px-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
                <CpuIcon size={24} className="text-white" />
              </div>
              <div>
                <h4 className="text-white font-bold text-lg">Performans ve Kalite</h4>
                <p className="text-white/70 text-sm">
                  Uygulamanın kaynak kullanımını ve görsel kalitesini yönetin
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Görsel Kalite Presetleri */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-4 mb-3 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-emerald-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>

        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-3 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <Palette size={14} className="text-emerald-400" />
          </div>
          Görsel Kalite Modu
        </h4>
        
        <div className="relative z-10">
          <p className="text-xs text-[#949ba4] mb-4">
            Bilgisayarınız yavaşlıyorsa daha düşük bir mod seçin. Mod seçmek, aşağıdaki Manuel Optimizasyon ayarlarını da o moda göre sıfırlar.
          </p>
          <p className="text-xs text-white/80 mb-4 px-3 py-2 rounded-lg bg-white/5 border border-white/5">Seçili mod: {QUALITY_EFFECTS[graphicsQuality] || QUALITY_EFFECTS.low}</p>
          
          <div className="grid grid-cols-5 gap-2">
            {QUALITY_MODES.map((mode) => {
              const Icon = mode.icon;
              const isActive = graphicsQuality === mode.id;
              
              return (
                <button
                  key={mode.id}
                  onClick={() => setGraphicsQuality(mode.id)}
                  className={`p-3 rounded-xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-2 focus:outline-none relative group/opt h-full ${
                    isActive
                      ? `${mode.activeBorder} ${mode.activeBg} ${mode.activeShadow} text-white`
                      : "border-white/5 bg-[#1e1f22] text-[#949ba4] hover:border-white/20 hover:bg-[#2b2d31]"
                  }`}
                >
                  <div className={`p-1.5 rounded-lg transition-all duration-300 ${isActive ? mode.activeText : 'text-[#80848e] group-hover/opt:text-white'}`}>
                    <Icon size={18} />
                  </div>
                  
                  <div className="text-center">
                    <span className={`block font-bold text-xs mb-0.5 transition-colors duration-300 ${isActive ? mode.activeText : "text-white"}`}>
                      {mode.label}
                    </span>
                    <p className="text-[9px] opacity-70 leading-tight">
                      {mode.desc}
                    </p>
                  </div>

                  {isActive && (
                    <div className="absolute top-1.5 right-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${mode.dotColor} animate-pulse shadow-[0_0_5px_rgba(255,255,255,0.5)]`}></div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detaylı Performans Ayarları */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-4 mb-3 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-emerald-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>

        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-3 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-green-500/20 flex items-center justify-center">
            <Zap size={14} className="text-green-400" />
          </div>
          Manuel Optimizasyon
        </h4>
        <div className="relative z-10 bg-[#1e1f22] rounded-xl px-4 py-2.5 border border-white/5 hover:border-green-500/20 transition-colors duration-300 space-y-4">
          <ToggleSwitch
            label="Donanım Hızlandırma"
            description="Mümkün olan yerlerde GPU kullanır. Kapatırsanız tüm yük işlemciye (CPU) biner."
            checked={hardwareAcceleration}
            onChange={() => setHardwareAcceleration(!hardwareAcceleration)}
          />

          <div className="h-px bg-white/5 my-2"></div>

          <ToggleSwitch
            label="Animasyonları Kapat"
            description="Geçiş efektlerini ve animasyonları kapatarak CPU kullanımını düşürür."
            checked={disableAnimations}
            onChange={toggleDisableAnimations}
          />
          
          <ToggleSwitch
            label="Arka Plan Efektlerini Kapat"
            description="Hareketli arka plan ışıklarını (orbs) kapatarak GPU kullanımını düşürür."
            checked={disableBackgroundEffects}
            onChange={toggleDisableBackgroundEffects}
          />
        </div>
      </div>

      {/* Ağ ve Veri Kullanımı */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-4 mb-3 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-emerald-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>

        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-3 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-cyan-500/20 flex items-center justify-center">
            <Zap size={14} className="text-cyan-400" />
          </div>
          Ağ ve Veri Kullanımı
        </h4>
        <p className="text-xs text-[#949ba4] mb-3 relative z-10">
          Bağlantın zayıfladığında yayın ve kamera kalitesi otomatik olarak düşürülür, konuşman her zaman öncelikli kalır.
        </p>
        <div className="relative z-10 bg-[#1e1f22] rounded-xl px-4 py-2.5 border border-white/5 hover:border-cyan-500/20 transition-colors duration-300">
          <ToggleSwitch
            label="Veri Tasarrufu"
            description="Bağlantın iyi olsa bile ekran paylaşımı ve kameranın gönderdiği veriyi kısar (bit hızı yarıya, en fazla 20 FPS). Mobil internet veya sınırlı kotada işe yarar. Ses kalitesi etkilenmez."
            checked={dataSaver}
            onChange={toggleDataSaver}
          />
        </div>

        <div className="relative z-10 mt-4">
          <p className="text-xs font-bold text-white mb-1">Konuşma Gecikmesi</p>
          <p className="text-xs text-[#949ba4] mb-3">
            Karşındakinin sesinin sana ne kadar hızlı ulaşacağını belirler. Gerçek gecikme ağına ve ses cihazına da bağlıdır
            (Bluetooth kulaklık yüzlerce ms ekler). Canlı değeri, odadaki bağlantı kalitesi göstergesinin üzerine gelince görebilirsin.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {LATENCY_MODES.map((m) => {
              const active = latencyMode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setLatencyMode(m.id)}
                  className={`p-3 rounded-xl border-2 text-left transition-all duration-300 focus:outline-none ${
                    active
                      ? "border-cyan-500 bg-cyan-500/10 text-white"
                      : "border-white/5 bg-[#1e1f22] text-[#949ba4] hover:border-white/20 hover:bg-[#2b2d31]"
                  }`}
                >
                  <span className={`block font-bold text-xs mb-1 ${active ? "text-cyan-400" : "text-white"}`}>{m.label}</span>
                  <span className="block text-[10px] opacity-70 leading-tight">{m.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
