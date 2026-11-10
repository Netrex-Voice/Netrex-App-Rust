import { ShieldAlert } from "lucide-react";
import ToggleSwitch from "../../ToggleSwitch";
import { SettingsCard, SettingRow } from "../../SettingsCard";
import { useSettingsStore } from "@/src/store/settingsStore";

// "Sesiniz karşıya gitmiyor" uyarısı. Algılama mantığı: src/hooks/useMicGuard.js
export default function MicGuardSection() {
  const micGuardEnabled = useSettingsStore((s) => s.micGuardEnabled);
  const setMicGuardEnabled = useSettingsStore((s) => s.setMicGuardEnabled);
  const micGuardDelaySec = useSettingsStore((s) => s.micGuardDelaySec);
  const setMicGuardDelaySec = useSettingsStore((s) => s.setMicGuardDelaySec);
  const micGuardVoice = useSettingsStore((s) => s.micGuardVoice);
  const setMicGuardVoice = useSettingsStore((s) => s.setMicGuardVoice);

  return (
    <SettingsCard
      icon={<ShieldAlert size={14} className="text-amber-400" />}
      iconBg="bg-amber-500/20"
      title="Mikrofon Koruması"
      description="Mikrofonunuz kapalıyken konuşursanız ya da mikrofonunuz çalışmıyorsa, sesinizin karşıya gitmediğini size söyler."
      className="mb-4"
    >
      <SettingRow hoverBorder="hover:border-amber-500/20">
        <ToggleSwitch
          label="Sesiniz Karşıya Gitmiyorsa Uyar"
          description="Sürekli öten bir alarm değildir: yalnızca gerçekten konuştuğunuz fark edilirse ve seyrek uyarır. Kapalı mikrofonun sesi yalnızca cihazınızda ölçülür; kaydedilmez ve gönderilmez."
          checked={micGuardEnabled}
          onChange={() => setMicGuardEnabled(!micGuardEnabled)}
        />
        {micGuardEnabled && (
          <div className="mt-4 pt-4 border-t border-white/5 ml-12 animate-in fade-in duration-200">
            <div className="mb-6">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-white/80">Uyarmadan Önce Bekleme Süresi</span>
                <span className="text-sm font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">{micGuardDelaySec} sn</span>
              </div>
              <p className="text-xs text-[#949ba4] mb-3">
                Mikrofonu kapattıktan sonra bu süre dolmadan, konuşsanız bile uyarılmazsınız. Bilerek kapattıysanız sizi rahatsız etmez.
              </p>
              <input
                type="range"
                min="0"
                max="120"
                step="5"
                value={micGuardDelaySec}
                onChange={(e) => setMicGuardDelaySec(Number(e.target.value))}
                className="w-full accent-amber-500 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-[#949ba4] mt-1">
                <span>Hemen</span>
                <span>2 dk</span>
              </div>
            </div>
            <ToggleSwitch
              label="Uyarıyı Sesli Söyle"
              description={'"Mikrofonunuz kapalı, sesiniz karşıya gitmiyor" gibi uyarıyı sesli okur (oyundayken de duyarsınız).'}
              checked={micGuardVoice}
              onChange={() => setMicGuardVoice(!micGuardVoice)}
            />
          </div>
        )}
      </SettingRow>
    </SettingsCard>
  );
}
