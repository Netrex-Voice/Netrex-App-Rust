import { useState, useEffect } from "react";
import { Layers, Monitor, Eye, Sliders, Shield, MousePointer, Volume2, LogOut, Mic } from "lucide-react";
import ToggleSwitch from "../ToggleSwitch";
import { useOverlayStore } from "@/src/store/overlayStore";
import TickerSettingsCard from "./TickerSettingsCard";

export default function OverlaySettings() {
  const overlayEnabled = useOverlayStore(state => state.overlayEnabled);
  const setOverlayEnabled = useOverlayStore(state => state.setOverlayEnabled);
  const overlayWarningShown = useOverlayStore(state => state.overlayWarningShown);
  const setOverlayWarningShown = useOverlayStore(state => state.setOverlayWarningShown);

  const visibilityMode = useOverlayStore(state => state.visibilityMode);
  const setVisibilityMode = useOverlayStore(state => state.setVisibilityMode);

  const position = useOverlayStore(state => state.position);
  const setPosition = useOverlayStore(state => state.setPosition);
  const size = useOverlayStore(state => state.size);
  const setSize = useOverlayStore(state => state.setSize);
  const opacity = useOverlayStore(state => state.opacity);
  const setOpacity = useOverlayStore(state => state.setOpacity);
  const fullOpacityOnHover = useOverlayStore(state => state.fullOpacityOnHover);
  const setFullOpacityOnHover = useOverlayStore(state => state.setFullOpacityOnHover);
  const maxVisibleUsers = useOverlayStore(state => state.maxVisibleUsers);
  const setMaxVisibleUsers = useOverlayStore(state => state.setMaxVisibleUsers);

  const showChannelName = useOverlayStore(state => state.showChannelName);
  const setShowChannelName = useOverlayStore(state => state.setShowChannelName);
  const showServerName = useOverlayStore(state => state.showServerName);
  const setShowServerName = useOverlayStore(state => state.setShowServerName);
  const showSilentUsers = useOverlayStore(state => state.showSilentUsers);
  const setShowSilentUsers = useOverlayStore(state => state.setShowSilentUsers);
  const showConnectionQuality = useOverlayStore(state => state.showConnectionQuality);
  const setShowConnectionQuality = useOverlayStore(state => state.setShowConnectionQuality);
  const showSelf = useOverlayStore(state => state.showSelf);
  const setShowSelf = useOverlayStore(state => state.setShowSelf);
  const showOnlySpeaking = useOverlayStore(state => state.showOnlySpeaking);
  const setShowOnlySpeaking = useOverlayStore(state => state.setShowOnlySpeaking);

  const controlMute = useOverlayStore(state => state.controlMute);
  const setControlMute = useOverlayStore(state => state.setControlMute);
  const controlDeafen = useOverlayStore(state => state.controlDeafen);
  const setControlDeafen = useOverlayStore(state => state.setControlDeafen);
  const controlLeave = useOverlayStore(state => state.controlLeave);
  const setControlLeave = useOverlayStore(state => state.setControlLeave);
  const controlVolume = useOverlayStore(state => state.controlVolume);
  const setControlVolume = useOverlayStore(state => state.setControlVolume);

  const antiCheatProtection = useOverlayStore(state => state.antiCheatProtection);
  const setAntiCheatProtection = useOverlayStore(state => state.setAntiCheatProtection);

  // Warning modal state
  const [showWarning, setShowWarning] = useState(false);

  const handleEnableOverlay = (newEnabled) => {
    if (newEnabled && !overlayWarningShown) {
      setShowWarning(true);
      return;
    }
    setOverlayEnabled(newEnabled);
    
    // Send to Electron
    if (window.netrex?.setVoiceOverlayEnabled) {
      const settings = useOverlayStore.getState();
      window.netrex.setVoiceOverlayEnabled(newEnabled, {
        position: settings.position,
        customPosition: settings.customPosition,
        size: settings.size,
        opacity: settings.opacity,
        fullOpacityOnHover: settings.fullOpacityOnHover,
        controlMute: settings.controlMute,
        controlDeafen: settings.controlDeafen,
        controlLeave: settings.controlLeave,
        antiCheatProtection: settings.antiCheatProtection,
      });
    }
  };

  const acceptWarning = () => {
    setOverlayWarningShown(true);
    setShowWarning(false);
    setOverlayEnabled(true);
    
    if (window.netrex?.setVoiceOverlayEnabled) {
      const settings = useOverlayStore.getState();
      window.netrex.setVoiceOverlayEnabled(true, {
        position: settings.position,
        customPosition: settings.customPosition,
        size: settings.size,
        opacity: settings.opacity,
        fullOpacityOnHover: settings.fullOpacityOnHover,
        controlMute: settings.controlMute,
        controlDeafen: settings.controlDeafen,
        controlLeave: settings.controlLeave,
        antiCheatProtection: settings.antiCheatProtection,
      });
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
      <h3 className="text-xl font-bold text-white mb-3 relative">
        <span className="relative z-10">Oyun İçi Overlay</span>
      </h3>

      {/* Header Banner */}
      <div className="glass-strong rounded-2xl overflow-hidden border border-white/20 shadow-soft-lg hover:shadow-xl transition-all duration-300 mb-4 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 z-10 pointer-events-none"></div>

        <div className="h-16 w-full bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,255,255,0.1)_0%,transparent_50%)]"></div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/30"></div>
          <div className="absolute inset-0 flex items-center px-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
                <Layers size={24} className="text-white" />
              </div>
              <div>
                <h4 className="text-white font-bold text-lg">Oyun İçi Overlay</h4>
                <p className="text-white/70 text-sm">Oyun oynarken sesli sohbeti takip edin</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Kayan mesajlar: ses overlay'inden bağımsız çalışır */}
      <TickerSettingsCard />

      {/* Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 bg-black/60 z-[99999] flex items-center justify-center backdrop-blur-md animate-in fade-in duration-200">
          <div className="glass-strong border border-white/20 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Shield size={20} className="text-amber-400" />
              </div>
              <h4 className="text-white font-bold text-lg">Overlay Uyarısı</h4>
            </div>

            <div className="space-y-3 text-sm text-[#949ba4] mb-6">
              <p>• Overlay, oyun üzerinde şeffaf bir pencere olarak görünür.</p>
              <p>• <span className="text-amber-400 font-semibold">Bazı oyunlarda çalışmayabilir</span> (özellikle exclusive fullscreen modda).</p>
              <p>• Anti-cheat korumalı oyunlarda <span className="text-green-400 font-semibold">otomatik kapanma</span> aktiftir.</p>
              <p>• Overlay hiçbir zaman oyun dosyalarına müdahale etmez.</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowWarning(false)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 font-medium hover:bg-white/10 transition-all duration-200"
              >
                İptal
              </button>
              <button
                onClick={acceptWarning}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all duration-200"
              >
                Anladım, Etkinleştir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ana Toggle */}
      <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-4 mb-3 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>

        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-3 flex items-center gap-2 relative z-10">
          <div className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <Monitor size={14} className="text-amber-400" />
          </div>
          Genel
        </h4>
        <div className="relative z-10 bg-[#1e1f22] rounded-xl px-4 py-2.5 border border-white/5 hover:border-amber-500/20 transition-colors duration-300 space-y-4">
          <ToggleSwitch
            label="Overlay Aktif"
            description="Oyun oynarken sesli kanalın durumunu gösteren şeffaf pencereyi etkinleştirir."
            checked={overlayEnabled}
            onChange={() => handleEnableOverlay(!overlayEnabled)}
          />

          {overlayEnabled && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="h-px bg-white/5 my-2"></div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-col flex-1 pl-1">
                  <span className="font-semibold text-white/90">Görünürlük Tetikleyicisi</span>
                  <span className="text-xs text-[#949ba4] mt-1 leading-snug">
                    Overlay&apos;in ne zaman görüneceğini belirleyin.
                  </span>
                </div>
                <div className="sm:w-[220px]">
                  <select
                    value={visibilityMode}
                    onChange={(e) => setVisibilityMode(e.target.value)}
                    className="w-full bg-[#111214] border border-white/10 text-white p-2.5 rounded-xl text-sm font-medium hover:border-amber-500/50 focus:border-amber-500/50 outline-none appearance-none cursor-pointer transition-all duration-300"
                  >
                    <option value="always">Her zaman göster</option>
                    <option value="speaking">Sadece birisi konuşunca</option>
                    <option value="active">Sesli kanalda aktifken</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Görünüm Ayarları */}
      {overlayEnabled && (
        <>
          <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-4 mb-3 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>

            <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-3 flex items-center gap-2 relative z-10">
              <div className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <Eye size={14} className="text-violet-400" />
              </div>
              Görünüm
            </h4>
            <div className="relative z-10 bg-[#1e1f22] rounded-xl px-4 py-2.5 border border-white/5 hover:border-violet-500/20 transition-colors duration-300 space-y-5">
              {/* Pozisyon */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-col flex-1 pl-1">
                  <span className="font-semibold text-white/90">Pozisyon</span>
                  <span className="text-xs text-[#949ba4] mt-1">Overlay&apos;in ekrandaki konumu</span>
                </div>
                <div className="sm:w-[220px]">
                  <select
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full bg-[#111214] border border-white/10 text-white p-2.5 rounded-xl text-sm font-medium hover:border-violet-500/50 focus:border-violet-500/50 outline-none appearance-none cursor-pointer transition-all duration-300"
                  >
                    <option value="top-right">Sağ Üst (Varsayılan)</option>
                    <option value="top-left">Sol Üst</option>
                    <option value="bottom-right">Sağ Alt</option>
                    <option value="bottom-left">Sol Alt</option>
                    {position === "custom" && <option value="custom">Özel Konum</option>}
                  </select>
                </div>
              </div>

              {/* Boyut */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex flex-col flex-1 pl-1">
                  <span className="font-semibold text-white/90">Boyut</span>
                  <span className="text-xs text-[#949ba4] mt-1">Overlay pencere boyutu</span>
                </div>
                <div className="sm:w-[220px]">
                  <select
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    className="w-full bg-[#111214] border border-white/10 text-white p-2.5 rounded-xl text-sm font-medium hover:border-violet-500/50 focus:border-violet-500/50 outline-none appearance-none cursor-pointer transition-all duration-300"
                  >
                    <option value="small">Küçük</option>
                    <option value="medium">Orta</option>
                    <option value="large">Büyük</option>
                  </select>
                </div>
              </div>

              {/* Opaklık */}
              <div className="pl-1">
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <span className="font-semibold text-white/90">Opaklık</span>
                    <span className="text-xs text-[#949ba4] block mt-1">Overlay şeffaflık seviyesi</span>
                  </div>
                  <span className="font-bold text-violet-400">%{Math.round(opacity * 100)}</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={Math.round(opacity * 100)}
                  onChange={(e) => setOpacity(parseInt(e.target.value) / 100)}
                  className="w-full h-2 bg-black/40 rounded-lg appearance-none cursor-pointer accent-violet-500"
                />
              </div>

              <ToggleSwitch
                label="Hover'da Tam Opak"
                description="Fare overlay üzerine geldiğinde tamamen görünür hale gelir."
                checked={fullOpacityOnHover}
                onChange={() => setFullOpacityOnHover(!fullOpacityOnHover)}
              />

              {/* Maks kullanıcı sayısı */}
              <div className="pl-1">
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <span className="font-semibold text-white/90">Maksimum Kullanıcı</span>
                    <span className="text-xs text-[#949ba4] block mt-1">Aynı anda gösterilecek kullanıcı sayısı</span>
                  </div>
                  <span className="font-bold text-violet-400">{maxVisibleUsers}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={maxVisibleUsers}
                  onChange={(e) => setMaxVisibleUsers(parseInt(e.target.value))}
                  className="w-full h-2 bg-black/40 rounded-lg appearance-none cursor-pointer accent-violet-500"
                />
              </div>
            </div>
          </div>

          {/* İçerik Ayarları */}
          <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-4 mb-3 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: "50ms" }}>
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-teal-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>

            <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-3 flex items-center gap-2 relative z-10">
              <div className="w-6 h-6 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                <Sliders size={14} className="text-cyan-400" />
              </div>
              İçerik
            </h4>
            <div className="relative z-10 bg-[#1e1f22] rounded-xl px-4 py-2.5 border border-white/5 hover:border-cyan-500/20 transition-colors duration-300 space-y-3">
              <ToggleSwitch
                label="Kanal Adı"
                description="Bağlı olduğunuz kanalın adını gösterir."
                checked={showChannelName}
                onChange={() => setShowChannelName(!showChannelName)}
              />
              <ToggleSwitch
                label="Sunucu Adı"
                description="Sunucu adını kanal adının altında gösterir."
                checked={showServerName}
                onChange={() => setShowServerName(!showServerName)}
              />
              <ToggleSwitch
                label="Konuşmayan Kullanıcılar"
                description="Sessiz duran kullanıcıları da listede gösterir."
                checked={showSilentUsers}
                onChange={() => setShowSilentUsers(!showSilentUsers)}
              />
              <ToggleSwitch
                label="Kendi Kartın"
                description="Kendinizi overlay listesinde gösterir."
                checked={showSelf}
                onChange={() => setShowSelf(!showSelf)}
              />
              <ToggleSwitch
                label="Sadece Konuşanı Göster"
                description="Aktifken sadece konuşan kullanıcılar görünür. Overlay çok kompakt kalır."
                checked={showOnlySpeaking}
                onChange={() => setShowOnlySpeaking(!showOnlySpeaking)}
              />
            </div>
          </div>

          {/* Kontrol Ayarları */}
          <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-4 mb-3 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: "100ms" }}>
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-green-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>

            <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-3 flex items-center gap-2 relative z-10">
              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <MousePointer size={14} className="text-emerald-400" />
              </div>
              Kontroller
            </h4>
            <div className="relative z-10 bg-[#1e1f22] rounded-xl px-4 py-2.5 border border-white/5 hover:border-emerald-500/20 transition-colors duration-300 space-y-3">
              <p className="text-xs text-[#949ba4] mb-3 pl-1 leading-snug">
                Overlay üzerinden hangi kontrollerin yapılabileceğini belirleyin. Sadece görmek isteyip kontrol etmek istemeyebilirsiniz.
              </p>
              <ToggleSwitch
                label="Mute / Unmute"
                description="Overlay üzerinden mikrofonu açıp kapatabilirsiniz."
                checked={controlMute}
                onChange={() => setControlMute(!controlMute)}
              />
              <ToggleSwitch
                label="Deafen / Undeafen"
                description="Overlay üzerinden işitmeyi açıp kapatabilirsiniz."
                checked={controlDeafen}
                onChange={() => setControlDeafen(!controlDeafen)}
              />
              <ToggleSwitch
                label="Kanaldan Ayrıl"
                description="Overlay üzerinden sesli kanaldan ayrılabilirsiniz."
                checked={controlLeave}
                onChange={() => setControlLeave(!controlLeave)}
              />
            </div>
          </div>

          {/* Güvenlik Ayarları */}
          <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-4 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: "150ms" }}>
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 via-rose-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>

            <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-3 flex items-center gap-2 relative z-10">
              <div className="w-6 h-6 rounded-lg bg-red-500/20 flex items-center justify-center">
                <Shield size={14} className="text-red-400" />
              </div>
              Güvenlik
            </h4>
            <div className="relative z-10 bg-[#1e1f22] rounded-xl px-4 py-2.5 border border-white/5 hover:border-red-500/20 transition-colors duration-300 space-y-3">
              <ToggleSwitch
                label="Anti-Cheat Koruması"
                description="Vanguard, BattlEye, EAC gibi anti-cheat sistemleri tespit edildiğinde overlay otomatik gizlenir."
                checked={antiCheatProtection}
                onChange={() => setAntiCheatProtection(!antiCheatProtection)}
              />

              <div className="mt-3 px-3 py-2.5 rounded-lg bg-red-500/5 border border-red-500/10">
                <p className="text-[10px] text-red-300/70 leading-relaxed">
                  <span className="font-bold text-red-400">Tespit edilen süreçler:</span>{" "}
                  vgc.exe (Vanguard), BEService.exe (BattlEye), EasyAntiCheat.exe (EAC)
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
