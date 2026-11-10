import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Palette, Pipette, Zap, Check } from "lucide-react";
import { PRESET_GRADIENTS, SOLID_COLORS } from "../constants";
import { useSettingsStore } from "@/src/store/settingsStore";
import { toast } from "@/src/utils/toast";
import { extractDominantGradient } from "@/src/utils/extractDominantGradient";

/**
 * ✅ ProfileThemePicker - Optimized color picker
 * Handles solid colors and gradients with debounced updates
 */
export default function ProfileThemePicker({ profileColor, setProfileColor, user, bgImage }) {
  // Parse profile color helper
  const parseProfileColor = useCallback((color) => {
    if (!color)
      return {
        mode: "solid",
        solidColor: "#6366f1",
        start: "#6366f1",
        end: "#a855f7",
        angle: 135,
      };

    if (color.includes("gradient")) {
      const type = color.includes("radial-gradient")
        ? "radial"
        : color.includes("conic-gradient")
          ? "conic"
          : "linear";

      const angleMatch = color.match(/(\d+)deg/);
      const colorMatches = color.match(/#[0-9a-fA-F]{6}/g);
      const angle = angleMatch ? parseInt(angleMatch[1]) : 135;
      const start = colorMatches?.[0] || "#6366f1";
      const end = colorMatches?.[1] || "#a855f7";
      return {
        mode: "gradient",
        gradientType: type,
        solidColor: start,
        start,
        end,
        angle,
      };
    } else {
      return {
        mode: "solid",
        gradientType: "linear",
        solidColor: color,
        start: "#6366f1",
        end: "#a855f7",
        angle: 135,
      };
    }
  }, []);

  const parsed = useMemo(
    () => parseProfileColor(profileColor),
    [profileColor, parseProfileColor]
  );

  const [colorMode, setColorMode] = useState(parsed.mode);
  const [gradientType, setGradientType] = useState(parsed.gradientType);
  const [gradStart, setGradStart] = useState(parsed.start);
  const [gradEnd, setGradEnd] = useState(parsed.end);
  const [gradAngle, setGradAngle] = useState(parsed.angle);
  const [localSolidColor, setLocalSolidColor] = useState(parsed.solidColor);
  const autoThemeFromImage = useSettingsStore((state) => state.autoThemeFromImage);
  const setAutoThemeFromImage = useSettingsStore((state) => state.setAutoThemeFromImage);
  const useProfileColorForSpeaking = useSettingsStore((state) => state.useProfileColorForSpeaking);
  const setUseProfileColorForSpeaking = useSettingsStore((state) => state.setUseProfileColorForSpeaking);
  const [isGenerating, setIsGenerating] = useState(false);

  // ── Manual Gradient Magic ──────────────────────────────────────────────────
  const handleGenerateFromImage = async (source, label = "Görüntü") => {
    if (!source) {
      toast.error(`${label} için analiz edilecek bir resim bulunamadı.`);
      return;
    }

    setIsGenerating(true);
    try {
      console.log(`[ThemePicker] Starting manual extraction for: ${label}`);
      const gradient = await extractDominantGradient(source);
      if (gradient) {
        setProfileColor(gradient);
        // Anında local state'leri de güncelle
        const parsed = parseProfileColor(gradient);
        setGradStart(parsed.start);
        setGradEnd(parsed.end);
        setGradAngle(parsed.angle);
        toast.success(`${label} renkleri başarıyla uygulandı!`);
      }
    } catch (error) {
      console.error(`[ThemePicker] Manual extraction failed for ${label}:`, error);
      toast.error(`${label} resminden renkler çıkarılamadı.`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Ref to track if we are currently updating the store to prevent loops
  const isUpdatingStore = useRef(false);

  // ── 1. Synced: Store -> Local ──────────────────────────────────────────────
  // Store'daki profileColor değiştiğinde (örneğin dışarıdan veya preset seçiminden)
  // local state'lerimizi güncelliyoruz.
  useEffect(() => {
    // Eğer biz az önce store'u güncellediysek, bu re-render'ı pas geçiyoruz
    if (isUpdatingStore.current) {
      isUpdatingStore.current = false;
      return;
    }

    const newParsed = parseProfileColor(profileColor);
    
    // Sadece farklıysa güncelle (sonsuz döngüyü önlemek için)
    setColorMode(newParsed.mode);
    setGradientType(newParsed.gradientType);
    setGradStart(newParsed.start);
    setGradEnd(newParsed.end);
    setGradAngle(newParsed.angle);
    setLocalSolidColor(newParsed.solidColor);
  }, [profileColor, parseProfileColor]);

  // ── 2. Local -> Store: Debounced Gradient Update ───────────────────────────
  useEffect(() => {
    if (colorMode !== "gradient") return;

    let gradStr = `linear-gradient(${gradAngle}deg, ${gradStart} 0%, ${gradEnd} 100%)`;
    if (gradientType === "radial") {
      gradStr = `radial-gradient(circle at center, ${gradStart} 0%, ${gradEnd} 100%)`;
    } else if (gradientType === "conic") {
      gradStr = `conic-gradient(from ${gradAngle}deg, ${gradStart}, ${gradEnd})`;
    }

    if (profileColor === gradStr) return;

    const timer = setTimeout(() => {
      isUpdatingStore.current = true;
      setProfileColor(gradStr);
    }, 350);

    return () => clearTimeout(timer);
  }, [gradStart, gradEnd, gradAngle, gradientType, colorMode, setProfileColor, profileColor]);

  // ── 3. Local -> Store: Debounced Solid Update ─────────────────────────────
  useEffect(() => {
    if (colorMode !== "solid") return;
    if (profileColor === localSolidColor) return;

    const timer = setTimeout(() => {
      isUpdatingStore.current = true;
      setProfileColor(localSolidColor);
    }, 350);

    return () => clearTimeout(timer);
  }, [localSolidColor, colorMode, setProfileColor, profileColor]);

  return (
    <div className="glass-strong rounded-2xl border border-white/20 overflow-hidden p-4 mb-4 shadow-soft-lg hover:shadow-xl transition-all duration-300 relative group/card">
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-transparent opacity-0 group-hover/card:opacity-100 transition-opacity duration-300"></div>
      
      <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-3 flex items-center gap-2 relative z-10">
        <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center">
          <Palette size={14} className="text-purple-400" />
        </div>
        Profil Teması
      </h4>
      
      <div className="relative z-10">
        {/* Mode Toggle */}
        <div className="flex gap-2 mb-4 bg-[#1e1f22] p-1.5 rounded-xl w-fit border border-white/5">
          <button
            onClick={() => {
              setColorMode("solid");
              if (profileColor.includes("gradient")) {
                const parsed = parseProfileColor(profileColor);
                setLocalSolidColor(parsed.solidColor);
                setProfileColor(parsed.solidColor);
              }
            }}
            onMouseDown={(e) => e.preventDefault()}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2 focus:outline-none ${
              colorMode === "solid"
                ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white shadow border border-indigo-500/30"
                : "text-[#949ba4] hover:text-white hover:bg-white/5"
            }`}
          >
            <Pipette size={14} /> Düz Renk
          </button>
          <button
            onClick={() => {
              setColorMode("gradient");
              if (!profileColor.includes("gradient")) {
                const parsed = parseProfileColor(profileColor);
                setGradStart(parsed.solidColor);
                setProfileColor(
                  `linear-gradient(${gradAngle}deg, ${parsed.solidColor} 0%, ${gradEnd} 100%)`
                );
              }
            }}
            onMouseDown={(e) => e.preventDefault()}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2 focus:outline-none ${
              colorMode === "gradient"
                ? "bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-white shadow border border-indigo-500/30"
                : "text-[#949ba4] hover:text-white hover:bg-white/5"
            }`}
          >
            <Zap size={14} /> Gradient
          </button>
        </div>
        
        {/* Solid Color Picker */}
        {colorMode === "solid" && (
          <div className="animate-in fade-in zoom-in-95 duration-200 bg-[#1e1f22] rounded-xl px-4 py-2.5 border border-white/5">
            <div className="flex flex-wrap gap-3">
              <label className="w-10 h-10 rounded-full bg-[#2b2d31] border-2 border-dashed border-[#4e5058] flex items-center justify-center cursor-pointer hover:border-indigo-500 transition group relative overflow-hidden">
                <input
                  type="color"
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  onChange={(e) => setLocalSolidColor(e.target.value)}
                  value={localSolidColor}
                />
                <Pipette
                  size={16}
                  className="text-[#949ba4] group-hover:text-indigo-400 transition-colors"
                />
              </label>
              {SOLID_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setProfileColor(color)}
                  onMouseDown={(e) => e.preventDefault()}
                  className={`w-10 h-10 rounded-full transition-all duration-200 relative focus:outline-none ${
                    profileColor === color
                      ? "ring-2 ring-white ring-offset-2 ring-offset-[#1e1f22] scale-110"
                      : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: color }}
                >
                  {profileColor === color && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Check
                        size={16}
                        className="text-white drop-shadow-md"
                        strokeWidth={3}
                      />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Gradient Picker */}
        {colorMode === "gradient" && (
          <div className="animate-in fade-in zoom-in-95 duration-200 bg-[#1e1f22] p-4 rounded-xl border border-white/5">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-[#949ba4] uppercase">
                  Tip
                </span>
                <div className="flex gap-1.5 bg-[#111214]/60 p-1.5 rounded-[14px] border border-white/5 backdrop-blur-md shadow-inner">
                  {[
                    { id: "linear", label: "Liner", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/></svg> },
                    { id: "radial", label: "Radyal", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg> },
                    { id: "conic", label: "Konik", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v10l8.5 5"/><circle cx="12" cy="12" r="10"/></svg> },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setGradientType(t.id)}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 relative group/type ${
                        gradientType === t.id
                          ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20 scale-105 active:scale-95"
                          : "text-[#949ba4] hover:bg-white/5 hover:text-white"
                      }`}
                      title={t.label}
                    >
                      {t.icon}
                      {gradientType === t.id && (
                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-white rounded-full"></div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-[#949ba4] uppercase">
                  Başlangıç
                </span>
                <div className="flex items-center gap-2 bg-[#111214]/40 p-1.5 rounded-xl border border-white/5">
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-white/10">
                    <input
                      type="color"
                      value={gradStart}
                      onChange={(e) => setGradStart(e.target.value)}
                      className="absolute inset-0 w-[150%] h-[150%] -translate-x-[20%] -translate-y-[20%] cursor-pointer bg-transparent border-0 p-0"
                    />
                  </div>
                  <span className="text-[11px] font-mono font-bold text-[#dbdee1] pr-2">
                    {gradStart.toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-[#949ba4] uppercase">
                  Bitiş
                </span>
                <div className="flex items-center gap-2 bg-[#111214]/40 p-1.5 rounded-xl border border-white/5">
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-white/10">
                    <input
                      type="color"
                      value={gradEnd}
                      onChange={(e) => setGradEnd(e.target.value)}
                      className="absolute inset-0 w-[150%] h-[150%] -translate-x-[20%] -translate-y-[20%] cursor-pointer bg-transparent border-0 p-0"
                    />
                  </div>
                  <span className="text-[11px] font-mono font-bold text-[#dbdee1] pr-2">
                    {gradEnd.toUpperCase()}
                  </span>
                </div>
              </div>
              {gradientType !== "radial" && (
                <div className="flex flex-col gap-1 flex-1 ml-4 animate-in fade-in slide-in-from-right-2 duration-300">
                  <span className="text-[10px] font-bold text-[#949ba4] uppercase">
                    Açı ({gradAngle}°)
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={gradAngle}
                    onChange={(e) => setGradAngle(e.target.value)}
                    className="w-full h-2 bg-[#404249] rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
              )}
            </div>
            <div className="space-y-3">
              <span className="text-[10px] font-bold text-[#949ba4] uppercase">
                Hızlı Seçim
              </span>
              <div className="flex flex-wrap gap-3">
                {/* Otomatik (mevcut) gradient - sadece otomatik tema açıksa göster */}
                {autoThemeFromImage && (
                  <button
                    onClick={() => {
                      // Bu tıklandığında mevcut profileColor'ı local state'lere yayalım
                      const parsed = parseProfileColor(profileColor);
                      setGradStart(parsed.start);
                      setGradEnd(parsed.end);
                      setGradAngle(parsed.angle);
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                    className={`w-16 h-12 rounded-lg transition-all duration-200 relative shadow-sm focus:outline-none border ${
                      profileColor.includes("gradient") && !PRESET_GRADIENTS.includes(profileColor)
                        ? "ring-2 ring-white ring-offset-2 ring-offset-[#1e1f22] border-white/40"
                        : "hover:scale-105 border-transparent opacity-60 hover:opacity-100"
                    }`}
                    style={{ background: profileColor }}
                  >
                    <span className="absolute bottom-1 left-1 right-1 text-[9px] font-bold text-white drop-shadow-md text-left px-1 uppercase tracking-tight">
                      Görüntü
                    </span>
                    {profileColor.includes("gradient") && !PRESET_GRADIENTS.includes(profileColor) && (
                      <div className="absolute top-1 right-1">
                        <Check
                          size={14}
                          className="text-white drop-shadow-md"
                          strokeWidth={3}
                        />
                      </div>
                    )}
                    <Zap size={14} className="absolute top-1 left-1 text-white opacity-50" />
                  </button>
                )}
                {PRESET_GRADIENTS.map((grad, i) => {
                  const pGrad = parseProfileColor(grad);
                  const isSelected =
                    colorMode === "gradient" &&
                    pGrad.start === gradStart &&
                    pGrad.end === gradEnd;

                  return (
                    <button
                      key={i}
                      onClick={() => {
                        if (colorMode === "gradient") {
                          setGradStart(pGrad.start);
                          setGradEnd(pGrad.end);
                        } else {
                          setProfileColor(grad);
                        }
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                      className={`w-12 h-12 rounded-lg transition-all duration-200 relative shadow-sm focus:outline-none ${
                        isSelected
                          ? "ring-2 ring-white ring-offset-2 ring-offset-[#1e1f22]"
                          : "hover:scale-105"
                      }`}
                      style={{ background: grad }}
                    >
                      {isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Check
                            size={20}
                            className="text-white drop-shadow-md"
                            strokeWidth={3}
                          />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Automatic Theme Toggle */}
              <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs text-white/80 font-medium">
                    Yüklediğim resme göre temayı ayarla
                  </span>
                  <span className="text-[10px] text-white/40">
                    Yeni avatar / arkaplan yüklediğimde profili otomatik renklendir.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoThemeFromImage(!autoThemeFromImage)}
                  className={`w-10 h-6 rounded-full flex items-center px-1 transition-colors duration-200 ${
                    autoThemeFromImage
                      ? "bg-indigo-500"
                      : "bg-[#2b2d31]"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform duration-200 ${
                      autoThemeFromImage ? "translate-x-4" : ""
                    }`}
                  />
                </button>
              </div>

              {/* Enhanced Magic Section */}
              <div className="mt-2 space-y-2 bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/20">
                <div className="flex flex-col mb-1">
                  <span className="text-xs text-indigo-200 font-bold flex items-center gap-2">
                    <Zap size={14} className="animate-pulse text-indigo-400" /> Renk Sihirbazı
                  </span>
                  <span className="text-[10px] text-indigo-300/60 leading-tight">
                    Mevcut resimlerinden renk paleti çıkar ve profesyonel bir gradient oluştur.
                  </span>
                </div>
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleGenerateFromImage(user?.photoURL, "Avatar")}
                    disabled={isGenerating || !user?.photoURL}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-gradient-to-br from-indigo-500/10 to-indigo-600/20 hover:from-indigo-500/20 hover:to-indigo-600/30 disabled:opacity-40 text-indigo-300 text-[11px] font-bold rounded-lg border border-indigo-500/20 hover:border-indigo-500/40 transition-all active:scale-95 whitespace-nowrap shadow-sm"
                  >
                    {isGenerating ? (
                      <div className="w-3.5 h-3.5 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                    ) : (
                      <Pipette size={14} className="text-indigo-400" />
                    )}
                    Avatar Analizi
                  </button>

                  <button
                    type="button"
                    onClick={() => handleGenerateFromImage(bgImage, "Arkaplan")}
                    disabled={isGenerating || !bgImage}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-gradient-to-br from-purple-500/10 to-purple-600/20 hover:from-purple-500/20 hover:to-purple-600/30 disabled:opacity-40 text-purple-300 text-[11px] font-bold rounded-lg border border-purple-500/20 hover:border-purple-500/40 transition-all active:scale-95 whitespace-nowrap shadow-sm"
                  >
                    {isGenerating ? (
                      <div className="w-3.5 h-3.5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
                    ) : (
                      <Pipette size={14} className="text-purple-400" />
                    )}
                    Kapak Analizi
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Konuşma Efekti (Parlama) Ayarı */}
        <div className="mt-4 animate-in fade-in zoom-in-95 duration-200 bg-[#1e1f22] p-4 rounded-xl border border-white/5 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs text-white/80 font-medium flex items-center gap-2">
              <Zap size={14} className="text-emerald-400" /> Profil Rengiyle Sesli Parlama
            </span>
            <span className="text-[10px] text-white/40 mt-1 max-w-[250px] leading-tight">
              Sesli odalarda konuştuğunda, çerçeven profil temanın rengiyle parlar. Kapalıysa standart yeşil (Discord tarzı) yanar.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setUseProfileColorForSpeaking(!useProfileColorForSpeaking)}
            className={`w-10 h-6 rounded-full flex items-center px-1 transition-colors duration-200 shrink-0 ${
              useProfileColorForSpeaking
                ? "bg-indigo-500"
                : "bg-[#2b2d31]"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform duration-200 ${
                useProfileColorForSpeaking ? "translate-x-4" : ""
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
