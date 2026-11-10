import { useState, useRef, useEffect } from "react";
import { useSettingsStore } from "@/src/store/settingsStore";
import { getCommonFonts } from "@/src/utils/fontDetector";
import { Plus, Trash2, Clock, Smile } from "lucide-react";
import { toastOnce } from "@/src/utils/toast";
import EmojiPicker from "@/src/components/ui/EmojiPicker";

export default function AppearanceSettings() {
  const uiScale = useSettingsStore(state => state.uiScale);
  const fontSize = useSettingsStore(state => state.fontSize);
  const fontFamily = useSettingsStore(state => state.fontFamily);
  const setUIScale = useSettingsStore(state => state.setUIScale);
  const setFontSize = useSettingsStore(state => state.setFontSize);
  const setFontFamily = useSettingsStore(state => state.setFontFamily);
  
  // Quick Status Store
  const presets = useSettingsStore(state => state.quickStatusPresets);
  const updatePreset = useSettingsStore(state => state.updateQuickStatusPreset);
  const addPreset = useSettingsStore(state => state.addQuickStatusPreset);
  const removePreset = useSettingsStore(state => state.removeQuickStatusPreset);

  const [activeEmojiPicker, setActiveEmojiPicker] = useState(null);
  const [pickerDirection, setPickerDirection] = useState('down');
  const pickerRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
        if (pickerRef.current && !pickerRef.current.contains(e.target)) {
            setActiveEmojiPicker(null);
        }
    };
    if (activeEmojiPicker) {
        window.addEventListener("mousedown", handleClick);
    }
    return () => window.removeEventListener("mousedown", handleClick);
  }, [activeEmojiPicker]);
  
  const handleEmojiClick = (e, id) => {
    if (activeEmojiPicker === id) {
      setActiveEmojiPicker(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // If less than 350px space below, show above
      setPickerDirection(spaceBelow < 350 ? "up" : "down");
      setActiveEmojiPicker(id);
    }
  };


  const fontOptions = getCommonFonts();

  const fontSizeOptions = [
    { value: "small", label: "Küçük", size: "14px" },
    { value: "medium", label: "Orta", size: "16px" },
    { value: "large", label: "Büyük", size: "18px" },
  ];

  const scaleOptions = [
    { value: 75, label: "Küçük (75%)" },
    { value: 100, label: "Normal (100%)" },
    { value: 125, label: "Büyük (125%)" },
    { value: 150, label: "Çok Büyük (150%)" },
  ];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 pb-20">
      <h3 className="text-xl font-bold text-white mb-3 relative px-1">
        <span className="relative z-10">Görünüm Ayarları</span>
      </h3>

      {/* 🚀 Hızlı Durum Mesajları Yönetimi */}
      <div className="glass-strong rounded-2xl border border-white/10 overflow-visible p-4 mb-5 relative z-[60]">
        <div className="flex items-center justify-between mb-6">
            <h4 className="text-xs font-bold text-[#949ba4] uppercase flex items-center gap-2">
                <Clock size={14} className="text-indigo-400" />
                Hızlı Durum Slotları
                <span className="normal-case font-normal text-[#5c5e66] ml-1">· hazır durumlarınızı burada düzenlersiniz, kısayol tuşlarını Kısayollar sekmesinde atarsınız</span>
            </h4>
            <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#5c5e66] font-medium">{presets.length}/6 Slot</span>
                <span className="text-[10px] text-indigo-400/60 bg-indigo-500/5 px-2.5 py-1 rounded-full border border-indigo-500/10 font-bold">Özelleştirilebilir</span>
            </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
            {presets.map((preset, index) => (
                <div key={preset.id} className="relative z-10">
                    <div className="flex items-center gap-3 bg-white/[0.02] border border-white/5 p-2 rounded-2xl group/preset hover:border-white/10 transition-all">
                        {/* Emoji Button */}
                        <button 
                            onClick={(e) => handleEmojiClick(e, preset.id)}
                            className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 transition-all text-2xl shadow-sm ${
                                activeEmojiPicker === preset.id 
                                ? "bg-indigo-500/20 border-indigo-500/50 scale-105 shadow-indigo-500/20" 
                                : "bg-white/5 border-white/5 hover:bg-white/10"
                            }`}
                        >
                            {preset.icon}
                        </button>
                        
                        {/* Label Input */}
                        <div className="flex-1">
                            <input 
                                type="text"
                                value={preset.label || ""}
                                onChange={(e) => updatePreset(preset.id, { label: e.target.value })}
                                placeholder="Mesajınızı yazın..."
                                className="w-full bg-transparent border-none px-2 py-2 text-sm text-white focus:outline-none font-medium placeholder:text-white/10"
                            />
                        </div>

                        {/* Delete Button (Show on Hover) */}
                        <button 
                            onClick={() => removePreset(preset.id)}
                            className="p-3 text-red-500/20 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover/preset:opacity-100"
                            title="Bu slotu sil"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>

                    {/* Emoji Picker Inline Popover */}
                    {activeEmojiPicker === preset.id && (
                        <div 
                            ref={pickerRef} 
                            className={`absolute z-[100] w-[280px] drop-shadow-2xl animate-nds-scale-up ${
                                pickerDirection === "up" 
                                ? "bottom-full mb-3 origin-bottom-left" 
                                : "top-[60px] left-0 origin-top-left"
                            }`}
                        >
                            <EmojiPicker 
                                onSelect={(emoji) => {
                                    updatePreset(activeEmojiPicker, { icon: emoji });
                                    setActiveEmojiPicker(null);
                                }}
                                onClose={() => setActiveEmojiPicker(null)}
                            />
                        </div>
                    )}
                </div>
            ))}

            {/* + Add Slot Button */}
            {presets.length < 6 && (
                <button 
                    onClick={() => addPreset()}
                    className="flex items-center justify-center gap-2 w-full py-4 border border-dashed border-white/10 rounded-2xl text-[#5c5e66] hover:text-white hover:border-white/20 hover:bg-white/[0.02] transition-all group/add"
                >
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover/add:bg-indigo-500 group-hover/add:text-white transition-colors">
                        <Plus size={16} />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wide">Yeni Slot Ekle</span>
                </button>
            )}
        </div>
        

        <p className="mt-6 text-[11px] text-[#5c5e66] leading-relaxed flex items-center gap-2 px-1">
            <Smile size={14} className="text-indigo-500/50" />
            İkonu değiştirmek için butona tıklayın, metni değiştirmek için yazıya tıklayın. En fazla 6 durum ekleyebilirsiniz.
        </p>
      </div>

      {/* Ölçeklendirme ve Font */}
      <div className="glass-strong rounded-2xl border border-white/10 overflow-hidden p-4 mb-5">
        <h4 className="text-xs font-bold text-[#949ba4] uppercase mb-5 flex items-center gap-2">
          <div className="w-1 h-3 bg-indigo-500 rounded-full" />
          Ölçeklendirme ve Font
        </h4>

        <div className="space-y-6">
            <div>
            <label className="block text-sm font-medium text-[#dbdee1] mb-2">
                UI Ölçeklendirme
            </label>
            <p className="text-xs text-[#949ba4] mb-2 -mt-1">Tüm arayüzü (yazılar, düğmeler, boşluklar) birlikte büyütür ya da küçültür. Yazılar küçük geliyorsa artırın.</p>
            <select
                value={uiScale}
                onChange={(e) => setUIScale(Number(e.target.value))}
                className="w-full bg-[#1e1f22] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 transition-all"
            >
                {scaleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}
                </option>
                ))}
            </select>
            </div>

            <div>
            <label className="block text-sm font-medium text-[#dbdee1] mb-2">
                Font Boyutu
            </label>
            <p className="text-xs text-[#949ba4] mb-2 -mt-1">Genel yazı boyutunu ayarlar. Her şeyi büyütmek yerine yalnızca yazıları büyütmek istiyorsanız bunu kullanın.</p>
            <select
                value={fontSize}
                onChange={(e) => setFontSize(e.target.value)}
                className="w-full bg-[#1e1f22] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 transition-all"
            >
                {fontSizeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label} ({opt.size})
                </option>
                ))}
            </select>
            </div>

            <div>
            <label className="block text-sm font-medium text-[#dbdee1] mb-2">
                Font Ailesi
            </label>
            <p className="text-xs text-[#949ba4] mb-2 -mt-1">Uygulamanın yazı tipi. “Sistem” seçeneği bilgisayarınızın varsayılan yazı tipini kullanır.</p>
            <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="w-full bg-[#1e1f22] border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 transition-all"
            >
                {fontOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}
                </option>
                ))}
            </select>
            </div>
        </div>
      </div>
    </div>
  );
}
