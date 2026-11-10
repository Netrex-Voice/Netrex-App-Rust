import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Monitor,
  X,
  Zap,
  Layers,
  AppWindow,
  Check,
  ChevronRight,
  Settings2,
  Rocket,
  Volume2,
  VolumeX,
  Info,
} from "lucide-react";

export default function ScreenShareModal({ isOpen, onClose, onStart }) {
  const [step, setStep] = useState(1); // 1: Kaynak Seçimi, 2: Kalite Ayarı
  const [activeTab, setActiveTab] = useState("screens"); // ✅ FIX: Direkt ekranlarla başla
  const [sources, setSources] = useState([]);
  const [selectedSourceId, setSelectedSourceId] = useState(null);
  const appsTabRef = useRef(null);
  const screensTabRef = useRef(null);
  const [tabWidths, setTabWidths] = useState({ apps: 0, screens: 0 });
  const [tabPositions, setTabPositions] = useState({ apps: 0, screens: 0 });

  // Varsayılan Ayarlar
  const [resolution, setResolution] = useState(1080); // 1080p varsayılan
  const [fps, setFps] = useState(15); // 15fps varsayılan

  // YENİ: Ses Paylaşım Ayarı
  const [withAudio, setWithAudio] = useState(true);
  const [audioMode, setAudioMode] = useState("system"); // "system" | "app" - Ekran için sistem, uygulama için uygulama

  // 1080p seçildiğinde FPS'i 30'a düşür (Kısıtlama)
  useEffect(() => {
    if (resolution === 1080 && fps > 30) {
      setFps(30);
    }
  }, [resolution, fps]);

  // Modal açıldığında kaynakları yükle
  useEffect(() => {
    if (!isOpen) return;

    // 🌐 Web: Tarayıcının kendi ekran seçicisini kullan
    if (!window.netrex) {
      // Web'de getDisplayMedia tarayıcının native picker'ını açar
      // Direkt onStart'ı çağır, tarayıcı kendi seçicisini gösterecek
      onStart?.({
        sourceId: null, // Web'de source ID yok
        resolution: 1080,
        fps: 15,
        withAudio: false,
        audioMode: "system",
        isWebMode: true, // Web olduğunu belirt
      });
      onClose?.();
      return;
    }
    
    // Electron: desktopCapturer ile kaynak listesi al
    setStep(1);
    setSources([]);
    setSelectedSourceId(null);
    // ✅ FIX: Hemen ekranlar sekmesiyle başla (async beklenmeden)
    setActiveTab("screens");
    // Varsayılan olarak ses kapalı başlasın (otomatik açılmasın)
    setWithAudio(false);
    setAudioMode("system");

    window.netrex.getDesktopSources().then((srcs) => {
      setSources(srcs);
      // İlk mevcut ekranı otomatik seç
      const firstScreen = srcs.find((s) => s.id.startsWith("screen"));
      if (firstScreen) {
        setSelectedSourceId(firstScreen.id);
      } else if (srcs.length > 0) {
        // Ekran yoksa ilk kaynağı seç
        setSelectedSourceId(srcs[0].id);
      }
    });
  }, [isOpen]);

  // Tab genişliklerini ve pozisyonlarını ölç
  useEffect(() => {
    const measureTabs = () => {
      if (appsTabRef.current && screensTabRef.current) {
        const appsRect = appsTabRef.current.getBoundingClientRect();
        const screensRect = screensTabRef.current.getBoundingClientRect();
        const containerRect =
          appsTabRef.current.parentElement?.getBoundingClientRect();

        if (containerRect) {
          setTabWidths({
            apps: appsRect.width,
            screens: screensRect.width,
          });
          setTabPositions({
            apps: appsRect.left - containerRect.left,
            screens: screensRect.left - containerRect.left,
          });
        }
      }
    };

    // İlk ölçüm
    measureTabs();

    // Window resize ve tab değişikliklerinde yeniden ölç
    window.addEventListener("resize", measureTabs);
    const timeoutId = setTimeout(measureTabs, 100); // DOM güncellemeleri için kısa bir gecikme

    return () => {
      window.removeEventListener("resize", measureTabs);
      clearTimeout(timeoutId);
    };
  }, [activeTab, sources, step]);

  const categorizedSources = useMemo(() => {
    return {
      screens: sources.filter((s) => s.id.startsWith("screen")),
      apps: sources.filter((s) => s.id.startsWith("window")),
    };
  }, [sources]);

  const selectedSourceData = useMemo(
    () => sources.find((s) => s.id === selectedSourceId),
    [sources, selectedSourceId]
  );

  // Artık kendi sunucu olduğu için FPS kısıtlaması yok

  if (!isOpen) return null;

  const handleStart = () => {
    // Kaynak tipine göre audio mode belirle
    const isScreen = selectedSourceData?.id?.startsWith("screen");
    const finalAudioMode = isScreen ? "system" : "app";

    // YENİ: withAudio ve audioMode bilgisini de gönderiyoruz
    onStart({
      resolution,
      fps,
      sourceId: selectedSourceId,
      withAudio,
      audioMode: withAudio ? finalAudioMode : null, // Ses kapalıysa null
    });
    onClose();
  };

  const currentList =
    activeTab === "screens"
      ? categorizedSources.screens
      : categorizedSources.apps;

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/70 z-[99999] flex items-center justify-center p-4 backdrop-blur-xl animate-fadeIn">
      {/* Animated background gradient - More vibrant */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-purple-500/15 to-cyan-500/10 pointer-events-none animate-gradient" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent pointer-events-none" />

      <div className="glass-strong w-full max-w-4xl h-[650px] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_100px_rgba(99,102,241,0.2)] border border-white/20 overflow-hidden flex flex-col relative animate-scaleIn backdrop-blur-2xl bg-gradient-to-br from-[#1a1b1f]/98 via-[#141518]/98 to-[#0e0f12]/98">
        {/* Top glow effect - More prominent */}
        <div className="absolute top-0 left-0 right-0 h-px">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/40 to-transparent animate-pulse-slow" />
        </div>

        {/* Ambient glow orbs - Removed for performance */}

        {/* --- HEADER --- */}
        <div className="p-6 pb-5 shrink-0 flex justify-between items-start border-b border-white/[0.15] relative bg-gradient-to-br from-white/[0.02] via-transparent to-transparent">
          <div className="relative z-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2 tracking-tight flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/30 via-purple-500/20 to-transparent border border-indigo-500/30 flex items-center justify-center backdrop-blur-sm shadow-[0_0_20px_rgba(99,102,241,0.3)]">
                <Monitor size={20} className="text-indigo-300" />
              </div>
              <span className="relative">
                {step === 1 ? "Ekran Paylaşımı" : "Yayın Kalitesi"}
                <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-indigo-500/50 via-purple-500/50 to-transparent rounded-full" />
              </span>
            </h2>
            <p className="text-white/60 text-sm font-medium ml-[52px]">
              {step === 1
                ? "Arkadaşlarına ne göstermek istersin?"
                : "Yayının ne kadar net ve akıcı olacağını seç."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white bg-white/[0.03] hover:bg-gradient-to-br hover:from-red-500/20 hover:to-red-600/15 border border-white/[0.08] hover:border-red-500/30 p-2.5 rounded-2xl transition-all duration-300 hover:scale-110 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] active:scale-95 relative z-10 group/close backdrop-blur-sm"
          >
            <X
              size={20}
              className="relative z-10 group-hover/close:rotate-90 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-white/5 rounded-2xl opacity-0 group-hover/close:opacity-100 transition-opacity duration-300" />
          </button>
        </div>

        {/* --- CONTENT AREA --- */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {/* STEP 1: KAYNAK SEÇİMİ */}
          {step === 1 && (
            <>
              <div className="px-6 pt-4 pb-0 border-b border-white/[0.08] flex gap-6 relative bg-gradient-to-b from-white/[0.01] to-transparent">
                {/* Animated background for active tab - Dynamic width */}
                <div
                  className="absolute bottom-0 h-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 rounded-t-full shadow-[0_0_20px_rgba(99,102,241,0.6)] transition-all duration-300 ease-out"
                  style={{
                    left:
                      activeTab === "apps"
                        ? `${tabPositions.apps}px`
                        : `${tabPositions.screens}px`,
                    width:
                      activeTab === "apps"
                        ? `${tabWidths.apps}px`
                        : `${tabWidths.screens}px`,
                  }}
                />

                <button
                  ref={screensTabRef}
                  onClick={() => setActiveTab("screens")}
                  className={`pb-3.5 px-1 text-sm font-bold transition-all duration-300 relative flex items-center gap-2.5 group/tab ${
                    activeTab === "screens"
                      ? "text-white"
                      : "text-white/50 hover:text-white/90"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    activeTab === "screens"
                      ? "bg-gradient-to-br from-indigo-500/25 to-purple-500/20 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                      : "bg-white/[0.03] border border-white/[0.08] group-hover/tab:bg-white/[0.08] group-hover/tab:border-white/[0.15]"
                  }`}>
                    <Monitor
                      size={16}
                      className={`transition-all duration-300 ${
                        activeTab === "screens"
                          ? "text-indigo-300 scale-110"
                          : "text-white/60 group-hover/tab:text-white/90 group-hover/tab:scale-110"
                      }`}
                    />
                  </div>
                  <span className="font-semibold">Ekranlar</span>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-all duration-300 ${
                      activeTab === "screens"
                        ? "bg-gradient-to-br from-indigo-500/30 to-purple-500/20 border border-indigo-500/40 text-indigo-200 shadow-[0_0_10px_rgba(99,102,241,0.2)]"
                        : "bg-white/[0.05] border border-white/[0.08] text-white/50 group-hover/tab:bg-white/[0.08]"
                    }`}
                  >
                    {categorizedSources.screens.length}
                  </span>
                </button>
                <button
                  ref={appsTabRef}
                  onClick={() => setActiveTab("apps")}
                  className={`pb-3.5 px-1 text-sm font-bold transition-all duration-300 relative flex items-center gap-2.5 group/tab ${
                    activeTab === "apps"
                      ? "text-white"
                      : "text-white/50 hover:text-white/90"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${
                    activeTab === "apps"
                      ? "bg-gradient-to-br from-indigo-500/25 to-purple-500/20 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                      : "bg-white/[0.03] border border-white/[0.08] group-hover/tab:bg-white/[0.08] group-hover/tab:border-white/[0.15]"
                  }`}>
                    <AppWindow
                      size={16}
                      className={`transition-all duration-300 ${
                        activeTab === "apps"
                          ? "text-indigo-300 scale-110"
                          : "text-white/60 group-hover/tab:text-white/90 group-hover/tab:scale-110"
                      }`}
                    />
                  </div>
                  <span className="font-semibold">Uygulamalar</span>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-all duration-300 ${
                      activeTab === "apps"
                        ? "bg-gradient-to-br from-indigo-500/30 to-purple-500/20 border border-indigo-500/40 text-indigo-200 shadow-[0_0_10px_rgba(99,102,241,0.2)]"
                        : "bg-white/[0.05] border border-white/[0.08] text-white/50 group-hover/tab:bg-white/[0.08]"
                    }`}
                  >
                    {categorizedSources.apps.length}
                  </span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-gradient-to-b from-[#1a1b1f] to-[#0e0f12] relative">
                {/* Animated background particles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl animate-pulse-slow"></div>
                  <div
                    className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl animate-pulse-slow"
                    style={{ animationDelay: "1s" }}
                  ></div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 relative z-10">
                  {currentList.map((source) => (
                    <div
                      key={source.id}
                      onClick={() => setSelectedSourceId(source.id)}
                      className={`
                        group relative cursor-pointer rounded-2xl overflow-hidden border-2 transition-all duration-500 flex flex-col glass-strong hover:scale-[1.03] relative
                        ${
                          selectedSourceId === source.id
                            ? "border-indigo-500/60 ring-4 ring-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.4)] scale-105 bg-gradient-to-br from-indigo-500/10 to-purple-500/10"
                            : "border-white/10 hover:border-indigo-500/30 hover:shadow-soft-lg hover:bg-white/5"
                        }
                      `}
                    >
                      {/* Hover glow effect */}
                      <div
                        className={`absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl ${
                          selectedSourceId === source.id ? "opacity-100" : ""
                        }`}
                      ></div>

                      <div className="w-full aspect-video bg-[#0a0a0c] flex items-center justify-center p-2 relative overflow-hidden rounded-t-2xl border-b border-white/5">
                        <img
                          src={source.thumbnail}
                          alt={source.name}
                          className={`w-full h-full object-contain shadow-lg transition-all duration-500 ${
                            selectedSourceId === source.id
                              ? "scale-110 brightness-110"
                              : "group-hover:scale-105"
                          }`}
                        />
                        {selectedSourceId === source.id && (
                          <>
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/30 via-purple-500/20 to-transparent flex items-center justify-center backdrop-blur-sm">
                              <div className="w-14 h-14 gradient-primary rounded-full flex items-center justify-center shadow-[0_0_25px_rgba(99,102,241,0.6)] animate-scaleIn relative">
                                <Check
                                  size={28}
                                  className="text-white relative z-10"
                                  strokeWidth={3}
                                />
                                <div className="absolute inset-0 bg-white/20 rounded-full animate-ping"></div>
                              </div>
                            </div>
                            {/* Pulse ring */}
                            <div className="absolute inset-0 border-2 border-indigo-500/40 rounded-t-2xl animate-pulse-border"></div>
                          </>
                        )}
                      </div>
                      <div
                        className={`p-3 border-t border-white/5 flex items-center gap-3 transition-all duration-300 relative z-10 ${
                          selectedSourceId === source.id
                            ? "bg-gradient-to-r from-indigo-500/10 to-purple-500/10"
                            : "glass-light group-hover:bg-white/10"
                        }`}
                      >
                        {source.appIcon && activeTab === "apps" ? (
                          <img
                            src={source.appIcon}
                            className="w-5 h-5 rounded shadow-sm"
                            alt=""
                          />
                        ) : (
                          <div
                            className={`w-5 h-5 rounded flex items-center justify-center transition-all duration-300 ${
                              selectedSourceId === source.id
                                ? "glass-strong border border-indigo-500/30 bg-indigo-500/10"
                                : "glass-light"
                            }`}
                          >
                            {activeTab === "screens" ? (
                              <Layers
                                size={12}
                                className={
                                  selectedSourceId === source.id
                                    ? "text-indigo-300"
                                    : "text-[#dbdee1]"
                                }
                              />
                            ) : (
                              <AppWindow
                                size={12}
                                className={
                                  selectedSourceId === source.id
                                    ? "text-indigo-300"
                                    : "text-[#dbdee1]"
                                }
                              />
                            )}
                          </div>
                        )}
                        <span
                          className={`text-xs font-semibold truncate flex-1 leading-tight transition-colors duration-300 ${
                            selectedSourceId === source.id
                              ? "text-white"
                              : "text-[#dbdee1] group-hover:text-white"
                          }`}
                        >
                          {source.name}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {currentList.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-[#949ba4] opacity-50 pb-20">
                    <div className="p-6 glass-strong rounded-2xl mb-4">
                      <Layers
                        size={48}
                        className="stroke-1 text-indigo-400/50"
                      />
                    </div>
                    <p className="text-lg font-medium">
                      Hiçbir kaynak bulunamadı.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* STEP 2: KALİTE VE SES AYARLARI */}
          {step === 2 && (
            <div className="flex-1 bg-gradient-to-b from-[#25272a] to-[#2b2d31] p-8 flex flex-col gap-6 overflow-y-auto">
              {/* Preview - Enhanced - Larger */}
              <div className="glass-strong p-6 rounded-2xl border border-white/20 flex items-center gap-6 shadow-soft-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01] relative overflow-hidden group/preview">
                {/* Hover glow */}
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent opacity-0 group-hover/preview:opacity-100 transition-opacity duration-300"></div>

                <div className="h-32 w-56 bg-black rounded-xl overflow-hidden border-2 border-white/10 shadow-lg relative group/thumb shrink-0">
                  <img
                    src={selectedSourceData?.thumbnail}
                    className="w-full h-full object-contain transition-transform duration-300 group-hover/thumb:scale-110"
                    alt=""
                  />
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-300"></div>
                </div>
                <div className="flex-1 relative z-10 min-w-0">
                  <div className="text-[11px] font-bold text-[#949ba4] uppercase mb-2 tracking-wider flex items-center gap-2">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div>
                    SEÇİLEN KAYNAK
                  </div>
                  <div className="text-white font-bold text-lg truncate group-hover/preview:text-indigo-200 transition-colors duration-300">
                    {selectedSourceData?.name}
                  </div>
                </div>
                <button
                  onClick={() => setStep(1)}
                  className="text-sm font-medium text-indigo-400 hover:text-white px-6 py-3 glass-strong border border-indigo-500/30 hover:bg-gradient-to-r hover:from-indigo-500/20 hover:to-purple-500/20 hover:border-indigo-500/50 rounded-xl transition-all duration-300 hover:scale-110 hover:shadow-soft relative group/change z-10 shrink-0"
                >
                  <span className="relative z-10">Değiştir</span>
                  <div className="absolute inset-0 bg-white/5 rounded-xl opacity-0 group-hover/change:opacity-100 transition-opacity duration-300"></div>
                </button>
              </div>

              <div className="flex gap-8">
                {/* Çözünürlük */}
                <div className="flex-1">
                  <label className="text-xs font-bold text-white uppercase mb-4 flex items-center gap-2 tracking-wider">
                    <Monitor size={16} className="text-indigo-400" /> Çözünürlük
                  </label>
                  <div className="space-y-3">
                    {[
                      { value: 480, label: "480p", desc: "SD" },
                      { value: 720, label: "720p", desc: "HD" },
                      { value: 1080, label: "1080p", desc: "Full HD" },
                    ].map((res) => (
                      <button
                        key={res.value}
                        onClick={() => setResolution(res.value)}
                        className={`w-full flex items-center justify-between p-5 rounded-2xl border-2 transition-all duration-500 group relative overflow-hidden ${
                          resolution === res.value
                            ? "gradient-primary border-indigo-400/80 shadow-[0_0_25px_rgba(99,102,241,0.5)] scale-105"
                            : "glass-strong border-white/20 hover:border-indigo-500/40 hover:bg-gradient-to-r hover:from-indigo-500/10 hover:to-purple-500/10 hover:shadow-soft-lg hover:scale-[1.02]"
                        }`}
                      >
                        {/* Hover glow */}
                        <div
                          className={`absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 transition-opacity duration-300 ${
                            resolution === res.value
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100"
                          }`}
                        ></div>

                        <div className="flex flex-col items-start relative z-10">
                          <span
                            className={`font-bold text-lg transition-colors duration-300 ${
                              resolution === res.value
                                ? "text-white"
                                : "text-[#dbdee1] group-hover:text-white"
                            }`}
                          >
                            {res.label}
                          </span>
                          <span className="text-xs text-[#949ba4]">{res.desc}</span>
                        </div>
                        {resolution === res.value && (
                          <div className="w-5 h-5 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.5)] flex items-center justify-center relative z-10 animate-scaleIn">
                            <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-pulse"></div>
                            <div className="absolute inset-0 bg-indigo-500/30 rounded-full animate-ping"></div>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* FPS */}
                <div className="flex-1">
                  <label className="text-xs font-bold text-white uppercase mb-4 flex items-center gap-2 tracking-wider">
                    <Zap size={16} className="text-indigo-400" /> Kare Hızı
                    (FPS)
                  </label>
                  <div className="space-y-3">
                    {[
                      { value: 15, label: "15 FPS", desc: "Düşük" },
                      { value: 30, label: "30 FPS", desc: "Normal" },
                      { value: 60, label: "60 FPS", desc: "Yüksek" },
                    ].map((f) => {
                      const isDisabled = resolution === 1080 && f.value > 30;
                      return (
                      <button
                        key={f.value}
                        onClick={() => !isDisabled && setFps(f.value)}
                        disabled={isDisabled}
                        className={`w-full flex items-center justify-between p-5 rounded-2xl border-2 transition-all duration-500 relative overflow-hidden group ${
                          isDisabled
                            ? "opacity-50 grayscale cursor-not-allowed border-white/5 bg-white/5"
                            : fps === f.value
                            ? "gradient-primary border-indigo-400/80 shadow-[0_0_25px_rgba(99,102,241,0.5)] scale-105"
                            : "glass-strong border-white/20 hover:border-indigo-500/40 hover:bg-gradient-to-r hover:from-indigo-500/10 hover:to-purple-500/10 hover:shadow-soft-lg hover:scale-[1.02]"
                        }`}
                      >
                        {/* Hover glow */}
                        <div
                          className={`absolute inset-0 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 transition-opacity duration-300 ${
                            fps === f.value
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100"
                          }`}
                        ></div>

                        <div className="flex flex-col items-start relative z-10">
                          <span
                            className={`font-bold text-lg transition-colors duration-300 ${
                              fps === f.value
                                ? "text-white"
                                : "text-[#dbdee1] group-hover:text-white"
                            }`}
                          >
                            {f.label}
                          </span>
                          <span className="text-xs text-[#949ba4]">{f.desc}</span>
                        </div>
                        {fps === f.value && (
                          <div className="w-5 h-5 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.5)] flex items-center justify-center relative z-10 animate-scaleIn">
                            <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-pulse"></div>
                            <div className="absolute inset-0 bg-indigo-500/30 rounded-full animate-ping"></div>
                          </div>
                        )}
                      </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* YENİ: SES AYARLARI - Enhanced */}
              {selectedSourceData && (
                <div className="space-y-3">
                  {/* Ses Paylaşım Toggle - Premium Design */}
                  <div className="glass-strong p-5 rounded-2xl border border-white/20 flex items-center justify-between shadow-soft-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01] relative overflow-hidden group/audio">
                    {/* Hover glow */}
                    <div
                      className={`absolute inset-0 bg-gradient-to-r transition-opacity duration-300 ${
                        withAudio
                          ? "from-green-500/10 via-green-500/5 to-transparent opacity-100"
                          : "from-red-500/10 via-red-500/5 to-transparent opacity-0 group-hover/audio:opacity-100"
                      }`}
                    ></div>

                    <div className="flex items-center gap-4 relative z-10">
                      <div
                        className={`p-3 rounded-xl transition-all duration-500 relative ${
                          withAudio
                            ? "bg-gradient-to-br from-green-500/30 to-green-600/30 text-green-300 shadow-[0_0_20px_rgba(34,197,94,0.4)] border border-green-400/40"
                            : "bg-gradient-to-br from-red-500/20 to-red-600/20 text-red-300 border border-red-400/30"
                        }`}
                      >
                        {withAudio ? (
                          <Volume2 size={20} className="relative z-10" />
                        ) : (
                          <VolumeX size={20} className="relative z-10" />
                        )}
                        {withAudio && (
                          <div className="absolute inset-0 bg-green-500/20 rounded-xl animate-pulse"></div>
                        )}
                      </div>
                      <div>
                        <div className="text-white font-bold text-sm mb-1 transition-colors duration-300 group-hover/audio:text-[#dbdee1]">
                          {selectedSourceData.id.startsWith("screen")
                            ? "Sistem Sesini Paylaş"
                            : "Uygulama Sesini Paylaş"}
                        </div>
                        <div className="text-[#949ba4] text-xs group-hover/audio:text-[#b5bac1] transition-colors duration-300">
                          {selectedSourceData.id.startsWith("screen")
                            ? "Tüm bilgisayar seslerini yayına ekle."
                            : "Bilgisayar sesini yayına ekle."}
                        </div>
                      </div>
                    </div>
                    {/* Toggle Switch - Enhanced */}
                    <button
                      onClick={() => setWithAudio(!withAudio)}
                      className={`w-14 h-8 rounded-full transition-all duration-500 ease-in-out border-2 relative z-10 ${
                        withAudio
                          ? "bg-gradient-to-r from-green-500 to-green-600 border-green-400/50 shadow-[0_0_20px_rgba(34,197,94,0.5)]"
                          : "bg-[#404249] border-white/10 hover:border-red-500/30"
                      }`}
                    >
                      <div
                        className={`absolute top-[2px] left-[2px] w-6 h-6 bg-white rounded-full shadow-lg transition-all duration-500 ease-in-out flex items-center justify-center ${
                          withAudio ? "translate-x-[26px]" : "translate-x-0"
                        }`}
                      >
                        {withAudio && (
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        )}
                      </div>
                      {/* Glow effect */}
                      {withAudio && (
                        <div className="absolute inset-0 bg-green-500/20 rounded-full blur-sm animate-pulse"></div>
                      )}
                    </button>
                  </div>

                  {/* Bilgi Notu - Enhanced */}
                  {withAudio && selectedSourceData.id.startsWith("screen") && (
                    <div className="p-3 bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/30 rounded-xl text-[11px] text-amber-200 flex items-start gap-2 shadow-soft backdrop-blur-sm animate-fadeIn relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent"></div>
                      <Volume2
                        size={14}
                        className="shrink-0 mt-0.5 relative z-10 text-amber-300"
                      />
                      <span className="relative z-10">
                        <strong>Dikkat:</strong> Sistem sesi paylaşılırken Netrex'ten gelen sesler de dahil olur. 
                        Yankı önlemek için <strong>kulaklık kullanmanızı</strong> öneririz.
                      </span>
                    </div>
                  )}
                  
                  {/* Uygulama sesi uyarısı */}
                  {withAudio && !selectedSourceData.id.startsWith("screen") && (
                    <div className="p-3 bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/30 rounded-xl text-[11px] text-amber-200 flex items-start gap-2 shadow-soft backdrop-blur-sm animate-fadeIn relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 to-transparent"></div>
                      <Volume2
                        size={14}
                        className="shrink-0 mt-0.5 relative z-10 text-amber-300"
                      />
                      <span className="relative z-10">
                        <strong>Dikkat:</strong> Windows sınırlaması nedeniyle uygulama paylaşımında da tüm sistem sesi alınır. 
                        Yankı önlemek için <strong>kulaklık kullanmanızı</strong> öneririz.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Uyarı - 1080p Limit */}
              {resolution === 1080 && (
                <div className="p-3 bg-gradient-to-r from-indigo-500/15 to-purple-500/15 border border-indigo-500/30 rounded-xl text-[11px] text-indigo-200 flex items-center gap-2 shadow-soft backdrop-blur-sm animate-fadeIn relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-transparent"></div>
                  <Info
                    size={14}
                    className="shrink-0 relative z-10 text-indigo-300"
                  />
                  <span className="relative z-10">
                    1080p çözünürlük için kare hızı 30 FPS ile sınırlandırılmıştır.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* --- FOOTER --- */}
        <div className="bg-gradient-to-t from-[#1e1f22] via-[#25272a] to-transparent p-6 flex justify-between items-center shrink-0 border-t border-white/10 backdrop-blur-xl relative">
          {/* Top glow */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>

          <div className="flex items-center gap-2 text-xs relative z-10">
            {step === 2 && withAudio ? (
              <span className="flex items-center gap-2 text-green-300 glass-strong border border-green-500/40 px-3 py-1.5 rounded-xl font-medium shadow-[0_0_15px_rgba(34,197,94,0.3)] bg-gradient-to-r from-green-500/20 to-green-600/20 animate-fadeIn">
                <Volume2 size={14} className="animate-pulse" /> Ses Açık
              </span>
            ) : step === 2 ? (
              <span className="flex items-center gap-2 text-red-300 glass-strong border border-red-500/40 px-3 py-1.5 rounded-xl font-medium shadow-soft bg-gradient-to-r from-red-500/20 to-red-600/20 animate-fadeIn">
                <VolumeX size={14} /> Ses Kapalı
              </span>
            ) : (
              <span className="flex items-center gap-2 glass-strong border border-white/10 px-3 py-1.5 rounded-xl">
                <Settings2 size={14} className="animate-spin-slow" /> Ayarlar
                yapılandırılıyor...
              </span>
            )}
          </div>

          <div className="flex gap-3 relative z-10">
            {step === 1 ? (
              <button
                onClick={selectedSourceId ? () => setStep(2) : null}
                disabled={!selectedSourceId}
                className={`px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2 relative overflow-hidden group ${
                  selectedSourceId
                    ? "gradient-primary hover:shadow-[0_0_25px_rgba(99,102,241,0.5)] text-white shadow-soft-lg hover:scale-110"
                    : "glass-strong text-[#949ba4] cursor-not-allowed opacity-50"
                }`}
              >
                {selectedSourceId && (
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                )}
                <span className="relative z-10">Ayarlara Git</span>
                <ChevronRight
                  size={16}
                  className={`relative z-10 transition-transform duration-300 ${
                    selectedSourceId ? "group-hover:translate-x-1" : ""
                  }`}
                />
              </button>
            ) : (
              <button
                onClick={handleStart}
                className="px-8 py-3 gradient-success hover:shadow-[0_0_25px_rgba(34,197,94,0.5)] text-white rounded-xl text-sm font-bold transition-all duration-300 shadow-soft-lg hover:scale-110 flex items-center gap-2 relative overflow-hidden group/start"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-green-600/20 opacity-0 group-hover/start:opacity-100 transition-opacity duration-300"></div>
                <Rocket
                  size={16}
                  className="relative z-10 group-hover/start:rotate-12 transition-transform duration-300"
                />
                <span className="relative z-10">Yayına Başla</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
