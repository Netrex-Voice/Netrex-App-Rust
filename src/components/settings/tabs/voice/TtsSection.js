import { useState, useEffect } from "react";
import { MessageSquareText } from "lucide-react";
import ToggleSwitch from "../../ToggleSwitch";
import { SettingsCard, SettingRow } from "../../SettingsCard";
import { useSettingsStore } from "@/src/store/settingsStore";

// Gelen mesajları sesli okuma (TTS). Okuma mantığı: components/active-room/GlobalChatListener.js
export default function TtsSection() {
  const ttsEnabled = useSettingsStore((s) => s.ttsEnabled);
  const setTtsEnabled = useSettingsStore((s) => s.setTtsEnabled);
  const ttsVolume = useSettingsStore((s) => s.ttsVolume);
  const setTtsVolume = useSettingsStore((s) => s.setTtsVolume);
  const ttsVoiceURI = useSettingsStore((s) => s.ttsVoiceURI);
  const setTtsVoiceURI = useSettingsStore((s) => s.setTtsVoiceURI);
  const ttsOnlyUnfocused = useSettingsStore((s) => s.ttsOnlyUnfocused);
  const setTtsOnlyUnfocused = useSettingsStore((s) => s.setTtsOnlyUnfocused);

  const [availableVoices, setAvailableVoices] = useState([]);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const fetchVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices.filter((v) => v.lang.includes("tr") || v.lang.includes("TR")));
      };
      fetchVoices();
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = fetchVoices;
      }
    }
  }, []);

  return (
    <SettingsCard
      icon={<MessageSquareText size={14} className="text-indigo-400" />}
      iconBg="bg-indigo-500/20"
      title="Mesajları Sesli Okuma"
      description="Yeni gelen yazılı mesajları bilgisayar sesiyle okur. Oyundayken ekrana bakmadan mesajları duymak için kullanışlıdır."
      className="mb-4"
    >
      <SettingRow>
        <ToggleSwitch
          label="Gelen Mesajları Sesli Oku"
          description="Yeni gelen mesajları sesli olarak otomatik okur."
          checked={ttsEnabled}
          onChange={() => {
            const newState = !ttsEnabled;
            setTtsEnabled(newState);
            if (!newState && typeof window !== "undefined" && "speechSynthesis" in window) {
              window.speechSynthesis.cancel();
            }
          }}
        />
        {ttsEnabled && (
          <div className="mt-4 pt-4 border-t border-white/5 ml-12 animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white/80">Ses Seviyesi</span>
              <span className="text-sm font-bold text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded">% {ttsVolume}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={ttsVolume}
              onChange={(e) => setTtsVolume(Number(e.target.value))}
              className="w-full accent-indigo-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer mb-6"
            />

            <div className="mb-6">
              <ToggleSwitch
                label="Sadece Arka Plandayken Oku"
                description="Pencere odakta değilken (örn. oyundayken) veya arka plandayken sesi okur."
                checked={ttsOnlyUnfocused}
                onChange={() => setTtsOnlyUnfocused(!ttsOnlyUnfocused)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-white/80">Tercih Edilen Ses</span>
              <select
                value={ttsVoiceURI}
                onChange={(e) => setTtsVoiceURI(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500/50 appearance-none transition-colors"
              >
                <option value="auto" className="bg-[#1e1f22] text-white">Otomatik (Kişilere Özel Dağıtım)</option>
                {availableVoices.map((voice) => (
                  <option key={voice.voiceURI} value={voice.voiceURI} className="bg-[#1e1f22] text-white">
                    {voice.name} {voice.default ? "(Varsayılan)" : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-white/50 mt-1">
                Cihazınızdaki mevcut Türkçe sentez motorları. &quot;Otomatik&quot; kalması, herkesi farklı bir profilde seslendirmeye çalışır.
              </p>
            </div>
          </div>
        )}
      </SettingRow>
    </SettingsCard>
  );
}
