import { Ear } from "lucide-react";
import ToggleSwitch from "../../ToggleSwitch";
import { SettingsCard, SettingRow } from "../../SettingsCard";
import { useSettingsStore } from "@/src/store/settingsStore";

// Konuşma grupları / fısıltı. Mantık: src/hooks/useVoiceGroups.js
export default function VoiceGroupsSection() {
  const whisperAutoReply = useSettingsStore((s) => s.whisperAutoReply);
  const setWhisperAutoReply = useSettingsStore((s) => s.setWhisperAutoReply);

  return (
    <SettingsCard
      icon={<Ear size={14} className="text-purple-400" />}
      iconBg="bg-purple-500/20"
      title="Fısıltı"
      description="Biri size fısıldadığında cevabınızın nereye gideceğini belirler."
      className="mb-4"
    >
      <SettingRow hoverBorder="hover:border-purple-500/20">
        <ToggleSwitch
          label="Fısıltıya Otomatik Yanıt"
          description="Biri size fısıldayınca, cevabınız herkese değil sadece ona gider. O fısıldamayı bırakınca 8 saniye daha açık kalır; konuştukça uzar. Kişinin kartındaki ✕ ile istediğiniz an kapatabilirsiniz."
          checked={whisperAutoReply}
          onChange={() => setWhisperAutoReply(!whisperAutoReply)}
        />
      </SettingRow>
    </SettingsCard>
  );
}
