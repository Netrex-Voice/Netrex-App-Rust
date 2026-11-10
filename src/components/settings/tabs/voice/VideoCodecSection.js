import { Cpu } from "lucide-react";
import { SettingsCard, SettingRow } from "../../SettingsCard";
import { useSettingsStore } from "@/src/store/settingsStore";

// Kamera yayınında kullanılan video codec'i (BottomControls/SettingsUpdater publish ayarları)
export default function VideoCodecSection() {
  const videoCodec = useSettingsStore((s) => s.videoCodec);
  const setVideoCodec = useSettingsStore((s) => s.setVideoCodec);

  return (
    <SettingsCard
      icon={<Cpu size={14} className="text-blue-400" />}
      iconBg="bg-blue-500/20"
      title="Video Kodlama (Codec)"
      description="Kameranızın görüntüsünün nasıl sıkıştırılıp gönderileceği. Emin değilseniz VP8'de bırakın, her cihazla çalışır."
      className="mb-4"
    >
      <SettingRow hoverBorder="hover:border-blue-500/20">
        <label className="block text-xs font-bold text-[#b5bac1] uppercase mb-2">Tercih Edilen Codec</label>
        <select
          value={videoCodec}
          onChange={(e) => setVideoCodec(e.target.value)}
          className="w-full bg-[#2b2d31] border border-white/10 text-white p-3 rounded-xl hover:border-blue-500/50 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 outline-none appearance-none cursor-pointer transition-all duration-300"
        >
          <option value="vp8">VP8 (Varsayılan - En Uyumlu)</option>
          <option value="h264">H.264 (Donanım Hızlandırma)</option>
          <option value="av1">AV1 (Yeni Nesil - Yüksek Sıkıştırma)</option>
        </select>
      </SettingRow>
    </SettingsCard>
  );
}
